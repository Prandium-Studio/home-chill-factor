// Hours: 21:00, 22:00, 23:00, 00:00, 01:00, 02:00, 03:00, 04:00, 05:00, 06:00, 07:00
const WAT_WEIGHTS = [0.2, 0.3, 0.5, 1.0, 1.5, 2.0, 2.5, 2.5, 3.0, 2.0, 0.5];
const WAT_WEIGHT_SUM = 16.5;

function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function computeWAT(coreTemps) {
  const len = Math.min(coreTemps.length, WAT_WEIGHTS.length);
  let weightedSum = 0, weightSum = 0;
  for (let i = 0; i < len; i++) {
    weightedSum += coreTemps[i] * WAT_WEIGHTS[i];
    weightSum += WAT_WEIGHTS[i];
  }
  return weightedSum / (weightSum || WAT_WEIGHT_SUM);
}

function watScore(wat) {
  if (wat >= 16.0) return 0;
  if (wat >= 14.0) return 1.0;
  if (wat >= 13.0) return 3.0;
  if (wat >= 12.0) return 3.5;
  if (wat >= 11.0) return 5.0;
  if (wat >= 10.0) return 5.5;
  if (wat >= 9.0)  return 6.2;
  if (wat >= 8.0)  return 7.0;
  if (wat >= 7.0)  return 7.5;
  return 8.0;
}

function windScore(maxOvernightGap, windDirection) {
  const diff = maxOvernightGap;

  let base;
  if (diff <= 1)      base = 0;
  else if (diff <= 3) base = 0.7;
  else if (diff <= 5) base = 1.3;
  else                base = 2.0;

  let dirFactor;
  const d = windDirection;
  if (d >= 150 && d <= 315)     dirFactor = 1.0;   // SSE–WNW: full weight
  else if (d >= 0 && d <= 90)  dirFactor = 0.5;   // N–NE: mild air mass
  else                          dirFactor = 0.75;  // 91–149, 316–359

  return Math.min(base * dirFactor, 2.0);
}

function solarScore(afternoonCloudAvg) {
  if (afternoonCloudAvg <= 30) return 0;
  if (afternoonCloudAvg <= 60) return 0.2;
  if (afternoonCloudAvg <= 84) return 0.5;
  return 0.8;
}

function dampnessScore(overnightHumidity, afternoonCloudAvg) {
  if (overnightHumidity > 90 && afternoonCloudAvg > 84) return 0.5;
  if (overnightHumidity > 80 && afternoonCloudAvg > 70) return 0.3;
  return 0;
}

function daytimeSoakScore(daytimeGaps) {
  if (!daytimeGaps || !daytimeGaps.length) return 0;
  const avg = average(daytimeGaps);
  if (avg <= 1) return 0;
  if (avg <= 2) return 0.5;
  if (avg <= 4) return 0.8;
  return 1.5;
}

function eveningDropScore(eveningTemps) {
  // Sub-factor A: temp drop 16:00→21:00, max 1.5 pts
  if (!eveningTemps || eveningTemps.length < 6) return 0;
  const drop = eveningTemps[0] - eveningTemps[5]; // 16:00 minus 21:00
  if (drop <= 2) return 0;
  if (drop <= 4) return 0.7;
  if (drop <= 7) return 1.2;
  return 1.5;
}

function eveningWindScore(eveningGaps) {
  // Sub-factor B: avg actual/apparent gap 16:00–21:00, max 1.0 pts
  if (!eveningGaps || !eveningGaps.length) return 0;
  const avg = average(eveningGaps);
  if (avg <= 1) return 0;
  if (avg <= 2) return 0.3;
  if (avg <= 4) return 0.6;
  return 1.0;
}

export function computeChillScore(nightData) {
  const wat = computeWAT(nightData.coreTemps);
  const avgCloud = average(nightData.afternoonCloud);
  const wScore  = watScore(wat);
  const wiScore = windScore(nightData.maxOvernightGap, nightData.windDirection);
  const sScore  = solarScore(avgCloud);
  const dScore  = dampnessScore(nightData.overnightHumidity, avgCloud);
  const soakScore  = daytimeSoakScore(nightData.daytimeGaps);
  const dropScore  = eveningDropScore(nightData.eveningTemps);
  const eWindScore = eveningWindScore(nightData.eveningGaps);

  const total = Math.min(wScore + wiScore + sScore + dScore + soakScore + dropScore + eWindScore, 10);

  return {
    total: Math.round(total * 10) / 10,
    wat: Math.round(wat * 10) / 10,
    watScore: wScore,
    windScore: wiScore,
    solarScore: sScore,
    dampScore: dScore,
    soakScore,
    dropScore,
    eWindScore,
    avgCloud: Math.round(avgCloud)
  };
}

export function timingFlag(score) {
  // Derived from score so timing always agrees with the advice band
  if (score > 8.0)  return { text: 'Consider lighting',    time: '3–4pm' };
  if (score >= 5.7) return { text: 'Start before dinner',  time: '~5pm' };
  return              { text: 'Start after dinner',         time: '~7pm' };
}

export function adviceFromScore(score) {
  if (score < 1.5)  return { label: 'No fire needed',       rowLabel: 'No fire',   detail: 'Mild night ahead',                    intensity: 0 };
  if (score < 3.5)  return { label: 'Light burn',           rowLabel: 'Light',     detail: 'Optional warmth',                     intensity: 1 };
  if (score < 5.7)  return { label: 'Moderate burn',        rowLabel: 'Moderate',  detail: 'Worth lighting tonight',              intensity: 2 };
  if (score <= 8.0) return { label: 'Strong burn',          rowLabel: 'Strong',    detail: 'Prep the fireplace before dark',      intensity: 3 };
  return              { label: 'Full burn — start early', rowLabel: 'Full burn', detail: 'Cold night. Light well before dark.', intensity: 4 };
}
