/**
 * CDN Configuration
 * Loaded from environment variables with sensible defaults.
 */

const config = {
  cdn: {
    port: parseInt(process.env.CDN_PORT || '3000', 10),
    host: process.env.CDN_HOST || '0.0.0.0',
  },
  admin: {
    port: parseInt(process.env.ADMIN_PORT || '3001', 10),
    username: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASS || 'changeme',
    secret: process.env.ADMIN_SECRET || 'cdn-admin-secret-key',
  },
  cache: {
    /** Default TTL for cached responses in seconds */
    defaultTtl: parseInt(process.env.CACHE_TTL || '3600', 10),
    /** Maximum number of entries in the in-memory cache */
    maxItems: parseInt(process.env.CACHE_MAX_ITEMS || '10000', 10),
    /** Static-asset extensions that are always cached */
    staticExtensions: [
      '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp',
      '.svg', '.woff', '.woff2', '.ttf', '.eot', '.ico',
      '.mp4', '.webm', '.pdf',
    ],
  },
  proxy: {
    /** Follow redirects from origin servers */
    followRedirects: process.env.PROXY_FOLLOW_REDIRECTS !== 'false',
    /** Forward the original client IP via X-Forwarded-For */
    xfwd: process.env.PROXY_XFWD !== 'false',
    /** Timeout in ms for upstream requests */
    timeout: parseInt(process.env.PROXY_TIMEOUT || '30000', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    /** Keep the last N request log entries in memory for the debug panel */
    maxRequestLogs: parseInt(process.env.MAX_REQUEST_LOGS || '1000', 10),
  },
};

module.exports = config;
