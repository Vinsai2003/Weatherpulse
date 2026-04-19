/**
 * ═══════════════════════════════════════════════════════
 * api.js — Tomorrow.io Weather API integration
 * All HTTP interactions are centralised here.
 * Uses async/await, robust error handling, and caching.
 * ═══════════════════════════════════════════════════════
 */

import { getCachedData, setCachedData } from './storage.js';

// ── API Key & Constants ─────────────────────────────────
const API_KEY     = 'IQLVUa46aA3KdBjgXj2jA88lzhOOFJcm';
const BASE_URL    = 'https://api.tomorrow.io/v4/weather';
const TIMEOUT_MS  = 10_000;

// ── Demo Data Fallback ────────────────────────────────
const DEMO_DATA = {
  realtime: {
    data: {
      time: new Date().toISOString(),
      values: {
        temperature: 22.5,
        temperatureApparent: 24.1,
        humidity: 45,
        windSpeed: 3.2,
        windDirection: 180,
        pressureSeaLevel: 1013.2,
        visibility: 10,
        weatherCode: 1000
      }
    },
    location: { name: "London" }
  },
  hourly: {
    timelines: {
      hourly: Array.from({length: 24}, (_, i) => ({
        time: new Date(Date.now() + i * 3600000).toISOString(),
        values: { 
          temperature: 20 + Math.sin(i/4)*5, 
          weatherCode: 1000 + (i%3)*100 
        }
      }))
    }
  },
  daily: {
    timelines: {
      daily: Array.from({length: 6}, (_, i) => ({
        time: new Date(Date.now() + i * 86400000).toISOString(),
        values: {
          temperatureMax: 25 + i,
          temperatureMin: 18 - i,
          weatherCodeMax: 1000,
          sunriseTime: new Date(new Date().setHours(6, 0, 0, 0) + i * 86400000).toISOString(),
          sunsetTime: new Date(new Date().setHours(18, 0, 0, 0) + i * 86400000).toISOString(),
          precipitationProbability: 10
        }
      }))
    }
  }
};


// ═══════════════════════════════════════════════════════
//  Tomorrow.io Weather Code → Description & Emoji
// ═══════════════════════════════════════════════════════

const WEATHER_CODES = {
  1000: { description: 'Clear Sky',                emoji: '☀️' },
  1100: { description: 'Mostly Clear',             emoji: '🌤️' },
  1101: { description: 'Partly Cloudy',            emoji: '⛅' },
  1102: { description: 'Mostly Cloudy',            emoji: '🌥️' },
  1001: { description: 'Cloudy',                   emoji: '☁️' },
  1103: { description: 'Partly Cloudy and Mostly Clear', emoji: '🌤️' },
  2000: { description: 'Fog',                      emoji: '🌫️' },
  2100: { description: 'Light Fog',                emoji: '🌫️' },
  3000: { description: 'Light Wind',               emoji: '💨' },
  3001: { description: 'Wind',                     emoji: '💨' },
  3002: { description: 'Strong Wind',              emoji: '🌬️' },
  4000: { description: 'Drizzle',                  emoji: '🌦️' },
  4001: { description: 'Rain',                     emoji: '🌧️' },
  4200: { description: 'Light Rain',               emoji: '🌦️' },
  4201: { description: 'Heavy Rain',               emoji: '🌧️' },
  5000: { description: 'Snow',                     emoji: '❄️' },
  5001: { description: 'Flurries',                 emoji: '🌨️' },
  5100: { description: 'Light Snow',               emoji: '🌨️' },
  5101: { description: 'Heavy Snow',               emoji: '❄️' },
  6000: { description: 'Freezing Drizzle',         emoji: '🌧️' },
  6001: { description: 'Freezing Rain',            emoji: '🌧️' },
  6200: { description: 'Light Freezing Rain',      emoji: '🌧️' },
  6201: { description: 'Heavy Freezing Rain',      emoji: '🌧️' },
  7000: { description: 'Ice Pellets',              emoji: '🧊' },
  7101: { description: 'Heavy Ice Pellets',        emoji: '🧊' },
  7102: { description: 'Light Ice Pellets',        emoji: '🧊' },
  8000: { description: 'Thunderstorm',             emoji: '⛈️' },
};

/**
 * Get weather info from a Tomorrow.io weather code.
 * @param {number} code
 * @returns {{ description: string, emoji: string, bg: string }}
 */
export function getWeatherInfo(code) {
  return WEATHER_CODES[code] || { description: 'Unknown', emoji: '❓', bg: 'clear' };
}

// ═══════════════════════════════════════════════════════
//  Internal Fetch Helper with Timeout (AbortController)
// ═══════════════════════════════════════════════════════

/**
 * Fetch JSON with a configurable timeout.
 * Demonstrates async/await + AbortController pattern.
 * @param {string} url
 * @returns {Promise<Object>}
 */
async function fetchJSON(url, type = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      if (response.status === 429 && type && DEMO_DATA[type]) {
        console.warn(`[API] Rate limit hit. Using demo data for ${type}.`);
        return DEMO_DATA[type];
      }
      const body = await response.json().catch(() => ({}));
      const msg  = body.message || body.type || `HTTP ${response.status}`;
      throw new Error(msg);
    }

    return await response.json();
  } catch (err) {
    if (type && DEMO_DATA[type]) {
      console.warn(`[API] Fetch failed for ${type}. Using demo data.`, err);
      return DEMO_DATA[type];
    }
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ═══════════════════════════════════════════════════════
//  Public API: Realtime Weather
// ═══════════════════════════════════════════════════════

/**
 * Fetch current / realtime weather for a location string.
 * @param {string} location — city name or "lat,lon"
 * @param {string} units — 'metric' | 'imperial'
 * @returns {Promise<Object>} raw Tomorrow.io realtime response
 */
export async function fetchRealtimeWeather(location, units = 'metric') {
  // Check cache first
  const cached = getCachedData('realtime', location, units);
  if (cached) return cached;

  const url = `${BASE_URL}/realtime`
    + `?location=${encodeURIComponent(location)}`
    + `&apikey=${API_KEY}`
    + `&units=${units}`;

  const data = await fetchJSON(url, 'realtime');

  // Cache result
  setCachedData('realtime', location, units, data);
  return data;
}

// ═══════════════════════════════════════════════════════
//  Public API: Hourly Forecast
// ═══════════════════════════════════════════════════════

/**
 * Fetch hourly forecast (up to 120 hours).
 * @param {string} location
 * @param {string} units
 * @returns {Promise<Object>}
 */
export async function fetchHourlyForecast(location, units = 'metric') {
  const cached = getCachedData('hourly', location, units);
  if (cached) return cached;

  const url = `${BASE_URL}/forecast`
    + `?location=${encodeURIComponent(location)}`
    + `&apikey=${API_KEY}`
    + `&units=${units}`
    + `&timesteps=1h`;

  const data = await fetchJSON(url, 'hourly');
  setCachedData('hourly', location, units, data);
  return data;
}

// ═══════════════════════════════════════════════════════
//  Public API: Daily Forecast
// ═══════════════════════════════════════════════════════

/**
 * Fetch daily forecast (5-day).
 * @param {string} location
 * @param {string} units
 * @returns {Promise<Object>}
 */
export async function fetchDailyForecast(location, units = 'metric') {
  const cached = getCachedData('daily', location, units);
  if (cached) return cached;

  const url = `${BASE_URL}/forecast`
    + `?location=${encodeURIComponent(location)}`
    + `&apikey=${API_KEY}`
    + `&units=${units}`
    + `&timesteps=1d`;

  const data = await fetchJSON(url, 'daily');
  setCachedData('daily', location, units, data);
  return data;
}

// ═══════════════════════════════════════════════════════
//  Public API: Fetch by Coordinates
// ═══════════════════════════════════════════════════════

/**
 * Fetch realtime weather by lat/lon.
 * @param {number} lat
 * @param {number} lon
 * @param {string} units
 * @returns {Promise<Object>}
 */
export async function fetchRealtimeByCoords(lat, lon, units = 'metric') {
  const location = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  return fetchRealtimeWeather(location, units);
}

/**
 * Fetch hourly forecast by lat/lon.
 */
export async function fetchHourlyByCoords(lat, lon, units = 'metric') {
  const location = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  return fetchHourlyForecast(location, units);
}

/**
 * Fetch daily forecast by lat/lon.
 */
export async function fetchDailyByCoords(lat, lon, units = 'metric') {
  const location = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  return fetchDailyForecast(location, units);
}

// ═══════════════════════════════════════════════════════
//  Formatting Helpers
// ═══════════════════════════════════════════════════════

/**
 * Format an ISO datetime string to a readable date.
 * @param {string} isoStr
 * @returns {string}
 */
export function formatDate(isoStr) {
  return new Date(isoStr).toLocaleDateString(undefined, {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
  });
}

/**
 * Format ISO date to short day name.
 * @param {string} isoStr
 * @returns {string}
 */
export function formatDay(isoStr) {
  return new Date(isoStr).toLocaleDateString(undefined, { weekday: 'short' });
}

/**
 * Format ISO datetime to a time string (HH:MM).
 * @param {string} isoStr
 * @returns {string}
 */
export function formatTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get wind direction label from degrees.
 * @param {number} deg
 * @returns {string}
 */
export function windDirection(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE',
                'S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}
