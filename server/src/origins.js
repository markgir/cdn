/**
 * Origins store
 *
 * Manages the list of upstream origin servers (WooCommerce / PrestaShop stores).
 * Persisted to a simple JSON file so origins survive restarts without a database.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('./logger');

const DATA_FILE = path.join(__dirname, '../../data/origins.json');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

let origins = [];

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      origins = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      logger.info(`Loaded ${origins.length} origins from disk`);
    }
  } catch (err) {
    logger.error(`Failed to load origins: ${err.message}`);
    origins = [];
  }
}

function save() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(origins, null, 2), 'utf8');
  } catch (err) {
    logger.error(`Failed to save origins: ${err.message}`);
  }
}

function list() {
  return origins;
}

function getById(id) {
  return origins.find((o) => o.id === id) || null;
}

/**
 * Find the origin that should handle a given request hostname.
 * Matching priority:
 *   1. Exact CDN hostname match
 *   2. First active origin with no specific CDN hostname (fallback)
 */
function resolve(host) {
  // strip port from host header
  const hostname = (host || '').split(':')[0];
  const exact = origins.find((o) => o.active && o.cdnHostname === hostname);
  if (exact) return exact;
  return origins.find((o) => o.active) || null;
}

function add({ name, originUrl, type, cdnHostname, cacheTtl }) {
  if (!name || !originUrl) throw new Error('name and originUrl are required');
  const origin = {
    id: uuidv4(),
    name: name.trim(),
    originUrl: originUrl.replace(/\/$/, ''), // strip trailing slash
    type: type || 'generic', // 'woocommerce' | 'prestashop' | 'generic'
    cdnHostname: cdnHostname ? cdnHostname.trim() : '',
    cacheTtl: cacheTtl ? parseInt(cacheTtl, 10) : null,
    active: true,
    createdAt: new Date().toISOString(),
  };
  origins.push(origin);
  save();
  logger.info(`Origin added: ${origin.name} → ${origin.originUrl}`);
  return origin;
}

function update(id, updates) {
  const idx = origins.findIndex((o) => o.id === id);
  if (idx === -1) throw new Error(`Origin ${id} not found`);
  if (updates.originUrl) updates.originUrl = updates.originUrl.replace(/\/$/, '');
  origins[idx] = { ...origins[idx], ...updates, id };
  save();
  return origins[idx];
}

function remove(id) {
  const idx = origins.findIndex((o) => o.id === id);
  if (idx === -1) throw new Error(`Origin ${id} not found`);
  const removed = origins.splice(idx, 1)[0];
  save();
  logger.info(`Origin removed: ${removed.name}`);
  return removed;
}

// Load on startup
load();

module.exports = { list, getById, resolve, add, update, remove };
