// Pure logic for filtering/picking activities and computing streaks.
// Kept dependency-free and DOM-free so it can be unit tested directly.

// Ascending price bands, used to turn the "cost" filter into a max-budget cutoff.
const COST_ORDER = ['free', 'under10', '10to30', '30plus'];

// Who is going. Activities opt in with an optional `suits` array; an activity
// with no `suits` is never offered when a specific group is chosen.
const WHO_VALUES = ['kids', 'easy', 'date', 'group'];

function matchesFilters(activity, filters) {
  const { time = 'any', cost = 'any', energy = 'any', location = 'any', area = 'any', who = 'any' } = filters || {};

  if (time !== 'any' && activity.minMinutes > Number(time)) return false;

  if (cost !== 'any') {
    const maxIdx = COST_ORDER.indexOf(cost);
    const actIdx = COST_ORDER.indexOf(activity.cost);
    if (actIdx === -1 || maxIdx === -1 || actIdx > maxIdx) return false;
  }

  if (energy !== 'any' && activity.energy !== energy) return false;
  if (location !== 'any' && activity.location !== 'any' && activity.location !== location) return false;
  if (area !== 'any' && activity.area !== 'Islandwide' && activity.area !== area) return false;
  if (who !== 'any' && !(activity.suits && activity.suits.includes(who))) return false;

  return true;
}

// Rough centre of each part of the island, used only to guess which region a
// GPS fix is in. This is a nearest-centre guess, not real region boundaries,
// so places near a border can land on the wrong side. The UI says so and the
// user can change the selection.
const AREA_CENTRES = {
  Central: [1.32, 103.84],
  East: [1.33, 103.94],
  West: [1.345, 103.7],
  North: [1.42, 103.81],
  'North-East': [1.385, 103.89],
};
const SG_BOUNDS = { minLat: 1.15, maxLat: 1.48, minLng: 103.6, maxLng: 104.1 };

// Returns one of the area names, or null when the coordinates are invalid or
// clearly outside Singapore.
function nearestArea(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < SG_BOUNDS.minLat || lat > SG_BOUNDS.maxLat || lng < SG_BOUNDS.minLng || lng > SG_BOUNDS.maxLng) return null;
  // The south coast, Sentosa and the southern islands sit below the main island.
  if (lat < 1.268 && lng > 103.78 && lng < 103.9) return 'South';
  let best = null;
  let bestDist = Infinity;
  Object.entries(AREA_CENTRES).forEach(([name, [clat, clng]]) => {
    const d = (lat - clat) ** 2 + (lng - clng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  });
  return best;
}

// Weather is handled separately from the user's own filters: it's an
// automatic, overridable safety net rather than something the user picks
// from a dropdown. `weatherContext` is `{ isRaining, ignoreWeather }`;
// omitting it (or setting isRaining false) applies no weather filtering.
function passesWeather(activity, weatherContext) {
  if (!weatherContext || !weatherContext.isRaining || weatherContext.ignoreWeather) return true;
  return !activity.weatherSensitive;
}

function filterActivities(activities, filters, weatherContext) {
  return activities.filter((a) => matchesFilters(a, filters) && passesWeather(a, weatherContext));
}

// Picks a random activity from `activities` matching `filters` and the
// current weather, avoiding ids in `recentIds` when possible. `rng` defaults
// to Math.random but is injectable for deterministic tests.
function pickActivity(activities, filters, recentIds, rng = Math.random, weatherContext) {
  const pool = filterActivities(activities, filters, weatherContext);
  if (pool.length === 0) return null;

  let candidates = pool.filter((a) => !recentIds.includes(a.id));
  if (candidates.length === 0) candidates = pool;

  return candidates[Math.floor(rng() * candidates.length)];
}

// Fisher-Yates shuffle into a new array; `rng` is injectable for tests.
function shuffle(items, rng = Math.random) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Every activity matching the user's own filters, in random order. Weather is
// deliberately not applied here: the deck applies it live, so a forecast that
// arrives late doesn't force a rebuild.
function buildDeck(activities, filters, rng = Math.random) {
  return shuffle(activities.filter((a) => matchesFilters(a, filters)), rng);
}

// Given an ascending array of ms timestamps, returns the current daily streak:
// the number of consecutive calendar days, counting back from today, that
// have at least one entry. A gap of more than one day breaks the streak.
function computeStreak(timestamps, now = Date.now()) {
  if (!timestamps || timestamps.length === 0) return 0;

  const toDayKey = (ms) => new Date(ms).toDateString();
  const days = new Set(timestamps.map(toDayKey));

  let streak = 0;
  let cursor = now;
  const oneDay = 24 * 60 * 60 * 1000;

  // Today doesn't have to have an entry yet for the streak to still be "alive".
  if (!days.has(toDayKey(cursor))) {
    cursor -= oneDay;
  }

  while (days.has(toDayKey(cursor))) {
    streak += 1;
    cursor -= oneDay;
  }

  return streak;
}

const filterApi = { COST_ORDER, WHO_VALUES, nearestArea, shuffle, buildDeck, matchesFilters, passesWeather, filterActivities, pickActivity, computeStreak };

if (typeof module !== 'undefined') module.exports = filterApi;
if (typeof window !== 'undefined') window.BoredFilter = filterApi;
