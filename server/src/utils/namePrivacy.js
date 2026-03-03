/**
 * Name privacy utility.
 * Hides middle names and shows only last-name initial for non-admin users.
 *
 * Examples:
 *   "Ravi Kumar Singh"  → "Ravi S."
 *   "Ravi Singh"        → "Ravi S."
 *   "Ravi"              → "Ravi"
 *   ""                  → ""
 *   null                → ""
 */

/**
 * Mask a full name: keep first name, drop middle names, show last-name initial only.
 * @param {string|null} fullName
 * @returns {string}
 */
function maskName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || '';
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0].toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

/**
 * Apply maskName to a single object's `name` field (and optionally nested name fields).
 * Returns a shallow copy with the name masked.
 * @param {object} obj        - Object with a `name` property
 * @param {string[]} [nestedKeys] - Keys whose `.name` should also be masked (e.g. ['reportingManager'])
 * @returns {object}
 */
function maskUserName(obj, nestedKeys = []) {
  if (!obj) return obj;
  const masked = { ...obj };
  if (masked.name) masked.name = maskName(masked.name);

  for (const key of nestedKeys) {
    if (masked[key] && masked[key].name) {
      masked[key] = { ...masked[key], name: maskName(masked[key].name) };
    }
  }
  return masked;
}

/**
 * Mask names in an array of user-like objects.
 * @param {object[]} arr
 * @param {string[]} [nestedKeys]
 * @returns {object[]}
 */
function maskUserNames(arr, nestedKeys = []) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(item => maskUserName(item, nestedKeys));
}

/**
 * Check whether the requesting user should see full (unmasked) names.
 * Admins always see full names.
 * @param {object} reqUser - req.user from auth middleware
 * @returns {boolean}
 */
function canSeeFullNames(reqUser) {
  return reqUser && reqUser.role === 'admin';
}

module.exports = { maskName, maskUserName, maskUserNames, canSeeFullNames };
