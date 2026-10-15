import axios from 'axios';
import { toast } from 'sonner';

// Vite exposes env vars with VITE_ prefix
// Dynamically resolves API base URL so the portal works on localhost,
// LAN (e.g. mobile devices on local Wi-Fi), and production seamlessly.
export function getBaseURL() {
  const envUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000/api';
  if (typeof window !== 'undefined' && window.location) {
    const { hostname, protocol } = window.location;
    // When accessed from a mobile device or other computer on the LAN (not loopback)
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      try {
        const parsed = new URL(envUrl, window.location.origin);
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
          parsed.hostname = hostname;
          if (protocol) parsed.protocol = protocol;
          return parsed.toString().replace(/\/api\/?$/, '') + '/api';
        }
      } catch {
        // Fallback to envUrl
      }
    }
  }
  return envUrl.replace(/\/api\/?$/, '') + '/api';
}

export const api = axios.create({ baseURL: getBaseURL() });

// ─── Fast In-Memory Cache for Instant Tab Switching ──────────────────────────
const cache = new Map();
const inFlight = new Map();

// Endpoints with longer TTL (static or rarely changing)
const LONG_CACHE_PREFIXES = ['/public/categories', '/public/barangays', '/public/landing-data'];
const DEFAULT_CACHE_TTL = 15000; // 15 seconds: keeps tab navigation 100% instant without stale data
const LONG_CACHE_TTL = 180000;   // 3 minutes for static reference data

export function clearApiCache() {
  cache.clear();
  inFlight.clear();
}

// Wrap api.get with intelligent caching & deduplication
const originalGet = api.get.bind(api);
api.get = function (url, config = {}) {
  // If explicitly disabled or non-cacheable
  if (config.cache === false || config.params?.refresh) {
    return originalGet(url, config);
  }

  // QA-P2-04: Construct cache key scoped to current session token to prevent cross-account cache bleed
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const authScope = token ? token.slice(-16) : 'anon';
  const paramKey = config.params ? JSON.stringify(config.params) : '';
  const cacheKey = `${authScope}:${url}?${paramKey}`;
  const now = Date.now();

  // Check valid cache entry
  const cached = cache.get(cacheKey);
  const ttl = LONG_CACHE_PREFIXES.some(prefix => url.startsWith(prefix)) 
    ? LONG_CACHE_TTL 
    : (config.ttl || DEFAULT_CACHE_TTL);

  if (cached && now - cached.timestamp < ttl) {
    return Promise.resolve(cached.response);
  }

  // Deduplicate identical in-flight requests
  if (inFlight.has(cacheKey)) {
    return inFlight.get(cacheKey);
  }

  const reqPromise = originalGet(url, config)
    .then((res) => {
      // Clone response shallowly and store
      cache.set(cacheKey, { timestamp: Date.now(), response: res });
      inFlight.delete(cacheKey);
      return res;
    })
    .catch((err) => {
      inFlight.delete(cacheKey);
      throw err;
    });

  inFlight.set(cacheKey, reqPromise);
  return reqPromise;
};

// ─── Request Interceptor ─────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  // Ensure baseURL is dynamically set based on the active client's location
  config.baseURL = getBaseURL();
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Response Interceptor: Invalidate Cache on Mutations ─────────────────────
api.interceptors.response.use(
  (response) => {
    const method = response.config?.method?.toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      // Invalidate dynamic cache immediately on data mutation
      clearApiCache();
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ─── Human-Friendly Error Message Map ────────────────────────────────────────
// Maps backend detail strings (or fragments) to user-friendly messages
const ERROR_MAP = [
  // Auth – Account not found
  { match: /invalid email or password/i,       message: 'No account found with that email and password. Please check your credentials or create a new account.' },
  { match: /account.*not.*found|not found/i,   message: 'We could not find an account with that information. Please register first.' },
  // Auth – Account locked
  { match: /too many failed|locked/i,          message: 'Your account is temporarily locked due to too many failed login attempts. Please try again in 15 minutes.' },
  // Auth – Account disabled
  { match: /deactivated|disabled|suspended/i,  message: 'This account has been deactivated. Please contact the CSWDD office for assistance.' },
  // Auth – Already registered
  { match: /already exists|already registered|duplicate/i, message: 'An account with this email address already exists. Please sign in instead.' },
  // Token / Session
  { match: /could not validate|token.*expired|session.*expired|unauthorized/i, message: 'Your session has expired. Please sign in again.' },
  // File upload
  { match: /file too large|file size/i,        message: 'The file you uploaded is too large. Please upload a file under 10 MB.' },
  { match: /file type|unsupported|invalid.*type/i, message: 'This file type is not accepted. Please upload a PDF, JPG, or PNG file.' },
  // Profile / Application
  { match: /profile.*not.*complete|complete.*profile/i, message: 'Please complete your profile before submitting an application.' },
  { match: /application.*already.*exist/i,     message: 'You already have an active application. You cannot submit another one at this time.' },
  { match: /not.*found/i,                      message: 'The requested item was not found. It may have been deleted or moved.' },
  // Validation
  { match: /field required|validation/i,       message: 'Please fill in all required fields before submitting.' },
  // Network
  { match: /network error|econnrefused|failed to fetch/i, message: 'Cannot reach the server. Please check your internet connection and try again.' },
  { match: /timeout/i,                         message: 'The request timed out. Please try again.' },
  // Forbidden
  { match: /forbidden|permission|not allowed/i, message: 'You do not have permission to perform this action.' },
  // Server error
  { match: /internal server error|500/i,       message: 'Something went wrong on our end. Please try again in a moment.' },
];

/**
 * Extracts a human-friendly error message from an axios error object.
 * @param {import('axios').AxiosError} error
 * @param {string} fallback  Default message if no match found
 * @returns {string}
 */
export function getErrorMessage(error, fallback = 'An unexpected error occurred. Please try again.') {
  // Network / no response errors
  if (!error.response) {
    const msg = error.message || '';
    for (const rule of ERROR_MAP) {
      if (rule.match.test(msg)) return rule.message;
    }
    return 'Cannot reach the server. Please check your internet connection and try again.';
  }

  const status = error.response?.status;
  const raw = error.response?.data?.detail;

  // Normalise: detail can be a string, an array of objects (422), or an object
  let detail = '';
  if (typeof raw === 'string') {
    detail = raw;
  } else if (Array.isArray(raw)) {
    // FastAPI 422 Unprocessable Entity – join field messages
    detail = raw.map(e => e.msg || JSON.stringify(e)).join('; ');
  } else if (raw && typeof raw === 'object') {
    detail = JSON.stringify(raw);
  }

  // Try matching against our friendly map first
  const combined = `${detail} ${status}`;
  for (const rule of ERROR_MAP) {
    if (rule.match.test(combined)) return rule.message;
  }

  // If we have a raw detail message, clean it up and return it
  if (detail) {
    return detail.charAt(0).toUpperCase() + detail.slice(1);
  }

  // HTTP status fallbacks
  if (status === 400) return 'The information submitted is invalid. Please review and try again.';
  if (status === 401) return 'Please sign in to continue.';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 404) return 'The item you are looking for was not found.';
  if (status === 409) return 'A conflict occurred. This item may already exist.';
  if (status === 422) return 'Some fields are invalid. Please review your input and try again.';
  if (status === 429) return 'Too many requests. Please wait a moment before trying again.';
  if (status >= 500)  return 'A server error occurred. Please try again later.';

  return fallback;
}

/**
 * Convenience helper: shows a toast error with a friendly message.
 * @param {import('axios').AxiosError} error
 * @param {string} fallback
 */
export function toastError(error, fallback) {
  if (axios.isCancel(error)) {
    console.log('Request canceled', error.message);
    return;
  }
  toast.error(getErrorMessage(error, fallback));
}

// ─── Session Helpers ─────────────────────────────────────────────────────────
export function clearAuthSession() {
  clearApiCache();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key !== 'theme' && key !== 'admin-sidebar-collapsed') {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch {}
}

export async function logoutUser() {
  try {
    await api.post('/auth/logout');
  } catch {}
  clearAuthSession();
  window.location.href = '/login';
}

// ─── Response Interceptor ─────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    // Session expired – redirect to login with a toast
    if (status === 401) {
      const isLoginRoute = window.location.pathname === '/login' || window.location.pathname === '/register';
      clearAuthSession();
      if (!isLoginRoute) {
        toast.error('Your session has expired. Please sign in again.');
        setTimeout(() => { window.location.href = '/login'; }, 1200);
      }
    }

    return Promise.reject(error);
  }
);
