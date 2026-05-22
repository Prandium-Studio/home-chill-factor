const WAT_WEIGHTS = [0.5, 1.0, 1.5, 2.0, 2.5, 2.5, 3.0, 2.0, 0.5];
const WAT_WEIGHT_SUM = 16.0;

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
  if (wat >= 12.0) return 3.5;
  if (wat >= 10.0) return 5.5;
  if (wat >= 8.0)  return 6.5;
  if (wat >= 7.0)  return 7.0;
  return 7.5;
}

function windScore(minActual, minApparent, windDirection) {
  const diff = minActual - minApparent;

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
  if (afternoonCloudAvg <= 60) return 0.1;
  if (afternoonCloudAvg <= 84) return 0.2;
  return 0.3;
}

function dampnessScore(overnightHumidity, afternoonCloudAvg) {
  if (overnightHumidity > 90 && afternoonCloudAvg > 85) return 0.2;
  if (overnightHumidity > 80 && afternoonCloudAvg > 70) return 0.1;
  return 0;
}

export function computeChillScore(nightData) {
  const wat = computeWAT(nightData.coreTemps);
  const avgCloud = average(nightData.afternoonCloud);
  const wScore = watScore(wat);
  const wiScore = windScore(nightData.minActualTemp, nightData.minApparentTemp, nightData.windDirection);
  const sScore = solarScore(avgCloud);
  const dScore = dampnessScore(nightData.overnightHumidity, avgCloud);

  const total = Math.min(wScore + wiScore + sScore + dScore, 10);

  return {
    total: Math.round(total * 10) / 10,
    wat: Math.round(wat * 10) / 10,
    watScore: wScore,
    windScore: wiScore,
    solarScore: sScore,
    dampScore: dScore,
    avgCloud: Math.round(avgCloud)
  };
}

export function timingFlag(eveningTemps) {
  const avg = average(eveningTemps);
  if (avg >= 15.5) return { text: 'Start after dinner', time: '~7pm' };
  if (avg >= 13.0) return { text: 'Start before dinner', time: '~5pm' };
  return { text: 'Start early afternoon', time: '~3pm' };
}

export function adviceFromScore(score) {
  if (score < 1.5) return { label: 'No fire needed',       rowLabel: 'No fire',   detail: 'Mild night ahead',                    intensity: 0 };
  if (score < 3.5) return { label: 'Light burn',           rowLabel: 'Light',     detail: 'Optional warmth',                     intensity: 1 };
  if (score < 5.5) return { label: 'Moderate burn',        rowLabel: 'Moderate',  detail: 'Worth lighting tonight',              intensity: 2 };
  if (score < 7.5) return { label: 'Strong burn',          rowLabel: 'Strong',    detail: 'Prep the fireplace before dark',      intensity: 3 };
  return             { label: 'Full burn — start early', rowLabel: 'Full burn', detail: 'Cold night. Light well before dark.', intensity: 4 };
}
