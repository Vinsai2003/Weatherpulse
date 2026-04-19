/**
 * ═══════════════════════════════════════════════════════
 * storage.js — Local Storage abstraction layer
 * Handles user preferences, favorite cities, search history,
 * and API key persistence.
 * ═══════════════════════════════════════════════════════
 */

// ── Storage keys ────────────────────────────────────────
const KEYS = {
  PREFERENCES: 'weatherpulse_preferences',
  FAVORITES:   'weatherpulse_favorites',
  HISTORY:     'weatherpulse_search_history',
  API_KEY:     'weatherpulse_api_key',
  CACHE:       'weatherpulse_cache',
};

// ── Default values ──────────────────────────────────────
const DEFAULT_PREFERENCES = {
  defaultCity: 'London',
  units: 'metric',        // 'metric' | 'imperial'
  theme: 'light',         // 'light'  | 'dark'
};

const MAX_HISTORY = 8;
const MAX_FAVORITES = 12;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ═══════════════════════════════════════════════════════
//  Generic helpers
// ═══════════════════════════════════════════════════════

/**
 * Safely reads and parses a JSON value from Local Storage.
 * @param {string} key
 * @param {*} fallback
 * @returns {*}
 */
function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.warn(`[Storage] Failed to read "${key}":`, err);
    return fallback;
  }
}

/**
 * Safely writes a serialisable value to Local Storage.
 * @param {string} key
 * @param {*} value
 */
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[Storage] Failed to write "${key}":`, err);
  }
}

// ═══════════════════════════════════════════════════════
//  User Preferences
// ═══════════════════════════════════════════════════════

/**
 * Load user preferences, merged with defaults for missing keys.
 * @returns {Object}
 */
export function loadPreferences() {
  const stored = readJSON(KEYS.PREFERENCES, {});
  return { ...DEFAULT_PREFERENCES, ...stored };
}

/**
 * Save user preferences (partial or full).
 * @param {Object} prefs
 */
export function savePreferences(prefs) {
  const current = loadPreferences();
  writeJSON(KEYS.PREFERENCES, { ...current, ...prefs });
}

// ═══════════════════════════════════════════════════════
//  Favorite Cities
// ═══════════════════════════════════════════════════════

/**
 * Retrieve the list of favorite city names.
 * @returns {string[]}
 */
export function getFavorites() {
  return readJSON(KEYS.FAVORITES, []);
}

/**
 * Add a city to favorites (no duplicates, max cap).
 * @param {string} city
 * @returns {boolean} true if added
 */
export function addFavorite(city) {
  const favs = getFavorites();
  const normalised = city.trim();
  if (favs.some((f) => f.toLowerCase() === normalised.toLowerCase())) return false;
  if (favs.length >= MAX_FAVORITES) favs.shift(); // remove oldest
  favs.push(normalised);
  writeJSON(KEYS.FAVORITES, favs);
  return true;
}

/**
 * Remove a city from favorites.
 * @param {string} city
 */
export function removeFavorite(city) {
  const favs = getFavorites().filter(
    (f) => f.toLowerCase() !== city.toLowerCase()
  );
  writeJSON(KEYS.FAVORITES, favs);
}

/**
 * Check if a city is in favorites.
 * @param {string} city
 * @returns {boolean}
 */
export function isFavorite(city) {
  return getFavorites().some(
    (f) => f.toLowerCase() === city.trim().toLowerCase()
  );
}

// ═══════════════════════════════════════════════════════
//  Search History
// ═══════════════════════════════════════════════════════

/**
 * Retrieve recent search history (most recent first).
 * @returns {string[]}
 */
export function getSearchHistory() {
  return readJSON(KEYS.HISTORY, []);
}

/**
 * Add a city to search history.
 * @param {string} city
 */
export function addToSearchHistory(city) {
  let history = getSearchHistory().filter(
    (h) => h.toLowerCase() !== city.toLowerCase()
  );
  history.unshift(city.trim());
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
  writeJSON(KEYS.HISTORY, history);
}

/**
 * Clear search history.
 */
export function clearSearchHistory() {
  writeJSON(KEYS.HISTORY, []);
}

// ═══════════════════════════════════════════════════════
//  API Key
// ═══════════════════════════════════════════════════════

/**
 * Get the stored API key (may be null).
 * @returns {string|null}
 */
export function getApiKey() {
  return localStorage.getItem(KEYS.API_KEY) || null;
}

/**
 * Save the API key.
 * @param {string} key
 */
export function saveApiKey(key) {
  localStorage.setItem(KEYS.API_KEY, key.trim());
}

// ═══════════════════════════════════════════════════════
//  Response Cache (avoids redundant API calls)
// ═══════════════════════════════════════════════════════

/**
 * Build a cache key from request params.
 * @param {string} endpoint
 * @param {string} query
 * @param {string} units
 * @returns {string}
 */
function cacheKey(endpoint, query, units) {
  return `${endpoint}|${query.toLowerCase()}|${units}`;
}

/**
 * Get cached data if still fresh.
 * @param {string} endpoint
 * @param {string} query
 * @param {string} units
 * @returns {Object|null}
 */
export function getCachedData(endpoint, query, units) {
  const cache = readJSON(KEYS.CACHE, {});
  const key = cacheKey(endpoint, query, units);
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    delete cache[key];
    writeJSON(KEYS.CACHE, cache);
    return null;
  }
  return entry.data;
}

/**
 * Store data in cache.
 * @param {string} endpoint
 * @param {string} query
 * @param {string} units
 * @param {Object} data
 */
export function setCachedData(endpoint, query, units, data) {
  const cache = readJSON(KEYS.CACHE, {});
  const key = cacheKey(endpoint, query, units);
  cache[key] = { data, timestamp: Date.now() };
  writeJSON(KEYS.CACHE, cache);
}
