/**
 * Throwable HTTP error helpers for clean route code.
 * Usage: throw notFound('Asset') → 404 { error: 'Asset not found.' }
 * Usage: throw badRequest('Name is required.') → 400 { error: 'Name is required.' }
 *
 * These are caught by errorHandler middleware in middleware/errorHandler.js.
 */

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

const badRequest = (msg = 'Bad request.') => new HttpError(400, msg);
const unauthorized = (msg = 'Unauthorized.') => new HttpError(401, msg);
const forbidden = (msg = 'Access denied.') => new HttpError(403, msg);
const notFound = (entity = 'Resource') => new HttpError(404, `${entity} not found.`);
const conflict = (msg = 'Conflict.') => new HttpError(409, msg);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict };
