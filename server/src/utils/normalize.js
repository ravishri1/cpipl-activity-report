/**
 * Data normalization utilities
 * - Emails: always lowercase
 * - Names: always Title Case
 */

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : email;
}

function normalizeName(name) {
  if (!name) return name;
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = { normalizeEmail, normalizeName };
