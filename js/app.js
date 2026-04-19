/**
 * ═══════════════════════════════════════════════════════
 * app.js — Main application controller
 * Orchestrates UI rendering, event handling, API calls,
 * and Local Storage persistence.
 * ═══════════════════════════════════════════════════════
 */

// ── Module Imports ──────────────────────────────────────
import {
  fetchRealtimeWeather,
  fetchHourlyForecast,
  fetchDailyForecast,
  fetchRealtimeByCoords,
  fetchHourlyByCoords,
  fetchDailyByCoords,
  getWeatherInfo,
  formatDate,
  formatDay,
  formatTime,
  windDirection,
} from './api.js';

import {
  loadPreferences,
  savePreferences,
  getFavorites,
  addFavorite,
  removeFavorite,
  isFavorite,
  getSearchHistory,
  addToSearchHistory,
} from './storage.js';

// ═══════════════════════════════════════════════════════
//  DOM References
// ═══════════════════════════════════════════════════════
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  // Loader
  loader:         $('#app-loader'),

  // Search
  cityInput:      $('#city-input'),
  searchBtn:      $('#search-btn'),
  suggestions:    $('#search-suggestions'),

  // Header controls
  geoBtn:         $('#geo-btn'),
  themeToggle:    $('#theme-toggle'),
  unitBtns:       $$('.unit-toggle__btn'),

  // Current weather
  currentCity:    $('#current-city'),
  currentDate:    $('#current-date'),
  currentIcon:    $('#current-icon'),
  currentTemp:    $('#current-temp'),
  currentDesc:    $('#current-desc'),
  currentFeels:   $('#current-feels'),
  humidityVal:    $('#humidity-value'),
  windVal:        $('#wind-value'),
  pressureVal:    $('#pressure-value'),
  visibilityVal:  $('#visibility-value'),
  sunriseVal:     $('#sunrise-value'),
  sunsetVal:      $('#sunset-value'),
  favBtn:         $('#fav-btn'),

  // Forecast
  forecastGrid:   $('#forecast-grid'),

  // Hourly
  hourlyScroll:   $('#hourly-scroll'),

  // Favorites
  favoritesGrid:  $('#favorites-grid'),
  noFavorites:    $('#no-favorites'),

  // Toasts
  errorToast:     $('#error-toast'),
  errorMsg:       $('#error-message'),
  successToast:   $('#success-toast'),
  successMsg:     $('#success-message'),

  // UI elements
  scrollProgress: $('#scroll-progress'),
  particles:      $('#particles'),
};

// ═══════════════════════════════════════════════════════
//  Application State
// ═══════════════════════════════════════════════════════
let state = {
  city: '',
  units: 'metric',
  theme: 'light',
  isLoading: false,
};

// ═══════════════════════════════════════════════════════
//  Initialisation
// ═══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // 1. Load persisted preferences
  const prefs = loadPreferences();
  state.units = prefs.units;
  state.theme = prefs.theme;
  state.city  = prefs.defaultCity;

  // 2. Apply theme & unit UI
  applyTheme(state.theme);
  applyUnitUI(state.units);

  // 3. Bind all event listeners
  bindEvents();

  // 4. Fetch initial city weather
  await loadCity(state.city);

  // 5. Hide loader
  setTimeout(() => dom.loader.classList.add('hidden'), 600);

  // 6. Render favourites after main data loads
  setTimeout(() => renderFavorites(), 1200);

  // 7. Stunning effects
  initStunningEffects();
  initParticles();
}

/**
 * Initialise interactive design effects
 * - Mouse follow glow
 * - Scroll reveal
 */
function initStunningEffects() {
  // ── Mouse Follow Glow ──
  const glow = $('#mouse-glow');
  if (glow) {
    window.addEventListener('mousemove', (e) => {
      glow.style.left = `${e.clientX}px`;
      glow.style.top = `${e.clientY}px`;
    });
  }

  // ── 3D Tilt & Shine (Main Card) ──
  const mainCard = $('.current');
  if (mainCard) {
    mainCard.addEventListener('mousemove', (e) => {
      const rect = mainCard.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = (centerY - y) / 15;
      const rotateY = (x - centerX) / 15;
      
      mainCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      mainCard.style.setProperty('--shine-x', `${(x / rect.width) * 100}%`);
      mainCard.style.setProperty('--shine-y', `${(y / rect.height) * 100}%`);
    });

    mainCard.addEventListener('mouseleave', () => {
      mainCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    });
  }

  // ── Scroll Reveal ──
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  $$('.reveal').forEach((el) => observer.observe(el));

  // ── Scroll Progress Bar ──
  window.addEventListener('scroll', () => {
    const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    const height    = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled  = (winScroll / height) * 100;
    if (dom.scrollProgress) {
      dom.scrollProgress.style.width = scrolled + '%';
    }
  });
}

/**
 * Initialise a simple particle system for ambient "life"
 */
function initParticles() {
  if (!dom.particles) return;
  dom.particles.innerHTML = '';
  const count = 30;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 2;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${Math.random() * 100}vw`;
    p.style.setProperty('--d', `${Math.random() * 15 + 10}s`);
    p.style.setProperty('--x', `${(Math.random() - 0.5) * 20}vw`);
    p.style.animationDelay = `${Math.random() * 20}s`;
    dom.particles.appendChild(p);
  }
}

/**
 * Update the global CSS variables based on current weather
 * to create a contextual "atmosphere".
 */
function updateWeatherTheme(weatherCode) {
  const root = document.documentElement;
  const isNight = state.theme === 'dark';

  // Weather mappings for colors (Primary, Accent, Mixed)
  const themeMap = {
    // Clear / Sunny
    1000: ['#6366f1', '#f59e0b', '#ec4899'],
    1100: ['#818cf8', '#fbbf24', '#f472b6'],
    // Cloudy
    1101: ['#64748b', '#334155', '#94a3b8'],
    1102: ['#94a3b8', '#475569', '#cbd5e1'],
    1001: ['#475569', '#1e293b', '#64748b'],
    // Rain
    4000: ['#0ea5e9', '#0284c7', '#38bdf8'],
    4201: ['#0369a1', '#075985', '#0ea5e9'],
    // Snow
    5000: ['#f8fafc', '#cbd5e1', '#e2e8f0'],
  };

  const colors = themeMap[weatherCode] || themeMap[1000];

  root.style.setProperty('--dynamic-c1', colors[0]);
  root.style.setProperty('--dynamic-c2', colors[1]);
  root.style.setProperty('--dynamic-c3', colors[2]);

  // Adjust particle opacity based on theme
  if (dom.particles) {
    dom.particles.style.opacity = isNight ? '0.4' : '0.2';
  }
}

// ═══════════════════════════════════════════════════════
//  Event Bindings
// ═══════════════════════════════════════════════════════

function bindEvents() {
  // ─── Search ────────────────────────────────────────
  dom.searchBtn.addEventListener('click', handleSearch);
  dom.cityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
    if (e.key === 'Escape') closeSuggestions();
  });
  dom.cityInput.addEventListener('input', debounce(handleSearchInput, 350));
  dom.cityInput.addEventListener('focus', showRecentSearches);

  // Close suggestions on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#search-container')) closeSuggestions();
  });

  // ─── Geolocation ───────────────────────────────────
  dom.geoBtn.addEventListener('click', handleGeolocation);

  // ─── Unit toggle ───────────────────────────────────
  dom.unitBtns.forEach((btn) => {
    btn.addEventListener('click', () => handleUnitChange(btn.dataset.unit));
  });

  // ─── Theme toggle ─────────────────────────────────
  dom.themeToggle.addEventListener('click', toggleTheme);

  // ─── Favourite star ────────────────────────────────
  dom.favBtn.addEventListener('click', handleToggleFavorite);
}

// ═══════════════════════════════════════════════════════
//  Core: Load a City
// ═══════════════════════════════════════════════════════

/**
 * Main flow — fetches realtime, hourly, and daily data
 * for a city and updates all UI elements.
 * Uses Promise.all for parallel fetching.
 * @param {string} city
 */
async function loadCity(city) {
  if (!city || state.isLoading) return;
  state.isLoading = true;
  state.city = city;

  try {
    showLoadingState();

    // Parallel API calls using Promise.all
    const [realtime, hourly, daily] = await Promise.all([
      fetchRealtimeWeather(city, state.units),
      fetchHourlyForecast(city, state.units),
      fetchDailyForecast(city, state.units),
    ]);

    // Use the canonical location name from the API
    const locationName = realtime.location?.name || city;
    state.city = extractCityName(locationName);

    renderCurrentWeather(realtime, daily);
    renderForecast(daily);
    renderHourly(hourly);
    updateFavButton();
    updateWeatherTheme(realtime.data.values.weatherCode);

    // Persist to history & preferences
    addToSearchHistory(state.city);
    savePreferences({ defaultCity: state.city });

  } catch (err) {
    console.error('[App] loadCity error:', err);
    showError(err.message || 'Failed to fetch weather data.');
  } finally {
    state.isLoading = false;
  }
}

/**
 * Load weather using geographic coordinates (geolocation fallback).
 * @param {number} lat
 * @param {number} lon
 */
async function loadByCoords(lat, lon) {
  if (state.isLoading) return;
  state.isLoading = true;

  try {
    showLoadingState();

    const [realtime, hourly, daily] = await Promise.all([
      fetchRealtimeByCoords(lat, lon, state.units),
      fetchHourlyByCoords(lat, lon, state.units),
      fetchDailyByCoords(lat, lon, state.units),
    ]);

    const locationName = realtime.location?.name || 'My Location';
    state.city = extractCityName(locationName);

    renderCurrentWeather(realtime, daily);
    renderForecast(daily);
    renderHourly(hourly);
    updateFavButton();
    updateWeatherTheme(realtime.data.values.weatherCode);

    addToSearchHistory(state.city);
    savePreferences({ defaultCity: state.city });

  } catch (err) {
    console.error('[App] loadByCoords error:', err);
    showError(err.message || 'Failed to fetch weather data.');
  } finally {
    state.isLoading = false;
  }
}

/**
 * Extract a short city name from the full location string.
 * Tomorrow.io returns e.g. "City of London, Greater London, England, United Kingdom"
 * We take just the first part.
 */
function extractCityName(fullName) {
  if (!fullName) return 'Unknown';
  const parts = fullName.split(',');
  return parts[0].trim();
}

// ═══════════════════════════════════════════════════════
//  Rendering: Current Weather
// ═══════════════════════════════════════════════════════

function renderCurrentWeather(realtime, daily) {
  const v     = realtime.data.values;
  const loc   = realtime.location;
  const info  = getWeatherInfo(v.weatherCode);
  const uSuffix = state.units === 'metric' ? '°C' : '°F';
  const wUnit   = state.units === 'metric' ? 'm/s' : 'mph';

  // City name & date
  dom.currentCity.textContent  = extractCityName(loc?.name || state.city);
  dom.currentDate.textContent  = formatDate(realtime.data.time);

  // Weather emoji icon (large)
  dom.currentIcon.textContent  = info.emoji;

  // Temperature
  dom.currentTemp.textContent  = `${Math.round(v.temperature)}${uSuffix}`;
  dom.currentDesc.textContent  = info.description;
  dom.currentFeels.textContent = `Feels like ${Math.round(v.temperatureApparent)}${uSuffix}`;

  // Detail cards
  dom.humidityVal.textContent   = `${v.humidity}%`;
  dom.windVal.textContent       = `${v.windSpeed} ${wUnit} ${windDirection(v.windDirection)}`;
  dom.pressureVal.textContent   = `${Math.round(v.pressureSeaLevel)} hPa`;
  dom.visibilityVal.textContent = `${v.visibility} km`;

  // Sunrise & sunset from the daily forecast (today = index 0)
  const today = daily?.timelines?.daily?.[0]?.values;
  if (today) {
    dom.sunriseVal.textContent = today.sunriseTime ? formatTime(today.sunriseTime) : '—';
    dom.sunsetVal.textContent  = today.sunsetTime  ? formatTime(today.sunsetTime)  : '—';
  }

  // Restart the card's entrance animation
  const currentSection = document.querySelector('.current');
  currentSection.style.animation = 'none';
  void currentSection.offsetHeight; // trigger reflow
  currentSection.style.animation = '';
}

// ═══════════════════════════════════════════════════════
//  Rendering: 5-Day Forecast
// ═══════════════════════════════════════════════════════

function renderForecast(daily) {
  const uSuffix = state.units === 'metric' ? '°C' : '°F';
  const days    = daily.timelines.daily.slice(1, 6); // skip today

  dom.forecastGrid.innerHTML = days.map((day, i) => {
    const v    = day.values;
    const info = getWeatherInfo(v.weatherCodeMax || v.weatherCodeMin);
    return `
      <div class="forecast-card" style="animation-delay: ${i * 0.08}s">
        <span class="forecast-card__day">${formatDay(day.time)}</span>
        <span class="forecast-card__icon">${info.emoji}</span>
        <span class="forecast-card__temp">${Math.round(v.temperatureMax)}${uSuffix}</span>
        <span class="forecast-card__range">${Math.round(v.temperatureMin)}${uSuffix}</span>
        <span class="forecast-card__desc">${info.description}</span>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════════════
//  Rendering: Hourly Forecast
// ═══════════════════════════════════════════════════════

function renderHourly(hourly) {
  const uSuffix = state.units === 'metric' ? '°C' : '°F';
  const hours   = hourly.timelines.hourly.slice(0, 12); // next 12 hours

  dom.hourlyScroll.innerHTML = hours.map((h, i) => {
    const v    = h.values;
    const info = getWeatherInfo(v.weatherCode);
    return `
      <div class="hourly-card" style="animation-delay: ${i * 0.05}s">
        <span class="hourly-card__time">${formatTime(h.time)}</span>
        <span class="hourly-card__icon">${info.emoji}</span>
        <span class="hourly-card__temp">${Math.round(v.temperature)}${uSuffix}</span>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════════════
//  Rendering: Favorites
// ═══════════════════════════════════════════════════════

async function renderFavorites() {
  const favs = getFavorites();

  if (favs.length === 0) {
    dom.favoritesGrid.innerHTML = '';
    dom.noFavorites.hidden = false;
    return;
  }
  dom.noFavorites.hidden = true;

  // Fetch realtime weather for each fav (parallel, graceful failures)
  const results = await Promise.allSettled(
    favs.map((city) => fetchRealtimeWeather(city, state.units))
  );

  const uSuffix = state.units === 'metric' ? '°C' : '°F';

  dom.favoritesGrid.innerHTML = results
    .map((r, i) => {
      if (r.status === 'rejected') return '';
      const d    = r.value;
      const v    = d.data.values;
      const info = getWeatherInfo(v.weatherCode);
      const name = extractCityName(d.location?.name || favs[i]);
      return `
        <div class="fav-card" data-city="${favs[i]}" tabindex="0"
             role="button" aria-label="View weather for ${name}"
             style="animation-delay: ${i * 0.06}s">
          <span class="fav-card__icon">${info.emoji}</span>
          <div class="fav-card__info">
            <span class="fav-card__city">${name}</span>
            <span class="fav-card__temp">${Math.round(v.temperature)}${uSuffix}</span>
            <span class="fav-card__desc">${info.description}</span>
          </div>
          <button class="fav-card__remove" aria-label="Remove ${name}" data-remove="${favs[i]}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      `;
    })
    .join('');

  // Bind click → navigate
  dom.favoritesGrid.querySelectorAll('.fav-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.fav-card__remove')) return;
      loadCity(card.dataset.city);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // Bind remove buttons
  dom.favoritesGrid.querySelectorAll('.fav-card__remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFavorite(btn.dataset.remove);
      renderFavorites();
      updateFavButton();
      showSuccess(`Removed from favorites.`);
    });
  });
}

// ═══════════════════════════════════════════════════════
//  Event Handlers
// ═══════════════════════════════════════════════════════

/** Handle search submit */
function handleSearch() {
  const city = dom.cityInput.value.trim();
  if (!city) return;
  closeSuggestions();
  loadCity(city);
  dom.cityInput.value = '';
  dom.cityInput.blur();
}

/** Handle typing in search input (debounced — 350 ms) */
function handleSearchInput() {
  const query = dom.cityInput.value.trim();
  if (query.length < 2) {
    showRecentSearches();
    return;
  }
  // Filter history that matches the query
  const matching = getSearchHistory().filter((h) =>
    h.toLowerCase().includes(query.toLowerCase())
  );
  renderSuggestions(matching, query);
}

/** Show recent searches dropdown */
function showRecentSearches() {
  const history = getSearchHistory();
  if (history.length === 0) { closeSuggestions(); return; }
  renderSuggestions(history, '', true);
}

/** Render the suggestions dropdown list */
function renderSuggestions(items, query, isRecent = false) {
  if (items.length === 0) { closeSuggestions(); return; }

  const clockSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const pinSvg   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;

  dom.suggestions.innerHTML = items.map((item) => `
    <li role="option" data-city="${item}">
      ${isRecent ? clockSvg : pinSvg}
      ${highlightMatch(item, query)}
    </li>
  `).join('');

  dom.suggestions.classList.add('open');

  dom.suggestions.querySelectorAll('li').forEach((li) => {
    li.addEventListener('click', () => {
      dom.cityInput.value = '';
      closeSuggestions();
      loadCity(li.dataset.city);
    });
  });
}

/** Highlight search query match in text */
function highlightMatch(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return text.replace(regex, '<strong>$1</strong>');
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Close suggestions dropdown */
function closeSuggestions() {
  dom.suggestions.classList.remove('open');
}

/** Geolocation handler */
function handleGeolocation() {
  if (!navigator.geolocation) {
    showError('Geolocation is not supported by your browser.');
    return;
  }
  showSuccess('Detecting your location…');
  navigator.geolocation.getCurrentPosition(
    (pos) => loadByCoords(pos.coords.latitude, pos.coords.longitude),
    (err) => {
      const msgs = {
        1: 'Location access denied. Please allow location permission.',
        2: 'Location unavailable. Try again later.',
        3: 'Location request timed out.',
      };
      showError(msgs[err.code] || 'Could not get your location.');
    },
    { timeout: 10000, enableHighAccuracy: false }
  );
}

/** Unit change handler */
function handleUnitChange(unit) {
  if (unit === state.units) return;
  state.units = unit;
  applyUnitUI(unit);
  savePreferences({ units: unit });
  // Reload current city with new units
  loadCity(state.city);
  renderFavorites();
}

/** Apply unit toggle button UI */
function applyUnitUI(unit) {
  dom.unitBtns.forEach((btn) => {
    const isActive = btn.dataset.unit === unit;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', isActive);
  });
}

/** Theme toggle handler */
function toggleTheme() {
  const next = state.theme === 'light' ? 'dark' : 'light';
  state.theme = next;
  applyTheme(next);
  savePreferences({ theme: next });
}

/** Apply theme to DOM */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/** Toggle favourite star */
function handleToggleFavorite() {
  if (!state.city) return;
  if (isFavorite(state.city)) {
    removeFavorite(state.city);
    showSuccess(`${state.city} removed from favorites.`);
  } else {
    addFavorite(state.city);
    showSuccess(`${state.city} added to favorites!`);
  }
  updateFavButton();
  renderFavorites();
}

/** Update the fav star active state */
function updateFavButton() {
  dom.favBtn.classList.toggle('active', isFavorite(state.city));
}

// ═══════════════════════════════════════════════════════
//  Loading States (skeleton shimmer)
// ═══════════════════════════════════════════════════════

function showLoadingState() {
  const targets = [
    dom.currentTemp, dom.currentDesc, dom.currentFeels,
    dom.humidityVal, dom.windVal, dom.pressureVal,
    dom.visibilityVal, dom.sunriseVal, dom.sunsetVal,
  ];
  targets.forEach((el) => {
    el.textContent = '';
    el.classList.add('skeleton');
    el.style.minWidth = '60px';
    el.style.minHeight = '1.2em';
    el.style.display = 'inline-block';
  });

  dom.forecastGrid.innerHTML = Array(5)
    .fill('<div class="forecast-card skeleton" style="min-height:180px"></div>').join('');
  dom.hourlyScroll.innerHTML = Array(8)
    .fill('<div class="hourly-card skeleton" style="min-height:120px"></div>').join('');

  // Remove skeletons after a brief delay (render functions replace them)
  setTimeout(() => {
    targets.forEach((el) => {
      el.classList.remove('skeleton');
      el.style.minWidth = '';
      el.style.minHeight = '';
      el.style.display = '';
    });
  }, 300);
}

// ═══════════════════════════════════════════════════════
//  Toast Notifications
// ═══════════════════════════════════════════════════════

function showError(message) {
  dom.errorMsg.textContent = message;
  dom.errorToast.hidden = false;
  dom.errorToast.classList.add('show');
  setTimeout(() => {
    dom.errorToast.classList.remove('show');
    setTimeout(() => (dom.errorToast.hidden = true), 400);
  }, 4000);
}

function showSuccess(message) {
  dom.successMsg.textContent = message;
  dom.successToast.hidden = false;
  dom.successToast.classList.add('show');
  setTimeout(() => {
    dom.successToast.classList.remove('show');
    setTimeout(() => (dom.successToast.hidden = true), 400);
  }, 3000);
}

// ═══════════════════════════════════════════════════════
//  Utility: Debounce
// ═══════════════════════════════════════════════════════

/**
 * Debounce — delays invocation until after `wait` ms of no new
 * calls. Prevents excessive API calls on rapid input.
 * @param {Function} fn
 * @param {number} wait — milliseconds
 * @returns {Function}
 */
function debounce(fn, wait) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}
