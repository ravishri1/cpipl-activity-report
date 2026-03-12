/**
 * Global Express error handler middleware.
 * Registered AFTER all routes in app.js: app.use(errorHandler)
 *
 * Handles:
 * - HttpError (from utils/httpErrors.js) → custom status + message
 * - Prisma P2002 (unique constraint) → 409
 * - Prisma P2025 (record not found) → 404
 * - Prisma P2003 (foreign key constraint) → 400
 * - Unknown errors → 500 with structured console.error
 */

function logError(req, statusCode, err) {
  const timestamp = new Date().toISOString();
  const userId = req.user?.id || 'anonymous';
  const method = req.method;
  const url = req.originalUrl;

  // Structured log for monitoring/debugging
  const logEntry = {
    timestamp,
    level: statusCode >= 500 ? 'ERROR' : 'WARN',
    status: statusCode,
    method,
    url,
    userId,
    errorName: err.name || 'Error',
    errorMessage: err.message || 'Unknown error',
  };

  // Include request body for non-GET mutating requests (redact sensitive fields)
  if (method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
    const safeBody = { ...req.body };
    // Redact sensitive fields
    const redactKeys = ['password', 'token', 'secret', 'aadhaarNumber', 'panNumber', 'bankAccountNumber', 'bankIfscCode'];
    for (const key of redactKeys) {
      if (safeBody[key]) safeBody[key] = '[REDACTED]';
    }
    logEntry.body = safeBody;
  }

  // Include Prisma error code if present
  if (err.code) logEntry.prismaCode = err.code;

  // Log stack trace only for 500s
  if (statusCode >= 500) {
    console.error(`[${timestamp}] ${method} ${url} [${statusCode}] user=${userId}:`, err);
  } else {
    console.warn(`[${timestamp}] ${method} ${url} [${statusCode}] user=${userId}: ${err.message}`);
  }
}

function errorHandler(err, req, res, _next) {
  // Custom HttpError (thrown via badRequest, notFound, etc.)
  if (err.name === 'HttpError' && err.status) {
    logError(req, err.status, err);
    return res.status(err.status).json({ error: err.message });
  }

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'field';
    logError(req, 409, err);
    return res.status(409).json({ error: `Duplicate value for ${field}.` });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    logError(req, 404, err);
    return res.status(404).json({ error: 'Record not found.' });
  }

  // Prisma foreign key constraint
  if (err.code === 'P2003') {
    logError(req, 400, err);
    return res.status(400).json({ error: 'Referenced record does not exist.' });
  }

  // Validation errors with message (e.g., throw new Error('Name required'))
  if (err.message && !err.status && err.name !== 'PrismaClientKnownRequestError') {
    // Only use 400 for plain Error objects that look like validation messages
    if (err.name === 'Error' && err.message.length < 200) {
      logError(req, 400, err);
      return res.status(400).json({ error: err.message });
    }
  }

  // Unknown server error
  logError(req, 500, err);
  res.status(500).json({ error: 'Server error.' });
}

module.exports = { errorHandler };
