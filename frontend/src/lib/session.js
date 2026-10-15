/**
 * Safely retrieves and parses the user object from localStorage.
 * Handles missing, 'undefined', 'null', or corrupted JSON without throwing errors or crashing React.
 * Automatically clears corrupted user/token keys from storage if malformed JSON is detected.
 *
 * @returns {object|null}
 */
export function getSafeStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw || raw === 'undefined' || raw === 'null') return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed.data && !parsed.role ? parsed.data : parsed;
  } catch (err) {
    console.warn('Failed to parse stored user, clearing invalid session:', err);
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    } catch (_) {}
    return null;
  }
}
