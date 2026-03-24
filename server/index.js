require('dotenv').config();

const app = require('./src/app');
const { logger } = require('./src/logger');

const CDN_PORT = parseInt(process.env.CDN_PORT || '3000', 10);
const ADMIN_PORT = parseInt(process.env.ADMIN_PORT || '3001', 10);

// Start CDN proxy server
const cdnServer = app.cdnApp.listen(CDN_PORT, () => {
  logger.info(`CDN Proxy Server running on port ${CDN_PORT}`);
});

// Start Admin server
const adminServer = app.adminApp.listen(ADMIN_PORT, () => {
  logger.info(`Admin Backoffice running on port ${ADMIN_PORT}`);
  logger.info(`Open http://localhost:${ADMIN_PORT} to access the admin panel`);
  logger.info(`Open http://localhost:${ADMIN_PORT}/debug to access the debug page`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  cdnServer.close(() => {
    adminServer.close(() => {
      logger.info('Servers closed.');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down...');
  cdnServer.close(() => {
    adminServer.close(() => {
      process.exit(0);
    });
  });
});

module.exports = { cdnServer, adminServer };
