/**
 * SSL Certificate Management routes for the Admin Backoffice.
 *
 * Endpoints:
 *   GET    /api/ssl/status     – current certificate info
 *   POST   /api/ssl/upload     – upload a custom certificate
 *   POST   /api/ssl/request    – request a Let's Encrypt certificate
 *   POST   /api/ssl/renew      – renew the current certificate
 *   DELETE /api/ssl/delete      – delete the current certificate
 *
 * Credits: Developed by iddigital.pt
 */

const express = require('express');
const ssl = require('../ssl');
const config = require('../config');
const { logger } = require('../logger');

const router = express.Router();

// ── Certificate Status ───────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  const info = ssl.getCertificateInfo();
  res.json({
    hasCertificate: ssl.hasCertificate(),
    certificate: info,
    sslEnabled: config.ssl.enabled,
    domain: config.ssl.domain,
    email: config.ssl.email,
  });
});

// ── Upload Certificate ───────────────────────────────────────────────────────
router.post('/upload', (req, res) => {
  const { cert, key, ca } = req.body;
  if (!cert || !key) {
    return res.status(400).json({ error: 'Certificate (cert) and private key (key) are required.' });
  }
  try {
    const info = ssl.uploadCertificate(cert, key, ca || null);
    res.json({ message: 'Certificate uploaded successfully.', certificate: info });
  } catch (err) {
    logger.error('SSL upload failed: ' + err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── Request Let's Encrypt Certificate ────────────────────────────────────────
router.post('/request', async (req, res) => {
  const { domain, email } = req.body;
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required.' });
  }
  if (!email) {
    return res.status(400).json({ error: 'Email is required for Let\'s Encrypt registration.' });
  }
  try {
    const info = await ssl.requestCertificate(domain, email);
    res.json({ message: 'Certificate obtained successfully.', certificate: info });
  } catch (err) {
    logger.error('SSL request failed: ' + err.message);
    res.status(500).json({ error: 'Failed to obtain certificate: ' + err.message });
  }
});

// ── Renew Certificate ────────────────────────────────────────────────────────
router.post('/renew', async (req, res) => {
  try {
    const info = await ssl.renewCertificate();
    res.json({ message: 'Certificate renewed successfully.', certificate: info });
  } catch (err) {
    logger.error('SSL renewal failed: ' + err.message);
    res.status(500).json({ error: 'Failed to renew certificate: ' + err.message });
  }
});

// ── Delete Certificate ───────────────────────────────────────────────────────
router.delete('/delete', (req, res) => {
  try {
    const result = ssl.deleteCertificate();
    res.json({ message: 'Certificate deleted.', ...result });
  } catch (err) {
    logger.error('SSL delete failed: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = { sslRouter: router };
