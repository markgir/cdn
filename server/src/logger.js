const winston = require('winston');
const config = require('./config');

// ── Winston logger ────────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// ── In-memory request log ring-buffer ────────────────────────────────────────
const requestLogs = [];
const MAX_LOGS = config.logging.maxRequestLogs;

function addRequestLog(entry) {
  requestLogs.unshift(entry);
  if (requestLogs.length > MAX_LOGS) {
    requestLogs.length = MAX_LOGS;
  }
}

function getRequestLogs() {
  return requestLogs;
}

// ── Express middleware ────────────────────────────────────────────────────────
function requestLogger(req, res, next) {
  const start = Date.now();
  const entry = {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    clientIp: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'] || '',
    status: null,
    duration: null,
    cacheStatus: null,
    origin: null,
    error: null,
  };

  res.on('finish', () => {
    entry.status = res.statusCode;
    entry.duration = Date.now() - start;
    entry.cacheStatus = res.getHeader('X-CDN-Cache') || 'MISS';
    entry.origin = res.getHeader('X-CDN-Origin') || null;
    addRequestLog(entry);
    logger.debug(`${entry.method} ${entry.url} ${entry.status} ${entry.duration}ms [${entry.cacheStatus}]`);
  });

  res.on('error', (err) => {
    entry.status = 500;
    entry.duration = Date.now() - start;
    entry.error = err.message;
    addRequestLog(entry);
    logger.error(`Error serving ${entry.url}: ${err.message}`);
  });

  next();
}

module.exports = { logger, requestLogger, getRequestLogs, addRequestLog };
