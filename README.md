# Home Chill Factor

A calm, domestic Progressive Web App that tells you how much firewood effort tonight deserves.

It is **not** a weather dashboard. It answers one question: *do I need to light the fire, and when?*

---

## What it does

Home Chill Factor fetches a 5-day hourly forecast from Open-Meteo (free, no API key) and computes a **Chill Score** (0–10) for each of the next four nights. The score drives a simple recommendation:

| Score | Advice |
|-------|--------|
| < 1.5 | No fire needed |
| 1.5–3.4 | Light burn — optional warmth |
| 3.5–5.4 | Moderate burn — worth lighting tonight |
| 5.5–7.4 | Strong burn — prep before dark |
| ≥ 7.5 | Full burn — start early afternoon |

It also tells you *when* to light based on how cold the evening is (5pm–10pm average temperature).

---

## How the scoring model works

The score is a weighted sum of four factors, capped at 10:

**WAT (Weighted Average Temperature) — up to 7.5 pts**
The overnight window (11pm–7am) is weighted toward the coldest early-morning hours. The WAT value is mapped to a score: colder WAT → higher score.

**Wind chill — up to 2.0 pts**
The gap between actual and apparent minimum temperature indicates wind chill. A direction multiplier reflects how the house orientation responds to different wind directions (NW/W winds hit the long face hardest).

**Solar deprivation — up to 0.3 pts**
Heavy cloud cover in the afternoon (1pm–5pm) means less passive solar gain heating the house during the day.

**Dampness — up to 0.2 pts**
High overnight humidity combined with overcast afternoons adds a small dampness penalty.

---

## Run locally

No build step required. Just open `index.html` via a local HTTP server (required for service worker and ES modules):

```bash
npx serve .
# then open http://localhost:3000
```

Or with Python:

```bash
python3 -m http.server 3000
```

---

## Deploy to Vercel

**Option 1 — Drag and drop:**
Go to [vercel.com](https://vercel.com), log in, click *Add New Project*, and drag the `home-chill-factor` folder into the deploy area.

**Option 2 — CLI:**
```bash
npm i -g vercel
cd home-chill-factor
vercel deploy
```

The app is entirely static — no server-side functions needed.

---

## Install as PWA on iPhone

1. Open the deployed URL in **Safari** on iPhone
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. Tap **Add**

The app will open full-screen with no browser chrome, just like a native app. After first load, it works offline via the service worker cache.

**Note on notifications:** iOS requires the app to be open for notifications to fire. If tonight's score is ≥ 7.5 and it's between 1:30pm and 3pm, the app will show a notification prompting you to light early.

---

## Regenerating icons

Icons are pre-built. To regenerate them:

```bash
npm install canvas
node generate-icons.mjs
```

---

## Default location

Casuarina NSW (lat: -28.319, lon: 153.574). Change it via the ⚙ gear icon in the app — settings persist across sessions.
