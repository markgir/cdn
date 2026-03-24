// CDN Manager — Image Generation Tests
// Credits: Developed by iddigital.pt

const request = require('supertest');
const { adminApp } = require('../src/app');
const { buildSvg, sanitizeColor, sanitizeText, escXml } = require('../src/routes/images');

// Default credentials from config defaults
const AUTH = Buffer.from('admin:changeme').toString('base64');
const authHeader = { Authorization: `Basic ${AUTH}` };

describe('Image generation API', () => {
  describe('POST /api/images/generate', () => {
    it('returns SVG with default dimensions', async () => {
      const res = await request(adminApp)
        .post('/api/images/generate')
        .set(authHeader)
        .send({})
        .buffer(true)
        .parse((res, cb) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => cb(null, data));
        });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/svg\+xml/);
      expect(res.body).toContain('<svg');
      expect(res.body).toContain('600');
      expect(res.body).toContain('400');
    });

    it('returns SVG with custom dimensions and text', async () => {
      const res = await request(adminApp)
        .post('/api/images/generate')
        .set(authHeader)
        .send({ width: 800, height: 600, text: 'Hello', bgColor: '#ff0000', textColor: '#ffffff' })
        .buffer(true)
        .parse((res, cb) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => cb(null, data));
        });
      expect(res.status).toBe(200);
      expect(res.body).toContain('width="800"');
      expect(res.body).toContain('height="600"');
      expect(res.body).toContain('Hello');
      expect(res.body).toContain('#ff0000');
      expect(res.body).toContain('#ffffff');
    });

    it('returns base64 format when requested', async () => {
      const res = await request(adminApp)
        .post('/api/images/generate')
        .set(authHeader)
        .send({ width: 100, height: 100, format: 'base64' });
      expect(res.status).toBe(200);
      expect(res.body.format).toBe('base64');
      expect(res.body.mimeType).toBe('image/svg+xml');
      expect(res.body.data).toMatch(/^data:image\/svg\+xml;base64,/);
      expect(res.body.width).toBe(100);
      expect(res.body.height).toBe(100);
    });

    it('clamps dimensions to valid range', async () => {
      const res = await request(adminApp)
        .post('/api/images/generate')
        .set(authHeader)
        .send({ width: 99999, height: -10, format: 'base64' });
      expect(res.status).toBe(200);
      expect(res.body.width).toBe(4096);
      expect(res.body.height).toBe(1);
    });

    it('returns 401 without credentials', async () => {
      const res = await request(adminApp)
        .post('/api/images/generate')
        .send({});
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/images/preview', () => {
    it('returns SVG image with query params', async () => {
      const res = await request(adminApp)
        .get('/api/images/preview?width=300&height=200&bgColor=%23336699&text=Test')
        .set(authHeader)
        .buffer(true)
        .parse((res, cb) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => cb(null, data));
        });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/svg\+xml/);
      expect(res.body).toContain('width="300"');
      expect(res.body).toContain('height="200"');
      expect(res.body).toContain('Test');
    });

    it('returns default SVG without params', async () => {
      const res = await request(adminApp)
        .get('/api/images/preview')
        .set(authHeader)
        .buffer(true)
        .parse((res, cb) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => cb(null, data));
        });
      expect(res.status).toBe(200);
      expect(res.body).toContain('<svg');
    });
  });

  describe('buildSvg helper', () => {
    it('builds valid SVG with defaults', () => {
      const svg = buildSvg({});
      expect(svg).toContain('<svg');
      expect(svg).toContain('width="600"');
      expect(svg).toContain('height="400"');
      expect(svg).toContain('600 × 400');
    });

    it('uses custom text', () => {
      const svg = buildSvg({ text: 'Custom' });
      expect(svg).toContain('Custom');
    });

    it('escapes XML in text', () => {
      const svg = buildSvg({ text: '<script>' });
      expect(svg).not.toContain('<script>');
      expect(svg).toContain('&lt;script&gt;');
    });
  });

  describe('sanitizeColor', () => {
    it('accepts valid hex colors', () => {
      expect(sanitizeColor('#fff')).toBe('#fff');
      expect(sanitizeColor('#ff0000')).toBe('#ff0000');
    });

    it('accepts named colors', () => {
      expect(sanitizeColor('red')).toBe('red');
      expect(sanitizeColor('blue')).toBe('blue');
    });

    it('rejects invalid values', () => {
      expect(sanitizeColor('javascript:alert(1)')).toBeNull();
      expect(sanitizeColor('')).toBeNull();
      expect(sanitizeColor(null)).toBeNull();
    });
  });

  describe('sanitizeText', () => {
    it('truncates long text', () => {
      const long = 'a'.repeat(300);
      expect(sanitizeText(long).length).toBe(200);
    });

    it('returns null for empty', () => {
      expect(sanitizeText('')).toBeNull();
      expect(sanitizeText(null)).toBeNull();
    });
  });

  describe('escXml', () => {
    it('escapes special characters', () => {
      expect(escXml('<&>"\'test')).toBe('&lt;&amp;&gt;&quot;&apos;test');
    });
  });
});
