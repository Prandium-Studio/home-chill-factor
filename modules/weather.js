export const DEFAULT_LOCATION = {
  name: 'Casuarina NSW',
  lat: -28.319,
  lon: 153.574
};

export async function fetchWeather(location) {
  const { lat, lon } = location;
  const url = `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,cloud_cover,relative_humidity_2m` +
    `&timezone=Australia%2FSydney` +
    `&forecast_days=5`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Weather API error: ${response.status}`);
  return response.json();
}

function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function mode(arr) {
  if (!arr.length) return 0;
  const counts = {};
  let maxCount = 0, modeVal = arr[0];
  for (const v of arr) {
    counts[v] = (counts[v] || 0) + 1;
    if (counts[v] > maxCount) { maxCount = counts[v]; modeVal = v; }
  }
  return modeVal;
}

export function parseNights(data) {
  const times = data.hourly.time;           // "YYYY-MM-DDTHH:MM"
  const temp = data.hourly.temperature_2m;
  const apparent = data.hourly.apparent_temperature;
  const wind = data.hourly.wind_speed_10m;
  const windDir = data.hourly.wind_direction_10m;
  const cloud = data.hourly.cloud_cover;
  const humidity = data.hourly.relative_humidity_2m;

  // Build a map: "YYYY-MM-DDTHH:MM" → index
  const timeIndex = {};
  times.forEach((t, i) => { timeIndex[t] = i; });

  function getVal(arr, dateStr, hour) {
    const key = `${dateStr}T${String(hour).padStart(2, '0')}:00`;
    const i = timeIndex[key];
    return i !== undefined ? arr[i] : null;
  }

  // Determine base date in Sydney timezone — API times are Sydney-local
  const now = new Date();
  const sydneyFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const sydneyTimeFormatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    hour: 'numeric', hour12: false
  });
  const currentHour = parseInt(sydneyTimeFormatter.format(now), 10);

  // If past 22:00, shift night 0 forward one calendar day
  const startOffset = currentHour >= 22 ? 1 : 0;

  function dateString(daysFromNow) {
    // Compute Sydney local date + offset
    const sydBase = sydneyFormatter.format(now); // "YYYY-MM-DD"
    const d = new Date(sydBase + 'T12:00:00');   // noon UTC on that date (avoids DST edge)
    d.setDate(d.getDate() + daysFromNow);
    return sydneyFormatter.format(d);
  }

  function dayLabel(daysFromNow) {
    if (daysFromNow === 0) return 'Tonight';
    if (daysFromNow === 1) return 'Tomorrow';
    const sydBase = sydneyFormatter.format(now);
    const d = new Date(sydBase + 'T12:00:00');
    d.setDate(d.getDate() + daysFromNow);
    return d.toLocaleDateString('en-AU', { weekday: 'long', timeZone: 'Australia/Sydney' });
  }

  const nights = [];

  for (let n = 0; n < 4; n++) {
    const offset = n + startOffset;
    const eveningDate = dateString(offset);
    const watDate = dateString(offset);       // 23:00 start
    const watNextDate = dateString(offset + 1); // 00:00–07:00

    // Evening: 17:00–22:00 (6 hours)
    const eveningHours = [17, 18, 19, 20, 21, 22];
    const eveningTemps = eveningHours.map(h => getVal(temp, eveningDate, h)).filter(v => v !== null);

    // WAT window: 23:00 same day, then 00:00–07:00 next day (9 total)
    const watTemps = [];
    const watApparent = [];
    const watHumidity = [];
    const watWindDir = [];

    const v23t = getVal(temp, watDate, 23);
    const v23a = getVal(apparent, watDate, 23);
    const v23h = getVal(humidity, watDate, 23);
    const v23d = getVal(windDir, watDate, 23);
    if (v23t !== null) watTemps.push(v23t);
    if (v23a !== null) watApparent.push(v23a);
    if (v23h !== null) watHumidity.push(v23h);
    if (v23d !== null) watWindDir.push(v23d);

    for (const h of [0, 1, 2, 3, 4, 5, 6, 7]) {
      const vt = getVal(temp, watNextDate, h);
      const va = getVal(apparent, watNextDate, h);
      const vh = getVal(humidity, watNextDate, h);
      const vd = getVal(windDir, watNextDate, h);
      if (vt !== null) watTemps.push(vt);
      if (va !== null) watApparent.push(va);
      if (vh !== null) watHumidity.push(vh);
      if (vd !== null) watWindDir.push(vd);
    }

    // Solar window: 13:00–17:00 (5 hours)
    const solarHours = [13, 14, 15, 16, 17];
    const afternoonCloud = solarHours.map(h => getVal(cloud, eveningDate, h)).filter(v => v !== null);

    const minActualTemp = watTemps.length ? Math.min(...watTemps) : 10;
    const minApparentTemp = watApparent.length ? Math.min(...watApparent) : 10;

    nights.push({
      label: dayLabel(offset),
      date: new Date(eveningDate),
      coreTemps: watTemps,
      coreApparent: watApparent,
      eveningTemps,
      afternoonCloud,
      overnightHumidity: average(watHumidity),
      windDirection: mode(watWindDir),
      minActualTemp,
      minApparentTemp
    });
  }

  return nights;
}
