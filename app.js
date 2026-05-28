import { fetchWeather, parseNights, DEFAULT_LOCATION } from './modules/weather.js';
import { computeChillScore } from './modules/scoring.js';
import { showForecast, showLoading, showError, setupSettings, setupInfo } from './modules/ui.js';
import { checkAndNotify, requestNotificationPermissionLater } from './modules/notifications.js';

// ── Service worker registration ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

// ── Location helpers ──
function getLocation() {
  return JSON.parse(localStorage.getItem('hcf_location') || 'null') || DEFAULT_LOCATION;
}

// ── Main data load ──
async function loadForecast(location) {
  showLoading();
  try {
    const data = await fetchWeather(location);
    localStorage.setItem('hcf_last_fetch', String(Date.now()));

    const nights = parseNights(data);
    const scores = nights.map(n => computeChillScore(n));

    console.group('Home Chill Factor — data');
    nights.forEach((n, i) => {
      console.log(`${n.label}: score=${scores[i].total}  WAT=${scores[i].wat}°  wind=${scores[i].windScore}  solar=${scores[i].solarScore}  damp=${scores[i].dampScore}`);
    });
    console.groupEnd();

    showForecast(nights, scores);

    await checkAndNotify(scores[0].total);
  } catch (err) {
    console.error('Forecast load failed:', err);
    showError();
  }
}

// ── Pull-to-refresh ──
let ptStartY = 0;
let ptPulling = false;
const MIN_PULL = 72;

document.addEventListener('touchstart', e => {
  const scrollEl = document.getElementById('forecast-view');
  if (!scrollEl || scrollEl.classList.contains('hidden')) return;
  if (scrollEl.scrollTop === 0) {
    ptStartY = e.touches[0].clientY;
    ptPulling = true;
  }
}, { passive: true });

document.addEventListener('touchend', e => {
  if (!ptPulling) return;
  const dy = e.changedTouches[0].clientY - ptStartY;
  ptPulling = false;
  if (dy > MIN_PULL) loadForecast(getLocation());
}, { passive: true });

// ── Settings wiring ──
setupSettings(loc => loadForecast(loc));
setupInfo();

// ── Retry button ──
document.getElementById('retry-btn').addEventListener('click', () => loadForecast(getLocation()));

// ── Initial load ──
loadForecast(getLocation());
requestNotificationPermissionLater();
