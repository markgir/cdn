/**
 * SSL Certificate Management
 *
 * Handles SSL/TLS certificates for the CDN:
 *   - Load existing certificates from disk
 *   - Request new certificates via Let's Encrypt (ACME HTTP-01)
 *   - Auto-renewal of certificates nearing expiry
 *   - Manual certificate upload and deletion
 *
 * Certificates are stored in: data/ssl/
 *
 * Credits: Developed by iddigital.pt
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { logger } = require('./logger');
const config = require('./config');

const SSL_DIR = path.resolve(__dirname, '..', '..', 'data', 'ssl');
const CERT_FILE = path.join(SSL_DIR, 'cert.pem');
const KEY_FILE = path.join(SSL_DIR, 'key.pem');
const CA_FILE = path.join(SSL_DIR, 'ca.pem');
const ACCOUNT_KEY_FILE = path.join(SSL_DIR, 'account.key.pem');
const META_FILE = path.join(SSL_DIR, 'meta.json');

// In-memory store for ACME HTTP-01 challenge tokens
const challengeTokens = {};

// Renewal check interval (24 hours)
let renewalInterval = null;

/**
 * Ensure the SSL directory exists.
 */
function ensureDir() {
  if (!fs.existsSync(SSL_DIR)) {
    fs.mkdirSync(SSL_DIR, { recursive: true });
  }
}

/**
 * Check whether a valid certificate exists on disk.
 */
function hasCertificate() {
  return fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE);
}

/**
 * Load the certificate and key from disk.
 * Returns { cert, key, ca } or null if not found.
 */
function loadCertificate() {
  if (!hasCertificate()) return null;
  try {
    const cert = fs.readFileSync(CERT_FILE, 'utf8');
    const key = fs.readFileSync(KEY_FILE, 'utf8');
    const ca = fs.existsSync(CA_FILE) ? fs.readFileSync(CA_FILE, 'utf8') : undefined;
    return { cert, key, ca };
  } catch (err) {
    logger.error('Failed to load SSL certificate: ' + err.message);
    return null;
  }
}

/**
 * Parse certificate info (domain, expiry, issuer) from PEM.
 * Uses Node.js built-in crypto.X509Certificate (Node >= 15).
 */
function getCertificateInfo() {
  if (!hasCertificate()) return null;
  try {
    const pem = fs.readFileSync(CERT_FILE, 'utf8');
    const x509 = new crypto.X509Certificate(pem);
    const meta = loadMeta();
    return {
      domain: extractCN(x509.subject),
      altNames: extractSANs(x509.subjectAltName),
      issuer: extractCN(x509.issuer),
      validFrom: x509.validFrom,
      validTo: x509.validTo,
      validToDate: new Date(x509.validTo).toISOString(),
      daysRemaining: daysUntil(x509.validTo),
      serialNumber: x509.serialNumber,
      fingerprint: x509.fingerprint256,
      autoRenew: meta ? meta.autoRenew !== false : false,
      source: meta ? meta.source || 'unknown' : 'unknown',
    };
  } catch (err) {
    logger.error('Failed to parse certificate: ' + err.message);
    return null;
  }
}

function extractCN(subjectStr) {
  if (!subjectStr) return '';
  const match = subjectStr.match(/CN=([^,\n]+)/);
  return match ? match[1].trim() : subjectStr;
}

function extractSANs(sanStr) {
  if (!sanStr) return [];
  return sanStr.split(',').map(s => s.trim().replace(/^DNS:/, ''));
}

function daysUntil(dateStr) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Save / load certificate metadata.
 */
function saveMeta(data) {
  ensureDir();
  fs.writeFileSync(META_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function loadMeta() {
  try {
    if (fs.existsSync(META_FILE)) {
      return JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Save a manually uploaded certificate.
 */
function uploadCertificate(certPem, keyPem, caPem) {
  ensureDir();

  // Validate that cert and key are valid PEM
  try {
    new crypto.X509Certificate(certPem);
  } catch (err) {
    throw new Error('Invalid certificate PEM: ' + err.message);
  }

  try {
    crypto.createPrivateKey(keyPem);
  } catch (err) {
    throw new Error('Invalid private key PEM: ' + err.message);
  }

  fs.writeFileSync(CERT_FILE, certPem, { mode: 0o644, encoding: 'utf8' });
  fs.writeFileSync(KEY_FILE, keyPem, { mode: 0o600, encoding: 'utf8' });
  if (caPem) {
    fs.writeFileSync(CA_FILE, caPem, { mode: 0o644, encoding: 'utf8' });
  }

  saveMeta({
    source: 'upload',
    uploadedAt: new Date().toISOString(),
    autoRenew: false,
  });

  logger.info('SSL certificate uploaded manually');
  return getCertificateInfo();
}

/**
 * Delete the current certificate.
 */
function deleteCertificate() {
  const files = [CERT_FILE, KEY_FILE, CA_FILE, META_FILE];
  let deleted = 0;
  for (const f of files) {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      deleted++;
    }
  }
  logger.info('SSL certificate deleted (' + deleted + ' files removed)');
  return { deleted };
}

/**
 * Request a new certificate from Let's Encrypt using ACME HTTP-01 challenge.
 * Requires port 80 to be accessible from the internet for challenge validation.
 */
async function requestCertificate(domain, email) {
  const acme = require('acme-client');

  ensureDir();

  if (!domain) throw new Error('Domain is required');
  if (!email) throw new Error('Email is required for Let\'s Encrypt registration');

  logger.info('Requesting SSL certificate for ' + domain + ' via Let\'s Encrypt');

  // Create or load ACME account key
  let accountKey;
  if (fs.existsSync(ACCOUNT_KEY_FILE)) {
    accountKey = fs.readFileSync(ACCOUNT_KEY_FILE, 'utf8');
  } else {
    accountKey = (await acme.crypto.createPrivateKey()).toString();
    fs.writeFileSync(ACCOUNT_KEY_FILE, accountKey, { mode: 0o600, encoding: 'utf8' });
  }

  // Use production or staging based on config
  const directoryUrl = config.ssl.acmeStaging
    ? acme.directory.letsencrypt.staging
    : acme.directory.letsencrypt.production;

  const client = new acme.Client({
    directoryUrl,
    accountKey,
  });

  // Create CSR
  const [csrKey, csr] = await acme.crypto.createCsr({
    commonName: domain,
    altNames: [domain],
  });

  // Request certificate with HTTP-01 challenge
  const cert = await client.auto({
    csr,
    email,
    termsOfServiceAgreed: true,
    challengeCreateFn: async (authz, challenge, keyAuthorization) => {
      if (challenge.type === 'http-01') {
        challengeTokens[challenge.token] = keyAuthorization;
        logger.info('ACME challenge created for token: ' + challenge.token);
      }
    },
    challengeRemoveFn: async (authz, challenge) => {
      if (challenge.type === 'http-01') {
        delete challengeTokens[challenge.token];
        logger.info('ACME challenge removed for token: ' + challenge.token);
      }
    },
    challengePriority: ['http-01'],
  });

  // Save certificate and key
  fs.writeFileSync(CERT_FILE, cert, { mode: 0o644, encoding: 'utf8' });
  fs.writeFileSync(KEY_FILE, csrKey.toString(), { mode: 0o600, encoding: 'utf8' });

  saveMeta({
    source: 'letsencrypt',
    domain,
    email,
    requestedAt: new Date().toISOString(),
    autoRenew: true,
    staging: !!config.ssl.acmeStaging,
  });

  logger.info('SSL certificate obtained for ' + domain);
  return getCertificateInfo();
}

/**
 * Renew the current Let's Encrypt certificate.
 * Only renews if the certificate is from Let's Encrypt and has autoRenew enabled.
 */
async function renewCertificate() {
  const meta = loadMeta();
  if (!meta) throw new Error('No certificate metadata found');
  if (meta.source !== 'letsencrypt') throw new Error('Only Let\'s Encrypt certificates can be auto-renewed');

  const info = getCertificateInfo();
  if (!info) throw new Error('No certificate found to renew');

  logger.info('Renewing SSL certificate for ' + meta.domain + ' (expires in ' + info.daysRemaining + ' days)');
  return requestCertificate(meta.domain, meta.email);
}

/**
 * Check if the certificate needs renewal (within 30 days of expiry)
 * and renew automatically if so.
 */
async function checkAndRenew() {
  const meta = loadMeta();
  if (!meta || !meta.autoRenew || meta.source !== 'letsencrypt') return;

  const info = getCertificateInfo();
  if (!info) return;

  if (info.daysRemaining <= 30) {
    logger.info('Certificate expires in ' + info.daysRemaining + ' days, initiating auto-renewal');
    try {
      await renewCertificate();
      logger.info('Auto-renewal completed successfully');
    } catch (err) {
      logger.error('Auto-renewal failed: ' + err.message);
    }
  }
}

/**
 * Start the auto-renewal check (runs every 24 hours).
 */
function startAutoRenewal() {
  if (renewalInterval) return;
  // Check immediately, then every 24 hours
  checkAndRenew().catch(err => logger.error('Renewal check error: ' + err.message));
  renewalInterval = setInterval(() => {
    checkAndRenew().catch(err => logger.error('Renewal check error: ' + err.message));
  }, 24 * 60 * 60 * 1000);
  logger.info('SSL auto-renewal check scheduled (every 24 hours)');
}

/**
 * Stop the auto-renewal check.
 */
function stopAutoRenewal() {
  if (renewalInterval) {
    clearInterval(renewalInterval);
    renewalInterval = null;
  }
}

/**
 * Get the ACME challenge response for an HTTP-01 token.
 * Used by the ACME challenge route handler.
 */
function getChallengeResponse(token) {
  return challengeTokens[token] || null;
}

module.exports = {
  hasCertificate,
  loadCertificate,
  getCertificateInfo,
  uploadCertificate,
  deleteCertificate,
  requestCertificate,
  renewCertificate,
  checkAndRenew,
  startAutoRenewal,
  stopAutoRenewal,
  getChallengeResponse,
  SSL_DIR,
};
