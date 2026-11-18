// Live Singapore weather, reduced to a single "is it raining right now?" signal.
//
// Data source: NEA's 2-hour Weather Forecast API, served via data.gov.sg
// (https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast). It reports
// a short text forecast (e.g. "Light Rain", "Cloudy") for each of Singapore's
// ~47 forecast areas, refreshed roughly every 30 minutes.
//
// This module could not be integration-tested against the live API from the
// environment this was built in (network access to data.gov.sg was blocked),
// so the fetch wrapper is deliberately defensive: any failure (network,
// unexpected shape, CORS) rejects and the caller is expected to treat that as
// "unknown weather" rather than crash. The pure aggregation logic below is
// fully unit tested against mocked API shapes.
const NEA_TWO_HOUR_FORECAST_URL = 'https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast';
const RAIN_KEYWORDS = ['rain', 'shower', 'thundery'];

function isRainForecast(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return RAIN_KEYWORDS.some((k) => lower.includes(k));
}

// Given [{ area, forecast }, ...] across Singapore's forecast areas, decides
// whether it's raining "in Singapore" for the purpose of hiding outdoor
// suggestions. A single stray shower in one corner of the island shouldn't
// hide every outdoor activity, so this only flips once a meaningful share of
// areas are reporting rain.
const RAIN_FRACTION_THRESHOLD = 0.2;

function summarizeForecast(forecasts) {
  if (!forecasts || forecasts.length === 0) {
    return { isRaining: false, rainingAreaCount: 0, totalAreaCount: 0, rainingFraction: 0 };
  }
  const rainingAreaCount = forecasts.filter((f) => isRainForecast(f.forecast)).length;
  const totalAreaCount = forecasts.length;
  const rainingFraction = rainingAreaCount / totalAreaCount;
  return {
    isRaining: rainingFraction >= RAIN_FRACTION_THRESHOLD,
    rainingAreaCount,
    totalAreaCount,
    rainingFraction,
  };
}

// ---- Scene for the header illustration --------------------------------------
// Reduces the same per-area forecast to: how cloudy is the sky, and which
// third of the island (west / central / east) has rain. Zones come from each
// area's longitude in the API's area_metadata; if that is missing, rain is
// treated as island-wide or absent. Display only: filtering still uses
// summarizeForecast's isRaining.
const WEST_MAX_LNG = 103.74;
const EAST_MIN_LNG = 103.88;
const ZONE_RAIN_FRACTION = 0.3;

function cloudScore(text) {
  const lower = (text || '').toLowerCase();
  if (!lower) return null;
  if (lower.includes('partly')) return 0.5;
  if (['cloud', 'overcast', 'haz', 'mist', 'fog'].some((k) => lower.includes(k))) return 1;
  return 0; // Fair, Fair & Warm, Windy, ...
}

function zoneOfLongitude(lng) {
  if (typeof lng !== 'number') return null;
  if (lng < WEST_MAX_LNG) return 'west';
  if (lng > EAST_MIN_LNG) return 'east';
  return 'central';
}

function sceneFromForecasts(forecasts, areaMetadata) {
  const list = forecasts || [];
  if (list.length === 0) return null;
  const lngByArea = {};
  (areaMetadata || []).forEach((m) => {
    if (m && m.name && m.label_location) lngByArea[m.name] = m.label_location.longitude;
  });
  const zones = { west: [0, 0], central: [0, 0], east: [0, 0] }; // [raining, total]
  let scoreSum = 0;
  let scored = 0;
  let rainCount = 0;
  list.forEach((f) => {
    const raining = isRainForecast(f.forecast);
    if (raining) rainCount += 1;
    else {
      const s = cloudScore(f.forecast);
      if (s !== null) { scoreSum += s; scored += 1; }
    }
    const zone = zoneOfLongitude(lngByArea[f.area]);
    if (zone) { zones[zone][1] += 1; if (raining) zones[zone][0] += 1; }
  });
  const haveZones = zones.west[1] + zones.central[1] + zones.east[1] > 0;
  const islandRain = rainCount / list.length >= RAIN_FRACTION_THRESHOLD;
  const rain = {};
  ['west', 'central', 'east'].forEach((z) => {
    rain[z] = haveZones
      ? zones[z][1] > 0 && zones[z][0] / zones[z][1] >= ZONE_RAIN_FRACTION
      : islandRain;
  });
  const avg = scored ? scoreSum / scored : 0;
  const sky = avg < 0.25 ? 'clear' : avg < 0.65 ? 'partly' : 'cloudy';
  return { sky, rain };
}

// Singapore is UTC+8 all year. Day is 07:00-19:00 there, whatever the device clock zone is.
function isNightInSingapore(date) {
  const h = (date.getUTCHours() + 8) % 24;
  return h < 7 || h >= 19;
}

async function fetchSingaporeWeather(fetchImpl = fetch) {
  const res = await fetchImpl(NEA_TWO_HOUR_FORECAST_URL);
  if (!res.ok) throw new Error(`NEA API returned ${res.status}`);
  const json = await res.json();
  const items = json && json.data && json.data.items;
  const forecasts = items && items[0] && items[0].forecasts;
  const summary = summarizeForecast(forecasts || []);
  summary.scene = sceneFromForecasts(forecasts, json.data && json.data.area_metadata);
  return summary;
}

const weatherApi = { isRainForecast, summarizeForecast, fetchSingaporeWeather, sceneFromForecasts, isNightInSingapore, RAIN_FRACTION_THRESHOLD };

if (typeof module !== 'undefined') module.exports = weatherApi;
if (typeof window !== 'undefined') window.BoredWeather = weatherApi;
