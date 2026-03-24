/**
 * REST API routes for the Admin Backoffice.
 *
 * Endpoints:
 *   GET  /api/status          – server health + cache stats
 *   GET  /api/origins         – list all origins
 *   POST /api/origins         – add an origin
 *   PUT  /api/origins/:id     – update an origin
 *   DELETE /api/origins/:id   – remove an origin
 *   POST /api/cache/purge     – purge by key or prefix
 *   POST /api/cache/flush     – flush entire cache
 *   GET  /api/cache/stats     – cache statistics
 *   GET  /api/cache/keys      – list cache keys
 *   GET  /api/logs            – recent request logs
 *   POST /api/origins/:id/test – test connectivity to origin
 *
 * Credits: Developed by iddigital.pt
 */

const express = require('express');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const cache = require('../cache');
const origins = require('../origins');
const { getRequestLogs } = require('../logger');

const router = express.Router();

// ── Status ────────────────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  const uptime = process.uptime();
  res.json({
    status: 'ok',
    uptime: Math.floor(uptime),
    uptimeHuman: formatUptime(uptime),
    cache: cache.getStats(),
    origins: origins.list().length,
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
  });
});

// ── Origins ───────────────────────────────────────────────────────────────────
router.get('/origins', (req, res) => {
  res.json(origins.list());
});

router.post('/origins', (req, res) => {
  try {
    const origin = origins.add(req.body);
    res.status(201).json(origin);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/origins/:id', (req, res) => {
  try {
    const origin = origins.update(req.params.id, req.body);
    res.json(origin);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.delete('/origins/:id', (req, res) => {
  try {
    const removed = origins.remove(req.params.id);
    res.json({ message: 'Origin removed', origin: removed });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ── Origin connectivity test ──────────────────────────────────────────────────
router.post('/origins/:id/test', (req, res) => {
  const origin = origins.getById(req.params.id);
  if (!origin) return res.status(404).json({ error: 'Origin not found' });

  let targetUrl;
  try {
    targetUrl = new URL(origin.originUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid origin URL' });
  }

  const start = Date.now();
  const transport = targetUrl.protocol === 'https:' ? https : http;

  const testReq = transport.request(
    {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: '/',
      method: 'HEAD',
      timeout: 10000,
    },
    (testRes) => {
      testRes.resume();
      const latency = Date.now() - start;
      res.json({
        reachable: true,
        statusCode: testRes.statusCode,
        latencyMs: latency,
        server: testRes.headers['server'] || null,
        powered_by: testRes.headers['x-powered-by'] || null,
      });
    }
  );

  testReq.on('timeout', () => {
    testReq.destroy();
    res.json({ reachable: false, error: 'Connection timed out', latencyMs: Date.now() - start });
  });

  testReq.on('error', (err) => {
    res.json({ reachable: false, error: err.message, latencyMs: Date.now() - start });
  });

  testReq.end();
});

// ── Cache ─────────────────────────────────────────────────────────────────────
router.get('/cache/stats', (req, res) => {
  res.json(cache.getStats());
});

router.get('/cache/keys', (req, res) => {
  const { prefix, limit = 200 } = req.query;
  let keys = cache.getKeys();
  if (prefix) keys = keys.filter((k) => k.includes(prefix));
  res.json({ total: keys.length, keys: keys.slice(0, parseInt(limit, 10)) });
});

router.post('/cache/purge', (req, res) => {
  const { key, prefix } = req.body;
  if (key) {
    const deleted = cache.del(key);
    return res.json({ purged: deleted ? 1 : 0, key });
  }
  if (prefix) {
    const count = cache.purgeByPrefix(prefix);
    return res.json({ purged: count, prefix });
  }
  res.status(400).json({ error: 'Provide key or prefix to purge.' });
});

router.post('/cache/flush', (req, res) => {
  const count = cache.flush();
  res.json({ flushed: count, message: `Flushed ${count} cache entries.` });
});

// ── Request logs ──────────────────────────────────────────────────────────────
router.get('/logs', (req, res) => {
  const { limit = 100, status, cacheStatus } = req.query;
  let logs = getRequestLogs();
  if (status) logs = logs.filter((l) => String(l.status) === String(status));
  if (cacheStatus) logs = logs.filter((l) => (l.cacheStatus || '').includes(cacheStatus));
  res.json({ total: logs.length, logs: logs.slice(0, parseInt(limit, 10)) });
});

// ── System Info ──────────────────────────────────────────────────────────────
router.get('/system', (req, res) => {
  const config = require('../config');
  const os = require('os');
  res.json({
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    cpus: os.cpus().length,
    totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
    freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
    processMemoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    uptime: Math.floor(process.uptime()),
    uptimeHuman: formatUptime(process.uptime()),
    loadAvg: os.loadavg().map(l => l.toFixed(2)),
    config: {
      cdnPort: config.cdn.port,
      adminPort: config.admin.port,
      cacheTtl: config.cache.defaultTtl,
      cacheMaxItems: config.cache.maxItems,
      proxyTimeout: config.proxy.timeout,
      logLevel: config.logging.level,
    },
  });
});

// ── Export / Import Origins ──────────────────────────────────────────────────
router.get('/origins/export', (req, res) => {
  const data = origins.list();
  res.setHeader('Content-Disposition', 'attachment; filename="origins-backup.json"');
  res.setHeader('Content-Type', 'application/json');
  res.json({ version: 1, exportedAt: new Date().toISOString(), origins: data });
});

router.post('/origins/import', (req, res) => {
  const { origins: importedOrigins } = req.body;
  if (!Array.isArray(importedOrigins)) {
    return res.status(400).json({ error: 'Invalid import data. Expected { origins: [...] }' });
  }
  let added = 0;
  let skipped = 0;
  for (const o of importedOrigins) {
    try {
      origins.add({
        name: o.name,
        originUrl: o.originUrl,
        type: o.type,
        cdnHostname: o.cdnHostname,
        cacheTtl: o.cacheTtl,
      });
      added++;
    } catch {
      skipped++;
    }
  }
  res.json({ added, skipped, message: `Imported ${added} origin(s), skipped ${skipped}.` });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}

module.exports = { apiRouter: router };
