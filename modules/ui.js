import { adviceFromScore, timingFlag } from './scoring.js';

const INTENSITY_COLOURS = ['#9e9690', '#c8a86b', '#d4823a', '#c85a1e', '#b83010'];

// Returns a CSS colour for the hero score number.
// Below 4.5: uses intensity palette. 4.5–9+: interpolates from warm-neutral to ice blue.
function scoreColour(score, intensity) {
  if (score < 4.5) return INTENSITY_COLOURS[intensity];
  // 4.5 → slight blue tinge (#a0b4c8), 9.0+ → vivid ice blue (#60c8f0)
  const t = Math.min((score - 4.5) / 4.5, 1); // 0 at 4.5, 1 at 9.0
  const r = Math.round(160 + (96  - 160) * t);  // 160 → 96
  const g = Math.round(180 + (200 - 180) * t);  // 180 → 200
  const b = Math.round(200 + (240 - 200) * t);  // 200 → 240
  return `rgb(${r},${g},${b})`;
}

function flameSVG(intensity) {
  if (intensity === 0) {
    // Ember/ash icon
    return `<svg width="32" height="22" viewBox="0 0 32 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="17" rx="14" ry="4" fill="#3a342e"/>
      <ellipse cx="10" cy="14" rx="3" ry="1.5" fill="#4a4540" opacity="0.8"/>
      <ellipse cx="20" cy="13" rx="2.5" ry="1.2" fill="#4a4540" opacity="0.6"/>
      <ellipse cx="15" cy="12" rx="2" ry="1" fill="#5a5048" opacity="0.7"/>
    </svg>`;
  }

  const sizes   = [0, 32, 44, 56, 64];
  const heights = [0, 38, 52, 64, 72];
  const w = sizes[intensity];
  const h = heights[intensity];

  const mainColour  = INTENSITY_COLOURS[intensity];
  const innerColour = intensity >= 3 ? '#e8a855' : '#f0c878';
  const coreColour  = intensity >= 3 ? '#ffe4a0' : '#fff5cc';
  const glowClass   = intensity === 4 ? ' flame-glow' : '';

  // Flame path scaled to w × h
  const cx = w / 2;
  const bx = w * 0.18, ex = w - bx;
  const c1x = cx * 0.3, c2x = cx * 1.7;
  const tipY = h * 0.04;
  const midY = h * 0.38;
  const baseY = h * 0.92;

  const innerW = w * 0.52, innerH = h * 0.52;
  const icx = cx, icy = h * 0.44;

  return `<svg class="flame-svg${glowClass}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- outer flame -->
    <path d="M${cx},${tipY} C${c1x},${midY} ${bx},${baseY} ${cx},${baseY} C${ex},${baseY} ${c2x},${midY} ${cx},${tipY}Z"
      fill="${mainColour}"/>
    <!-- inner flame -->
    <ellipse cx="${icx}" cy="${icy + innerH * 0.3}" rx="${innerW * 0.5}" ry="${innerH * 0.55}" fill="${innerColour}" opacity="0.85"/>
    <!-- core -->
    <ellipse cx="${icx}" cy="${icy + innerH * 0.5}" rx="${innerW * 0.25}" ry="${innerH * 0.3}" fill="${coreColour}" opacity="0.7"/>
    <!-- base glow -->
    <ellipse cx="${cx}" cy="${baseY}" rx="${w * 0.42}" ry="${h * 0.06}" fill="${mainColour}" opacity="0.35"/>
  </svg>`;
}

function intensityBarHTML(intensity) {
  const colourClass = `bar-filled-${intensity}`;
  return Array.from({ length: 4 }, (_, i) =>
    `<div class="bar-segment${i < intensity ? ' ' + colourClass : ''}"></div>`
  ).join('');
}

export function renderHero(nightData, score) {
  const advice = adviceFromScore(score.total);
  const timing = timingFlag(score.total);

  const heroCard = document.getElementById('hero-card');
  heroCard.className = `hero-card intensity-${advice.intensity}`;

  document.getElementById('tonight-label').textContent = nightData.label.toUpperCase();
  document.getElementById('flame-icon').innerHTML = flameSVG(advice.intensity);
  const scoreEl = document.getElementById('score-number');
  scoreEl.textContent = score.total.toFixed(1);
  scoreEl.style.color = scoreColour(score.total, advice.intensity);
  document.getElementById('advice-label').textContent = advice.label;
  document.getElementById('advice-detail').textContent = advice.detail;

  const timingEl = document.getElementById('timing-line');
  if (score.total >= 3.8) {
    timingEl.textContent = `${timing.text}  ${timing.time}`;
    timingEl.classList.remove('hidden');
  } else {
    timingEl.classList.add('hidden');
  }

  document.getElementById('metric-row').innerHTML =
    `<span class="metric-item"><strong>WAT</strong> ${score.wat}°</span>` +
    `<span class="metric-item"><strong>Wind</strong> ${score.windScore.toFixed(1)}</span>` +
    `<span class="metric-item"><strong>Cloud</strong> ${score.avgCloud}%</span>` +
    (score.soakScore  > 0 ? `<span class="metric-item"><strong>Soak</strong> ${score.soakScore.toFixed(1)}</span>`  : '') +
    (score.dropScore  > 0 ? `<span class="metric-item"><strong>Drop</strong> ${score.dropScore.toFixed(1)}</span>`  : '') +
    (score.eWindScore > 0 ? `<span class="metric-item"><strong>Eve</strong> ${score.eWindScore.toFixed(1)}</span>`  : '');
}

export function renderRows(nights, scores) {
  const container = document.getElementById('night-rows');
  container.innerHTML = '';

  nights.slice(1).forEach((night, i) => {
    const score = scores[i + 1];
    const advice = adviceFromScore(score.total);

    const row = document.createElement('div');
    row.className = 'night-row';
    row.innerHTML =
      `<span class="row-day">${night.label}</span>` +
      `<div class="row-bar">${intensityBarHTML(advice.intensity)}</div>` +
      `<span class="row-score">${score.total.toFixed(1)}</span>` +
      `<span class="row-label">${advice.rowLabel}</span>`;
    container.appendChild(row);
  });
}

export function showForecast(nights, scores) {
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('error-state').classList.add('hidden');
  document.getElementById('forecast-view').classList.remove('hidden');

  const loc = JSON.parse(localStorage.getItem('hcf_location') || 'null');
  document.getElementById('location-name').textContent = loc ? loc.name : 'Casuarina NSW';

  renderHero(nights[0], scores[0]);
  renderRows(nights, scores);
  updateLastUpdated();
}

export function showLoading() {
  document.getElementById('loading-state').classList.remove('hidden');
  document.getElementById('error-state').classList.add('hidden');
  document.getElementById('forecast-view').classList.add('hidden');
}

export function showError() {
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('error-state').classList.remove('hidden');
  document.getElementById('forecast-view').classList.add('hidden');
}

function updateLastUpdated() {
  const ts = localStorage.getItem('hcf_last_fetch');
  if (!ts) return;
  const diff = Math.round((Date.now() - Number(ts)) / 60000);
  const el = document.getElementById('last-updated');
  if (el) el.textContent = diff < 2 ? 'Updated just now' : `Updated ${diff} min ago`;
}

export function setupInfo() {
  const overlay  = document.getElementById('info-overlay');
  const openBtn  = document.getElementById('info-btn');
  const closeBtn = document.getElementById('info-close');

  openBtn.addEventListener('click', () => overlay.classList.remove('hidden'));
  closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
}

export function setupSettings(onSave) {
  const overlay    = document.getElementById('settings-overlay');
  const openBtn    = document.getElementById('settings-btn');
  const closeBtn   = document.getElementById('settings-close');
  const saveBtn    = document.getElementById('settings-save');
  const resetBtn   = document.getElementById('settings-reset');
  const nameInput  = document.getElementById('setting-name');
  const latInput   = document.getElementById('setting-lat');
  const lonInput   = document.getElementById('setting-lon');

  const DEFAULT = { name: 'Casuarina NSW', lat: -28.319, lon: 153.574 };

  function openPanel() {
    const stored = JSON.parse(localStorage.getItem('hcf_location') || 'null') || DEFAULT;
    nameInput.value = stored.name;
    latInput.value  = stored.lat;
    lonInput.value  = stored.lon;
    overlay.classList.remove('hidden');
  }

  function closePanel() {
    overlay.classList.add('hidden');
  }

  openBtn.addEventListener('click', openPanel);
  closeBtn.addEventListener('click', closePanel);
  overlay.addEventListener('click', e => { if (e.target === overlay) closePanel(); });

  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim() || DEFAULT.name;
    const lat  = parseFloat(latInput.value);
    const lon  = parseFloat(lonInput.value);
    if (isNaN(lat) || isNaN(lon)) return;
    const loc = { name, lat, lon };
    localStorage.setItem('hcf_location', JSON.stringify(loc));
    document.getElementById('location-name').textContent = name;
    closePanel();
    onSave(loc);
  });

  resetBtn.addEventListener('click', () => {
    localStorage.setItem('hcf_location', JSON.stringify(DEFAULT));
    nameInput.value = DEFAULT.name;
    latInput.value  = DEFAULT.lat;
    lonInput.value  = DEFAULT.lon;
    document.getElementById('location-name').textContent = DEFAULT.name;
    closePanel();
    onSave(DEFAULT);
  });
}
