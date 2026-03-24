const cache = require('../src/cache');

describe('Cache module', () => {
  beforeEach(() => {
    cache.flush();
  });

  test('set and get a value', () => {
    cache.set('test::key', { body: Buffer.from('hello'), status: 200 });
    const val = cache.get('test::key');
    expect(val).toBeTruthy();
    expect(val.status).toBe(200);
  });

  test('returns null for missing key', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  test('del removes a key', () => {
    cache.set('del::key', { body: Buffer.from('x') });
    expect(cache.del('del::key')).toBe(true);
    expect(cache.get('del::key')).toBeNull();
  });

  test('del returns false for missing key', () => {
    expect(cache.del('nope')).toBe(false);
  });

  test('purgeByPrefix removes matching keys', () => {
    cache.set('abc::1', { v: 1 });
    cache.set('abc::2', { v: 2 });
    cache.set('xyz::1', { v: 3 });
    const count = cache.purgeByPrefix('abc::');
    expect(count).toBe(2);
    expect(cache.get('abc::1')).toBeNull();
    expect(cache.get('xyz::1')).not.toBeNull();
  });

  test('flush clears all entries', () => {
    cache.set('a', { v: 1 });
    cache.set('b', { v: 2 });
    const removed = cache.flush();
    expect(removed).toBeGreaterThanOrEqual(2);
    expect(cache.get('a')).toBeNull();
  });

  test('getStats includes hits and misses', () => {
    cache.set('s::key', { v: 1 });
    cache.get('s::key');        // hit
    cache.get('s::missing');    // miss
    const stats = cache.getStats();
    expect(stats.hits).toBeGreaterThanOrEqual(1);
    expect(stats.misses).toBeGreaterThanOrEqual(1);
    expect(stats).toHaveProperty('hitRate');
  });

  test('isCacheable identifies static extensions', () => {
    expect(cache.isCacheable('/style.css')).toBe(true);
    expect(cache.isCacheable('/app.js')).toBe(true);
    expect(cache.isCacheable('/logo.png')).toBe(true);
    expect(cache.isCacheable('/api/data')).toBe(false);
    expect(cache.isCacheable('/checkout')).toBe(false);
  });

  test('buildKey combines originId and urlPath', () => {
    const key = cache.buildKey('origin-1', '/style.css?v=1');
    expect(key).toBe('origin-1::/style.css?v=1');
  });

  test('getKeys returns stored keys', () => {
    cache.set('k::1', { v: 1 });
    cache.set('k::2', { v: 2 });
    const keys = cache.getKeys();
    expect(keys).toContain('k::1');
    expect(keys).toContain('k::2');
  });
});
