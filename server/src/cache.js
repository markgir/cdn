const { LRUCache } = require('lru-cache');
const config = require('./config');
const { logger } = require('./logger');

// ── In-memory cache backed by LRU ─────────────────────────────────────────────
const cache = new LRUCache({
  max: config.cache.maxItems,
  ttl: config.cache.defaultTtl * 1000, // convert to ms
  allowStale: false,
  updateAgeOnGet: false,
});

// ── Stats ─────────────────────────────────────────────────────────────────────
const stats = {
  hits: 0,
  misses: 0,
  purges: 0,
  errors: 0,
  startTime: new Date().toISOString(),
};

function get(key) {
  const entry = cache.get(key);
  if (entry) {
    stats.hits++;
    return entry;
  }
  stats.misses++;
  return null;
}

function set(key, value, ttlSeconds) {
  const options = ttlSeconds ? { ttl: ttlSeconds * 1000 } : undefined;
  cache.set(key, value, options);
}

function del(key) {
  if (cache.has(key)) {
    cache.delete(key);
    stats.purges++;
    logger.info(`Cache purged: ${key}`);
    return true;
  }
  return false;
}

/**
 * Purge all cache entries whose key starts with the given prefix.
 * Returns the number of entries removed.
 */
function purgeByPrefix(prefix) {
  let count = 0;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      count++;
    }
  }
  stats.purges += count;
  if (count > 0) logger.info(`Purged ${count} cache entries with prefix: ${prefix}`);
  return count;
}

function flush() {
  const size = cache.size;
  cache.clear();
  stats.purges += size;
  logger.info(`Cache fully flushed (${size} entries removed)`);
  return size;
}

function getStats() {
  const hitRate = stats.hits + stats.misses > 0
    ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1)
    : '0.0';
  return {
    ...stats,
    size: cache.size,
    maxItems: config.cache.maxItems,
    defaultTtl: config.cache.defaultTtl,
    hitRate: `${hitRate}%`,
  };
}

function getKeys() {
  return [...cache.keys()];
}

/**
 * Determine whether a URL path should be cached based on its file extension.
 */
function isCacheable(urlPath) {
  const lower = urlPath.toLowerCase().split('?')[0];
  return config.cache.staticExtensions.some((ext) => lower.endsWith(ext));
}

/**
 * Build the cache key from method + origin id + URL path.
 */
function buildKey(originId, urlPath) {
  return `${originId}::${urlPath}`;
}

module.exports = { get, set, del, purgeByPrefix, flush, getStats, getKeys, isCacheable, buildKey };
