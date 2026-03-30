/**
 * In-Process TTL Cache Middleware
 *
 * Pattern: Read-Through Cache with TTL expiry.
 *
 * Why it reduces load: Read-heavy endpoints that return stable data (holidays,
 * branches, departments) are fetched from the DB on every request. With a
 * TTL cache, warm serverless containers serve subsequent GETs from memory —
 * zero DB round-trips until the TTL expires.
 *
 * Self-healing: TTL-based auto-expiry means stale entries are never served
 * indefinitely. On entry expiry the next request re-fetches from the DB and
 * re-populates the cache. No manual invalidation is needed for time-bounded
 * data. For mutation-sensitive data, call invalidateCache(prefix) from the
 * write routes (see withCacheInvalidation helper below).
 *
 * Horizontal scaling note: Each serverless instance has its own Map. This is
 * intentional — the cache is a "hot-path" optimisation per-instance, not a
 * shared distributed cache. For true cross-instance consistency a Redis layer
 * would be needed, but for 34 users on a single Neon DB the per-instance
 * Map is simpler, cheaper, and sufficient.
 */

const store = new Map(); // key → { data, expiresAt }

/**
 * Read a value from cache. Returns null on miss or expiry.
 */
function getCached(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Write a value to cache with a TTL in seconds.
 */
function setCached(key, data, ttlSeconds) {
  store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/**
 * Invalidate all cache entries whose key starts with the given prefix.
 * Call this from write handlers after mutations.
 * e.g. invalidateCache('/api/branches') after creating/editing a branch.
 */
function invalidateCache(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/**
 * Express middleware factory.
 * Only caches successful (200) GET responses.
 * Non-GET methods pass through immediately.
 *
 * Usage in app.js (before the route registration):
 *   app.use('/api/holidays', withCache(3600));
 *   app.use('/api/branches', withCache(600));
 */
function withCache(ttlSeconds = 300) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next();

    const key = req.originalUrl; // includes path + query string
    const hit = getCached(key);

    if (hit) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(hit);
    }

    // Intercept res.json to store successful responses
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode === 200) {
        setCached(key, data, ttlSeconds);
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(data);
    };

    next();
  };
}

/**
 * Returns current cache stats (for health endpoint).
 */
function getCacheStats() {
  const now = Date.now();
  let live = 0, expired = 0;
  for (const entry of store.values()) {
    if (now > entry.expiresAt) expired++;
    else live++;
  }
  return { total: store.size, live, expired };
}

module.exports = { withCache, getCached, setCached, invalidateCache, getCacheStats };
