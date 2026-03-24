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
});
