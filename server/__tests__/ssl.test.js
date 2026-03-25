// CDN Manager — SSL Certificate Management Tests
// Credits: Developed by iddigital.pt

const request = require('supertest');
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { adminApp } = require('../src/app');

const AUTH = Buffer.from('admin:changeme').toString('base64');
const authHeader = { Authorization: `Basic ${AUTH}` };

// Test SSL directory
const SSL_DIR = path.resolve(__dirname, '..', '..', 'data', 'ssl');

// Generate a self-signed test certificate
function generateTestCert() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

  // Use Node.js built-in to create a self-signed cert
  // We'll create a minimal X.509 cert using the crypto module
  const cert = crypto.X509Certificate;

  // For testing, we'll create PEM strings that are structurally valid
  return { keyPem };
}

describe('SSL Certificate API', () => {
  // Clean up test SSL files before and after
  beforeAll(() => {
    if (fs.existsSync(path.join(SSL_DIR, 'cert.pem'))) {
      fs.unlinkSync(path.join(SSL_DIR, 'cert.pem'));
    }
    if (fs.existsSync(path.join(SSL_DIR, 'key.pem'))) {
      fs.unlinkSync(path.join(SSL_DIR, 'key.pem'));
    }
    if (fs.existsSync(path.join(SSL_DIR, 'ca.pem'))) {
      fs.unlinkSync(path.join(SSL_DIR, 'ca.pem'));
    }
    if (fs.existsSync(path.join(SSL_DIR, 'meta.json'))) {
      fs.unlinkSync(path.join(SSL_DIR, 'meta.json'));
    }
  });

  afterAll(() => {
    // Clean up
    try {
      if (fs.existsSync(path.join(SSL_DIR, 'cert.pem'))) fs.unlinkSync(path.join(SSL_DIR, 'cert.pem'));
      if (fs.existsSync(path.join(SSL_DIR, 'key.pem'))) fs.unlinkSync(path.join(SSL_DIR, 'key.pem'));
      if (fs.existsSync(path.join(SSL_DIR, 'ca.pem'))) fs.unlinkSync(path.join(SSL_DIR, 'ca.pem'));
      if (fs.existsSync(path.join(SSL_DIR, 'meta.json'))) fs.unlinkSync(path.join(SSL_DIR, 'meta.json'));
    } catch { /* ignore */ }
  });

  describe('GET /api/ssl/status', () => {
    it('returns SSL status with no certificate', async () => {
      const res = await request(adminApp).get('/api/ssl/status').set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('hasCertificate', false);
      expect(res.body).toHaveProperty('certificate', null);
      expect(res.body).toHaveProperty('sslEnabled');
      expect(res.body).toHaveProperty('domain');
    });

    it('requires authentication', async () => {
      const res = await request(adminApp).get('/api/ssl/status');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/ssl/upload', () => {
    it('rejects missing certificate', async () => {
      const res = await request(adminApp)
        .post('/api/ssl/upload')
        .set(authHeader)
        .send({ key: 'test' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('rejects missing key', async () => {
      const res = await request(adminApp)
        .post('/api/ssl/upload')
        .set(authHeader)
        .send({ cert: 'test' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('rejects invalid PEM data', async () => {
      const res = await request(adminApp)
        .post('/api/ssl/upload')
        .set(authHeader)
        .send({ cert: 'not-a-valid-cert', key: 'not-a-valid-key' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid certificate PEM/);
    });

    it('requires authentication', async () => {
      const res = await request(adminApp)
        .post('/api/ssl/upload')
        .send({ cert: 'test', key: 'test' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/ssl/request', () => {
    it('rejects missing domain', async () => {
      const res = await request(adminApp)
        .post('/api/ssl/request')
        .set(authHeader)
        .send({ email: 'test@example.com' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Domain is required/);
    });

    it('rejects missing email', async () => {
      const res = await request(adminApp)
        .post('/api/ssl/request')
        .set(authHeader)
        .send({ domain: 'cdn.example.com' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Email is required/);
    });

    it('requires authentication', async () => {
      const res = await request(adminApp)
        .post('/api/ssl/request')
        .send({ domain: 'cdn.example.com', email: 'test@example.com' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/ssl/renew', () => {
    it('fails when no certificate exists', async () => {
      const res = await request(adminApp)
        .post('/api/ssl/renew')
        .set(authHeader);
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });

    it('requires authentication', async () => {
      const res = await request(adminApp).post('/api/ssl/renew');
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/ssl/delete', () => {
    it('succeeds even when no certificate exists', async () => {
      const res = await request(adminApp)
        .delete('/api/ssl/delete')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('deleted');
    });

    it('requires authentication', async () => {
      const res = await request(adminApp).delete('/api/ssl/delete');
      expect(res.status).toBe(401);
    });
  });

  describe('Upload and status flow', () => {
    // Generate a self-signed certificate for testing
    let testCert, testKey;

    beforeAll(() => {
      // Create a self-signed certificate using openssl-like approach with Node.js
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });

      testKey = privateKey.export({ type: 'pkcs8', format: 'pem' });

      // We need a real X.509 cert. Use a pre-made self-signed cert for testing.
      // Generate using Node.js crypto (available since Node 15+)
      const keyObj = crypto.createPrivateKey(testKey);
      const publicKey = crypto.createPublicKey(keyObj);

      // Node.js doesn't have a built-in way to create X.509 certs without openssl
      // So we'll use a minimal approach: create cert with child_process
      const { execFileSync } = require('child_process');

      try {
        // Write key to temp file
        const tmpKeyFile = path.join(os.tmpdir(), 'test-ssl-key.pem');
        const tmpCertFile = path.join(os.tmpdir(), 'test-ssl-cert.pem');
        fs.writeFileSync(tmpKeyFile, testKey);

        execFileSync('openssl', [
          'req', '-new', '-x509', '-key', tmpKeyFile,
          '-out', tmpCertFile,
          '-days', '365',
          '-subj', '/CN=test.example.com'
        ]);

        testCert = fs.readFileSync(tmpCertFile, 'utf8');
        fs.unlinkSync(tmpKeyFile);
        fs.unlinkSync(tmpCertFile);
      } catch (err) {
        // openssl not available - skip cert tests
        testCert = null;
      }
    });

    it('can upload a valid certificate and check status', async () => {
      if (!testCert) {
        // openssl is not available in this environment - skip
        return;
      }

      // Upload
      const uploadRes = await request(adminApp)
        .post('/api/ssl/upload')
        .set(authHeader)
        .send({ cert: testCert, key: testKey });
      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body).toHaveProperty('message');
      expect(uploadRes.body).toHaveProperty('certificate');
      expect(uploadRes.body.certificate.domain).toBe('test.example.com');

      // Check status
      const statusRes = await request(adminApp).get('/api/ssl/status').set(authHeader);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.hasCertificate).toBe(true);
      expect(statusRes.body.certificate).not.toBeNull();
      expect(statusRes.body.certificate.domain).toBe('test.example.com');
      expect(statusRes.body.certificate.source).toBe('upload');
      expect(statusRes.body.certificate.daysRemaining).toBeGreaterThan(0);

      // Delete
      const deleteRes = await request(adminApp)
        .delete('/api/ssl/delete')
        .set(authHeader);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.deleted).toBeGreaterThan(0);

      // Verify deleted
      const statusRes2 = await request(adminApp).get('/api/ssl/status').set(authHeader);
      expect(statusRes2.body.hasCertificate).toBe(false);
    });
  });
});
