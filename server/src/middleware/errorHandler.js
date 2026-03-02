/**
 * Global Express error handler middleware.
 * Registered AFTER all routes in app.js: app.use(errorHandler)
 *
 * Handles:
 * - HttpError (from utils/httpErrors.js) → custom status + message
 * - Prisma P2002 (unique constraint) → 409
 * - Prisma P2025 (record not found) → 404
 * - Unknown errors → 500 with console.error
 */

function errorHandler(err, req, res, _next) {
  // Custom HttpError (thrown via badRequest, notFound, etc.)
  if (err.name === 'HttpError' && err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'field';
    return res.status(409).json({ error: `Duplicate value for ${field}.` });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found.' });
  }

  // Prisma foreign key constraint
  if (err.code === 'P2003') {
    return res.status(400).json({ error: 'Referenced record does not exist.' });
  }

  // Validation errors with message (e.g., throw new Error('Name required'))
  if (err.message && !err.status && err.name !== 'PrismaClientKnownRequestError') {
    // Only use 400 for plain Error objects that look like validation messages
    if (err.name === 'Error' && err.message.length < 200) {
      return res.status(400).json({ error: err.message });
    }
  }

  // Unknown server error
  console.error(`${req.method} ${req.originalUrl} error:`, err);
  res.status(500).json({ error: 'Server error.' });
}

module.exports = { errorHandler };
