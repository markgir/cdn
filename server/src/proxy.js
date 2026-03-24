/**
 * CDN Reverse-Proxy Router
 *
 * Handles incoming requests:
 *  1. Checks in-memory cache for cacheable assets → serves HIT immediately.
 *  2. Resolves the upstream origin for the request Host header.
 *  3. Proxies the request to the origin, caches the response when appropriate.
 *
 * Credits: Developed by iddigital.pt
 */

const express = require('express');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const mime = require('mime-types');
const config = require('./config');
const cache = require('./cache');
const origins = require('./origins');
const { logger, addRequestLog } = require('./logger');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function pickTransport(protocol) {
  return protocol === 'https:' ? https : http;
}

function isCacheableResponse(res, urlPath) {
  if (!cache.isCacheable(urlPath)) return false;
  const cc = res.headers['cache-control'] || '';
  if (cc.includes('no-store') || cc.includes('private')) return false;
  return true;
}

// ── Proxy handler ─────────────────────────────────────────────────────────────

router.all('*', (req, res) => {
  const origin = origins.resolve(req.headers.host);

  if (!origin) {
    res.setHeader('X-CDN-Cache', 'NO-ORIGIN');
    return res.status(502).json({
      error: 'No active CDN origin configured for this hostname.',
      hint: 'Add an origin in the Admin panel.',
    });
  }

  const cacheKey = cache.buildKey(origin.id, req.url);
  res.setHeader('X-CDN-Origin', origin.name);

  // ── Cache HIT ──────────────────────────────────────────────────────────────
  if (req.method === 'GET' || req.method === 'HEAD') {
    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-CDN-Cache', 'HIT');
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('X-Cache-Age', cached.storedAt ? String(Math.floor((Date.now() - cached.storedAt) / 1000)) : '0');
      Object.entries(cached.headers || {}).forEach(([k, v]) => {
        if (!['transfer-encoding', 'connection'].includes(k.toLowerCase())) {
          res.setHeader(k, v);
        }
      });
      res.status(cached.status);
      if (req.method === 'HEAD') return res.end();
      return res.end(cached.body);
    }
  }

  res.setHeader('X-CDN-Cache', 'MISS');

  // ── Proxy to origin ────────────────────────────────────────────────────────
  let targetUrl;
  try {
    targetUrl = new URL(req.url, origin.originUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid request URL' });
  }

  const proxyOptions = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: targetUrl.hostname,
      'X-Forwarded-For': req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      'X-Forwarded-Host': req.headers.host,
      'X-CDN-Request': '1',
    },
    timeout: config.proxy.timeout,
  };

  const transport = pickTransport(targetUrl.protocol);

  const proxyReq = transport.request(proxyOptions, (proxyRes) => {
    const chunks = [];

    proxyRes.on('data', (chunk) => chunks.push(chunk));

    proxyRes.on('end', () => {
      const body = Buffer.concat(chunks);
      const contentType = proxyRes.headers['content-type'] || mime.lookup(req.url) || 'application/octet-stream';

      // Forward headers to client
      Object.entries(proxyRes.headers).forEach(([k, v]) => {
        if (!['transfer-encoding', 'connection'].includes(k.toLowerCase())) {
          res.setHeader(k, v);
        }
      });
      res.setHeader('X-CDN-Cache', 'MISS');
      res.setHeader('X-CDN-Origin', origin.name);

      // Store in cache if eligible
      if (
        (req.method === 'GET' || req.method === 'HEAD') &&
        proxyRes.statusCode < 400 &&
        isCacheableResponse(proxyRes, req.url)
      ) {
        const ttl = origin.cacheTtl || config.cache.defaultTtl;
        cache.set(cacheKey, {
          status: proxyRes.statusCode,
          contentType,
          headers: proxyRes.headers,
          body,
          storedAt: Date.now(),
        }, ttl);
        res.setHeader('X-CDN-Cache', 'MISS-STORED');
      }

      res.status(proxyRes.statusCode);
      if (req.method === 'HEAD') return res.end();
      res.end(body);
    });
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    logger.error(`Proxy timeout for ${req.url} → ${origin.originUrl}`);
    cache.getStats().errors++;
    if (!res.headersSent) {
      res.status(504).json({ error: 'Gateway Timeout: origin did not respond in time.' });
    }
  });

  proxyReq.on('error', (err) => {
    logger.error(`Proxy error for ${req.url}: ${err.message}`);
    if (!res.headersSent) {
      res.status(502).json({ error: `Bad Gateway: ${err.message}` });
    }
  });

  // Forward request body for POST/PUT/PATCH
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
});

module.exports = { cdnRouter: router };
