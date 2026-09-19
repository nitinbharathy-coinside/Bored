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

async function fetchSingaporeWeather(fetchImpl = fetch) {
  const res = await fetchImpl(NEA_TWO_HOUR_FORECAST_URL);
  if (!res.ok) throw new Error(`NEA API returned ${res.status}`);
  const json = await res.json();
  const items = json && json.data && json.data.items;
  const forecasts = items && items[0] && items[0].forecasts;
  return summarizeForecast(forecasts || []);
}

const weatherApi = { isRainForecast, summarizeForecast, fetchSingaporeWeather, RAIN_FRACTION_THRESHOLD };

if (typeof module !== 'undefined') module.exports = weatherApi;
if (typeof window !== 'undefined') window.BoredWeather = weatherApi;
