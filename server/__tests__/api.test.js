const request = require('supertest');
const { adminApp } = require('../src/app');

// Default credentials from config defaults
const AUTH = Buffer.from('admin:changeme').toString('base64');
const authHeader = { Authorization: `Basic ${AUTH}` };

describe('Admin API routes', () => {
  describe('GET /api/status', () => {
    it('returns status ok with cache and uptime', async () => {
      const res = await request(adminApp).get('/api/status').set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('cache');
      expect(res.body.cache).toHaveProperty('hits');
      expect(res.body.cache).toHaveProperty('misses');
      expect(res.body.cache).toHaveProperty('hitRate');
    });

    it('returns 401 without credentials', async () => {
      const res = await request(adminApp).get('/api/status');
      expect(res.status).toBe(401);
    });
  });

  describe('Origins CRUD', () => {
    let createdId;

    it('GET /api/origins returns array', async () => {
      const res = await request(adminApp).get('/api/origins').set(authHeader);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/origins creates an origin', async () => {
      const res = await request(adminApp)
        .post('/api/origins')
        .set(authHeader)
        .send({ name: 'Test Store', originUrl: 'http://example.com', type: 'woocommerce' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test Store');
      expect(res.body.id).toBeTruthy();
      createdId = res.body.id;
    });

    it('POST /api/origins rejects missing name', async () => {
      const res = await request(adminApp)
        .post('/api/origins')
        .set(authHeader)
        .send({ originUrl: 'http://example.com' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    it('PUT /api/origins/:id updates an origin', async () => {
      const res = await request(adminApp)
        .put('/api/origins/' + createdId)
        .set(authHeader)
        .send({ name: 'Updated Store' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Store');
    });

    it('DELETE /api/origins/:id removes origin', async () => {
      const res = await request(adminApp)
        .delete('/api/origins/' + createdId)
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.origin.id).toBe(createdId);
    });

    it('DELETE /api/origins/:id returns 404 for unknown id', async () => {
      const res = await request(adminApp)
        .delete('/api/origins/nonexistent-id-123')
        .set(authHeader);
      expect(res.status).toBe(404);
    });
  });

  describe('Cache API', () => {
    it('GET /api/cache/stats returns stats', async () => {
      const res = await request(adminApp).get('/api/cache/stats').set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('hits');
      expect(res.body).toHaveProperty('size');
    });

    it('GET /api/cache/keys returns keys array', async () => {
      const res = await request(adminApp).get('/api/cache/keys').set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('keys');
      expect(Array.isArray(res.body.keys)).toBe(true);
    });

    it('POST /api/cache/flush returns flushed count', async () => {
      const res = await request(adminApp)
        .post('/api/cache/flush')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('flushed');
    });

    it('POST /api/cache/purge with key returns purged count', async () => {
      const res = await request(adminApp)
        .post('/api/cache/purge')
        .set(authHeader)
        .send({ key: 'nonexistent::key' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('purged');
    });

    it('POST /api/cache/purge without key or prefix returns 400', async () => {
      const res = await request(adminApp)
        .post('/api/cache/purge')
        .set(authHeader)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('Logs API', () => {
    it('GET /api/logs returns logs array', async () => {
      const res = await request(adminApp).get('/api/logs').set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('logs');
      expect(Array.isArray(res.body.logs)).toBe(true);
    });
  });

  describe('System Info API', () => {
    it('GET /api/system returns system information', async () => {
      const res = await request(adminApp).get('/api/system').set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('node');
      expect(res.body).toHaveProperty('platform');
      expect(res.body).toHaveProperty('arch');
      expect(res.body).toHaveProperty('hostname');
      expect(res.body).toHaveProperty('cpus');
      expect(res.body).toHaveProperty('totalMemoryMB');
      expect(res.body).toHaveProperty('freeMemoryMB');
      expect(res.body).toHaveProperty('processMemoryMB');
      expect(res.body).toHaveProperty('heapUsedMB');
      expect(res.body).toHaveProperty('heapTotalMB');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('uptimeHuman');
      expect(res.body).toHaveProperty('loadAvg');
      expect(res.body).toHaveProperty('config');
      expect(res.body.config).toHaveProperty('cdnPort');
      expect(res.body.config).toHaveProperty('adminPort');
      expect(res.body.config).toHaveProperty('cacheTtl');
      expect(res.body.config).toHaveProperty('cacheMaxItems');
    });

    it('returns 401 without credentials', async () => {
      const res = await request(adminApp).get('/api/system');
      expect(res.status).toBe(401);
    });
  });

  describe('Origins Export/Import API', () => {
    it('GET /api/origins/export returns export data', async () => {
      const res = await request(adminApp).get('/api/origins/export').set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('version', 1);
      expect(res.body).toHaveProperty('exportedAt');
      expect(res.body).toHaveProperty('origins');
      expect(Array.isArray(res.body.origins)).toBe(true);
    });

    it('POST /api/origins/import adds origins from payload', async () => {
      const res = await request(adminApp)
        .post('/api/origins/import')
        .set(authHeader)
        .send({
          origins: [
            { name: 'Import Test', originUrl: 'http://import.test', type: 'generic' },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('added', 1);
      expect(res.body).toHaveProperty('skipped', 0);

      // Clean up
      const listRes = await request(adminApp).get('/api/origins').set(authHeader);
      const imported = listRes.body.find((o) => o.name === 'Import Test');
      if (imported) {
        await request(adminApp).delete('/api/origins/' + imported.id).set(authHeader);
      }
    });

    it('POST /api/origins/import rejects invalid data', async () => {
      const res = await request(adminApp)
        .post('/api/origins/import')
        .set(authHeader)
        .send({ origins: 'not-an-array' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});
