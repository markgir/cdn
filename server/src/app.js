// CDN Manager — Express Application Setup
// Credits: Developed by iddigital.pt

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const rateLimit = require('express-rate-limit');

const { cdnRouter } = require('./proxy');
const { adminRouter } = require('./routes/admin');
const { debugRouter } = require('./routes/debug');
const { apiRouter } = require('./routes/api');
const { imagesRouter } = require('./routes/images');
const { updateRouter } = require('./routes/update');
const { requestLogger } = require('./logger');
const config = require('./config');

// ── CDN Proxy Application ────────────────────────────────────────────────────
const cdnApp = express();
cdnApp.use(compression());
cdnApp.use(cors());
cdnApp.use(requestLogger);
cdnApp.use('/', cdnRouter);

// ── Basic Auth middleware for admin ──────────────────────────────────────────
function basicAuth(req, res, next) {
  // Skip auth when credentials are not configured (dev convenience)
  if (!config.admin.username || !config.admin.password) return next();

  const authHeader = req.headers['authorization'] || '';
  const [type, encoded] = authHeader.split(' ');
  if (type === 'Basic' && encoded) {
    const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
    if (user === config.admin.username && pass === config.admin.password) {
      return next();
    }
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="CDN Admin"');
  res.status(401).send('Authentication required.');
}

// ── Rate limiter for admin UI pages ──────────────────────────────────────────
const adminPageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Admin Backoffice Application ─────────────────────────────────────────────
const adminApp = express();
adminApp.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://cdnjs.cloudflare.com',
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://cdnjs.cloudflare.com',
      ],
      fontSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      scriptSrcAttr: ["'unsafe-inline'"],
    },
  },
}));
adminApp.use(compression());
adminApp.use(cors());
adminApp.use(express.json());
adminApp.use(express.urlencoded({ extended: true }));
adminApp.use(basicAuth);
adminApp.use(express.static(path.join(__dirname, '../../admin/public')));

// Mount routes
adminApp.use('/api', apiRouter);
adminApp.use('/api/images', imagesRouter);
adminApp.use('/api/update', updateRouter);
adminApp.use('/debug', adminPageLimiter, debugRouter);
adminApp.use('/', adminPageLimiter, adminRouter);

// 404 handler
adminApp.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
adminApp.use((err, req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

module.exports = { cdnApp, adminApp };
