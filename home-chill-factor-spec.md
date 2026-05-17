# Home Chill Factor — Claude Code Build Spec

Build a complete Progressive Web App called **Home Chill Factor**. This is a domestic thermal guidance tool that predicts overnight fireplace heating requirements based on weather forecast data. It is NOT a weather dashboard. It should feel calm, warm, and practical.

---

## Project structure to create

```
home-chill-factor/
├── index.html
├── app.js
├── style.css
├── manifest.json
├── service-worker.js
├── modules/
│   ├── weather.js
│   ├── scoring.js
│   ├── ui.js
│   └── notifications.js
├── assets/
│   └── icons/
│       ├── icon-192.png
│       ├── icon-512.png
│       └── icon.svg
└── README.md
```

---

## Technology

- Vanilla HTML/CSS/JavaScript — no frameworks
- Open-Meteo API (free, no key required)
- PWA: manifest.json + service-worker.js
- localStorage for settings persistence
- Target: iPhone home screen install via Safari

---

## Weather data — modules/weather.js

### API endpoint

```
https://api.open-meteo.com/v1/forecast
  ?latitude={lat}
  &longitude={lon}
  &hourly=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,cloud_cover,relative_humidity_2m
  &timezone=Australia/Sydney
  &forecast_days=5
```

### Default location

```javascript
const DEFAULT_LOCATION = {
  name: 'Casuarina NSW',
  lat: -28.319,
  lon: 153.574
};
```

### Data parsing

The API returns 120 hourly entries (5 days). Parse these into an array of **4 night objects**, one for each of tonight through to night 4. Each night object contains:

```javascript
{
  label: 'Tonight' | 'Tomorrow' | 'Wednesday' | etc,
  date: Date,

  // WAT window: 11pm–7am (9 hours)
  coreTemps: [°C × 9],         // temps at 23:00, 00:00, 01:00, 02:00, 03:00, 04:00, 05:00, 06:00, 07:00
  coreApparent: [°C × 9],      // apparent temps same window

  // Evening window: 5pm–10pm (6 hours)
  eveningTemps: [°C × 6],      // temps at 17:00–22:00

  // Solar window: 1pm–5pm (5 hours)
  afternoonCloud: [% × 5],     // cloud cover at 13:00–17:00

  // Overnight averages
  overnightHumidity: number,   // avg humidity across 11pm–7am
  windDirection: number,       // dominant wind direction (mode) overnight
  minActualTemp: number,       // minimum actual temp overnight
  minApparentTemp: number,     // minimum apparent temp overnight
}
```

Date alignment:
- Night 0 (Tonight): evening = today 17:00–22:00, WAT = today 23:00 → tomorrow 07:00
- Night 1 (Tomorrow): evening = tomorrow 17:00–22:00, WAT = tomorrow 23:00 → day+2 07:00
- And so on for nights 2 and 3

If the current hour is past 22:00, shift night 0 to start from the next calendar day.

---

## Scoring model — modules/scoring.js

### WAT (Weighted Average Temperature)

Window: **11pm–7am**. Weight sum = 16.0.

```javascript
const WAT_HOURS = ['23:00','00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00'];
const WAT_WEIGHTS = [0.5, 1.0, 1.5, 2.0, 2.5, 2.5, 3.0, 2.0, 0.5];
const WAT_WEIGHT_SUM = 16.0;

function computeWAT(coreTemps) {
  const weightedSum = coreTemps.reduce((sum, temp, i) => sum + temp * WAT_WEIGHTS[i], 0);
  return weightedSum / WAT_WEIGHT_SUM;
}
```

### WAT score bands (0–7.5)

```javascript
function watScore(wat) {
  if (wat >= 16.0) return 0;
  if (wat >= 14.0) return 1.0;
  if (wat >= 12.0) return 3.5;
  if (wat >= 10.0) return 5.5;
  if (wat >= 8.0)  return 6.5;
  if (wat >= 7.0)  return 7.0;
  return 7.5; // < 7.0°C
}
```

### Wind score (0–2.0)

```javascript
function windScore(minActual, minApparent, windDirection) {
  const diff = minActual - minApparent;

  let base;
  if (diff <= 1)      base = 0;
  else if (diff <= 3) base = 0.7;
  else if (diff <= 5) base = 1.3;
  else                base = 2.0;

  // Direction multiplier — house runs NW/SE, long faces NE and SW
  let dirFactor;
  const d = windDirection;
  if (d >= 247 && d <= 315)       dirFactor = 1.0;  // W–WNW: cold continental, hits long NE face
  else if (d >= 135 && d <= 202) dirFactor = 0.7;  // S–SSE: maritime, hits short face
  else if (d >= 0 && d <= 90)    dirFactor = 0.5;  // N–NE: mild air mass
  else                            dirFactor = 0.75; // all others

  return Math.min(base * dirFactor, 2.0);
}
```

### Solar gain score (0–0.3)

```javascript
function solarScore(afternoonCloudAvg) {
  // afternoonCloudAvg = average cloud cover 1pm–5pm
  if (afternoonCloudAvg <= 30) return 0;
  if (afternoonCloudAvg <= 60) return 0.1;
  if (afternoonCloudAvg <= 84) return 0.2;
  return 0.3;
}
```

### Dampness score (0–0.2)

```javascript
function dampnessScore(overnightHumidity, afternoonCloudAvg) {
  if (overnightHumidity > 90 && afternoonCloudAvg > 85) return 0.2;
  if (overnightHumidity > 80 && afternoonCloudAvg > 70) return 0.1;
  return 0;
}
```

### Total chill score

```javascript
function computeChillScore(nightData) {
  const wat = computeWAT(nightData.coreTemps);
  const wScore = watScore(wat);
  const wiScore = windScore(nightData.minActualTemp, nightData.minApparentTemp, nightData.windDirection);
  const sScore = solarScore(average(nightData.afternoonCloud));
  const dScore = dampnessScore(nightData.overnightHumidity, average(nightData.afternoonCloud));

  const total = Math.min(wScore + wiScore + sScore + dScore, 10);

  return {
    total: Math.round(total * 10) / 10,
    wat,
    watScore: wScore,
    windScore: wiScore,
    solarScore: sScore,
    dampScore: dScore
  };
}
```

### Evening timing flag

```javascript
function timingFlag(eveningTemps) {
  const avg = average(eveningTemps); // average of 5pm–10pm
  if (avg >= 15.5) return { text: 'Start after dinner', time: '~7pm' };
  if (avg >= 13.0) return { text: 'Start before dinner', time: '~5pm' };
  return { text: 'Start early afternoon', time: '~3pm' };
}
```

### Advice labels

```javascript
function adviceFromScore(score) {
  if (score < 1.5) return {
    label: 'No fire needed',
    detail: 'Mild night ahead',
    intensity: 0
  };
  if (score < 3.5) return {
    label: 'Light burn',
    detail: 'Optional warmth',
    intensity: 1
  };
  if (score < 5.5) return {
    label: 'Moderate burn',
    detail: 'Worth lighting tonight',
    intensity: 2
  };
  if (score < 7.5) return {
    label: 'Strong burn',
    detail: 'Prep the fireplace before dark',
    intensity: 3
  };
  return {
    label: 'Full burn — start early',
    detail: 'Cold night. Light well before dark.',
    intensity: 4
  };
}
```

---

## UI layout — modules/ui.js

### Overall layout

```
┌─────────────────────────────────────┐
│  [Location name]          [⚙ gear]  │  ← header bar
├─────────────────────────────────────┤
│                                     │
│   TONIGHT                           │
│   [flame icon — sized to intensity] │
│                                     │
│   7.2                               │  ← large score number
│   Strong burn                       │  ← advice label
│   Prep the fireplace before dark    │  ← detail text
│                                     │
│   Start before dinner  ~5pm         │  ← timing line
│                                     │
│   WAT 8.9°  Wind 1.4  Cloud 68%    │  ← subdued metric row
│                                     │
├─────────────────────────────────────┤
│  Tomorrow    ████  6.1  Moderate    │
│  Wednesday   ██    3.2  Light       │
│  Thursday    ░     1.0  No fire     │
└─────────────────────────────────────┘
```

### Hero card (tonight) — approximately 55% of screen height

- Large score number, bold, dominant
- Advice label in large readable type
- Detail sentence in lighter weight
- Timing line only shown when score ≥ 3.5
- Metric row (WAT, wind contribution, cloud) in small subdued type at bottom of hero
- Flame icon: SVG, scales in size and colour with intensity (0=none, 1=small pale, 2=medium amber, 3=large orange, 4=large intense orange-red with glow)

### Compact night rows (3 rows)

Each row shows:
- Day name (left)
- Small flame intensity bar (middle-left) — 4 segments, filled to intensity level
- Score number (middle-right)
- Advice label, abbreviated (right)

### Settings panel (gear icon)

Slide-in or modal panel containing:
- Location name field (text)
- Latitude field (number)
- Longitude field (number)
- A note: "Tip: find lat/lon at maps.google.com"
- Save button
- "Reset to Casuarina" link

Location is stored in localStorage. On save, re-fetch and re-render.

### Loading state

Show a calm loading message centred on screen: "Checking tonight's forecast…"

### Error state

If fetch fails: "Unable to load forecast. Check connection and try again." with a retry button.

---

## Design system

### Colour palette — warm, dark, domestic

```css
:root {
  --bg-primary: #1a1612;       /* very dark warm brown-black */
  --bg-card: #242018;          /* slightly lighter card surface */
  --bg-row: #1e1a15;           /* compact row background */
  --text-primary: #f0e8d8;     /* warm off-white */
  --text-secondary: #a89880;   /* warm mid-tone */
  --text-muted: #6b5e50;       /* subdued metrics */
  --accent-none: #4a4540;      /* no fire — cool grey */
  --accent-light: #c8a86b;     /* light burn — pale amber */
  --accent-moderate: #d4823a;  /* moderate — amber-orange */
  --accent-strong: #c85a1e;    /* strong — deep orange */
  --accent-full: #b83010;      /* full burn — red-orange */
  --border: #2e2820;           /* subtle divider */
}
```

### Typography

```css
body {
  font-family: -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif;
  /* iOS system font — clean, readable */
}
```

### Score number

```css
.score-number {
  font-size: clamp(72px, 18vw, 108px);
  font-weight: 700;
  letter-spacing: -2px;
  line-height: 1;
}
```

### Flame icon

Create an SVG flame icon in assets/icons/icon.svg. Scale size and colour using the intensity level (0–4). Intensity 0 = no flame shown (show a small ash/ember icon instead). Intensity 4 = large flame with a subtle warm glow effect.

### General

- No borders on cards except a subtle 1px --border colour divider between hero and rows
- No drop shadows
- Generous padding, not cramped
- All interactive elements have a subtle active state (scale 0.97 on tap)
- Safe area insets handled for iPhone notch/Dynamic Island

---

## PWA setup

### manifest.json

```json
{
  "name": "Home Chill Factor",
  "short_name": "Chill Factor",
  "description": "Overnight fireplace guidance for your home",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1612",
  "theme_color": "#1a1612",
  "orientation": "portrait",
  "icons": [
    { "src": "/assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Generate icon-192.png and icon-512.png as simple flame icons on the dark background colour using a Canvas-based generation script, OR create them as SVG and convert. Use the warm accent colours.

### service-worker.js

Implement a cache-first service worker that:
- Caches all static assets on install (index.html, app.js, style.css, icons)
- Serves from cache when offline
- For API requests (open-meteo.com), uses network-first with cache fallback
- Cache name: `home-chill-v1`
- On activate, cleans up old cache versions

### index.html

Register the service worker. Include manifest link. Set theme-color meta tag. Set apple-mobile-web-app-capable and apple-mobile-web-app-status-bar-style meta tags for proper iOS standalone behaviour.

---

## Notification logic — modules/notifications.js

### Behaviour

- Notification fires when: score for tonight >= 7.5 AND current time is between 13:30 and 15:00 AND notification has not already been sent today
- Notification message: "Cold night ahead — prep the fireplace now for overnight warmth."
- Check this condition each time the app loads/refreshes
- Store last notification date in localStorage as `lastNotificationDate`
- Request notification permission on first load (after a brief delay, not immediately on open)

### Implementation note

On iOS PWA, push notifications require the app to be open. Implement as a timed check on app load — if conditions are met and the time window applies, show the notification. Do not attempt background push.

```javascript
async function checkAndNotify(tonightScore) {
  if (tonightScore < 7.5) return;

  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  const timeValue = hour + minutes / 60;

  if (timeValue < 13.5 || timeValue > 15.0) return;

  const lastSent = localStorage.getItem('lastNotificationDate');
  const today = now.toDateString();
  if (lastSent === today) return;

  if (Notification.permission === 'granted') {
    new Notification('Home Chill Factor', {
      body: 'Cold night ahead — prep the fireplace now for overnight warmth.',
      icon: '/assets/icons/icon-192.png'
    });
    localStorage.setItem('lastNotificationDate', today);
  } else if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      new Notification('Home Chill Factor', {
        body: 'Cold night ahead — prep the fireplace now for overnight warmth.',
        icon: '/assets/icons/icon-192.png'
      });
      localStorage.setItem('lastNotificationDate', today);
    }
  }
}
```

---

## app.js — main entry point

```javascript
// 1. Load location from localStorage or use default
// 2. Fetch weather data
// 3. Parse into 4 night objects
// 4. Compute chill score for each night
// 5. Render UI (hero + 3 rows)
// 6. Check notification condition
// 7. Add pull-to-refresh behaviour
// 8. Wire up settings panel open/close and save
```

---

## Data refresh

- Refresh data on every app open (no aggressive caching of weather data)
- Add a subtle pull-to-refresh gesture
- Show "Last updated: X minutes ago" in very small text at the bottom of the screen
- Store last fetch timestamp in localStorage

---

## README.md

Write a clear README covering:
- What the app does
- How to run locally (just open index.html in a browser or use `npx serve .`)
- How to deploy to Vercel (drag folder into vercel.com or `vercel deploy`)
- How to install as PWA on iPhone
- How the scoring model works (brief summary)

---

## Implementation order

Build in this sequence:
1. File structure and HTML shell
2. manifest.json and service-worker.js
3. modules/weather.js (fetch + parse)
4. modules/scoring.js (complete scoring model)
5. style.css (complete design system)
6. modules/ui.js (render hero + rows + settings)
7. modules/notifications.js
8. app.js (wire everything together)
9. Generate PWA icons
10. Test data flow end to end with console logging
11. Final polish pass on UI

---

## Quality criteria

- Works fully offline after first load (cached)
- Installable as PWA on iPhone via Safari Add to Home Screen
- No console errors
- Renders correctly at iPhone SE width (375px) through iPhone Pro Max (430px)
- Score model matches spec exactly — do not approximate the weight values
- Settings persist across sessions
- Graceful error handling if API is unreachable
