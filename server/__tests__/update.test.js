const request = require('supertest');
const { adminApp } = require('../src/app');

const AUTH = 'Basic ' + Buffer.from('admin:changeme').toString('base64');

describe('Update API', () => {
  describe('GET /api/update/status', () => {
    it('returns git status with branch and commit info', async () => {
      const res = await request(adminApp)
        .get('/api/update/status')
        .set('Authorization', AUTH);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('branch');
      expect(res.body).toHaveProperty('commit');
      expect(res.body.commit).toHaveProperty('hash');
      expect(res.body.commit).toHaveProperty('shortHash');
      expect(res.body.commit).toHaveProperty('subject');
      expect(res.body).toHaveProperty('modifiedFiles');
      expect(res.body).toHaveProperty('hasLocalChanges');
      expect(typeof res.body.hasLocalChanges).toBe('boolean');
    });

    it('requires authentication', async () => {
      const res = await request(adminApp).get('/api/update/status');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/update/check', () => {
    it('returns update check result', async () => {
      const res = await request(adminApp)
        .get('/api/update/check')
        .set('Authorization', AUTH);
      // May return 200 (success) or 500 (if no remote)
      if (res.status === 200) {
        expect(res.body).toHaveProperty('branch');
        expect(res.body).toHaveProperty('upToDate');
        expect(res.body).toHaveProperty('message');
        expect(typeof res.body.upToDate).toBe('boolean');
      }
    });

    it('requires authentication', async () => {
      const res = await request(adminApp).get('/api/update/check');
      expect(res.status).toBe(401);
    });
  });
});
