/**
 * Browser-session authentication utilities.
 * These helpers work with Tahvel's existing cookies — no MSAL needed.
 */

/**
 * Read the XSRF-TOKEN cookie value, URL-decoded.
 * Required for POST/PUT/DELETE requests to hois_back.
 * @returns {string|null}
 */
export function getCsrfToken() {
  const match = document.cookie.match(new RegExp('(^| )XSRF-TOKEN=([^;]+)'));
  if (match) return decodeURIComponent(match[2]);
  return null;
}
