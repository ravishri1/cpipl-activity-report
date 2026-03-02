/**
 * Shared validation helpers for route handlers.
 * Throw HttpError on failure — caught by errorHandler middleware.
 *
 * Usage:
 *   requireFields(req.body, 'name', 'type');
 *   requireEnum(status, ['active', 'inactive'], 'status');
 *   const id = parseId(req.params.id);
 */

const { badRequest } = require('./httpErrors');

/** Throw 400 if any of the named fields are missing/empty from body */
function requireFields(body, ...fields) {
  for (const f of fields) {
    const val = body[f];
    if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
      throw badRequest(`${f} is required.`);
    }
  }
}

/** Throw 400 if value is not in allowed list (skips null/undefined) */
function requireEnum(value, allowed, fieldName = 'value') {
  if (value !== undefined && value !== null && !allowed.includes(value)) {
    throw badRequest(`Invalid ${fieldName}. Must be one of: ${allowed.join(', ')}`);
  }
}

/** Parse and validate integer param, throw 400 if NaN */
function parseId(value, name = 'ID') {
  const id = parseInt(value);
  if (isNaN(id)) throw badRequest(`Invalid ${name}.`);
  return id;
}

/** Parse optional integer query param, return default if missing/invalid */
function parseIntOr(value, defaultVal) {
  if (value === undefined || value === null) return defaultVal;
  const n = parseInt(value);
  return isNaN(n) ? defaultVal : n;
}

module.exports = { requireFields, requireEnum, parseId, parseIntOr };
