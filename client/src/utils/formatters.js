/**
 * Shared formatting utilities.
 * Import these instead of defining formatDate/formatINR locally in components.
 */

/** Format date as "02 Mar 2026" */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Format date+time as "02 Mar 2026, 09:30 AM" */
export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/** Format INR currency: "₹12,500" */
const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatINR(amount) {
  return inrFormatter.format(amount || 0);
}

/** Capitalize & clean: "in_progress" → "In Progress" */
export function capitalize(str) {
  if (!str) return '';
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format time string: "14:30" → "02:30 PM" */
export function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Convert a Google Drive URL to a direct image URL for use in <img> tags.
 * Handles both old webViewLink format and new direct URLs.
 * Returns the URL as-is if it's already a direct URL or non-Drive URL.
 */
export function driveImageUrl(url) {
  if (!url) return null;
  // Already a direct lh3 URL — return as-is
  if (url.includes('lh3.googleusercontent.com')) return url;
  // Drive webViewLink format: https://drive.google.com/file/d/{fileId}/view...
  const match = url.match(/\/file\/d\/([^/]+)\//);
  if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
  // Drive uc format: https://drive.google.com/uc?id={fileId}...
  const ucMatch = url.match(/[?&]id=([^&]+)/);
  if (ucMatch) return `https://lh3.googleusercontent.com/d/${ucMatch[1]}`;
  // Not a Drive URL — return as-is (e.g. base64, Clerk avatar, etc.)
  return url;
}
