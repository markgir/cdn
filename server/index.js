// CDN Manager — Server Entry Point
// Credits: Developed by iddigital.pt

require('dotenv').config();

const http = require('http');
const https = require('https');
const app = require('./src/app');
const { logger } = require('./src/logger');
const ssl = require('./src/ssl');
const config = require('./src/config');

const CDN_PORT = parseInt(process.env.CDN_PORT || '3000', 10);
const ADMIN_PORT = parseInt(process.env.ADMIN_PORT || '3001', 10);

// ── Start CDN server(s) ─────────────────────────────────────────────────────

let cdnServer;
let cdnHttpRedirectServer;

if (config.ssl.enabled && ssl.hasCertificate()) {
  // Start HTTPS CDN server
  const creds = ssl.loadCertificate();
  const sslPort = config.ssl.port;
  cdnServer = https.createServer({ cert: creds.cert, key: creds.key, ca: creds.ca }, app.cdnApp);
  cdnServer.listen(sslPort, () => {
    logger.info(`CDN Proxy Server (HTTPS) running on port ${sslPort}`);
  });

  // Start HTTP server for ACME challenges and redirect to HTTPS
  const httpPort = config.ssl.httpRedirectPort;
  cdnHttpRedirectServer = http.createServer(app.cdnApp);
  cdnHttpRedirectServer.listen(httpPort, () => {
    logger.info(`CDN HTTP redirect server running on port ${httpPort} → HTTPS:${sslPort}`);
  });

  // Start auto-renewal
  if (config.ssl.autoRenew) {
    ssl.startAutoRenewal();
  }
} else {
  // Start plain HTTP CDN server
  cdnServer = app.cdnApp.listen(CDN_PORT, () => {
    logger.info(`CDN Proxy Server running on port ${CDN_PORT}`);
    if (config.ssl.enabled && !ssl.hasCertificate()) {
      logger.warn('SSL is enabled but no certificate found. Run certificate setup from admin panel.');
    }
  });
}

// Start Admin server
const adminServer = app.adminApp.listen(ADMIN_PORT, () => {
  logger.info(`Admin Backoffice running on port ${ADMIN_PORT}`);
  logger.info(`Open http://localhost:${ADMIN_PORT} to access the admin panel`);
  logger.info(`Open http://localhost:${ADMIN_PORT}/debug to access the debug page`);
});

// Graceful shutdown
function shutdown(signal) {
  logger.info(signal + ' received. Shutting down gracefully...');
  ssl.stopAutoRenewal();
  cdnServer.close(() => {
    if (cdnHttpRedirectServer) {
      cdnHttpRedirectServer.close(() => {
        adminServer.close(() => {
          logger.info('Servers closed.');
          process.exit(0);
        });
      });
    } else {
      adminServer.close(() => {
        logger.info('Servers closed.');
        process.exit(0);
      });
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { cdnServer, adminServer };
