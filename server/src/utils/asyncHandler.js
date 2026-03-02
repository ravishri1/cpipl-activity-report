/**
 * Wraps an async route handler to catch errors automatically.
 * Eliminates try-catch from every route handler — errors flow to errorHandler middleware.
 *
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }));
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { asyncHandler };
