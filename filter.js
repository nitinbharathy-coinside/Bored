// Pure logic for filtering/picking activities and computing streaks.
// Kept dependency-free and DOM-free so it can be unit tested directly.

// Ascending price bands, used to turn the "cost" filter into a max-budget cutoff.
const COST_ORDER = ['free', 'under10', '10to30', '30plus'];

function matchesFilters(activity, filters) {
  const { time = 'any', cost = 'any', energy = 'any', location = 'any', area = 'any' } = filters || {};

  if (time !== 'any' && activity.minMinutes > Number(time)) return false;

  if (cost !== 'any') {
    const maxIdx = COST_ORDER.indexOf(cost);
    const actIdx = COST_ORDER.indexOf(activity.cost);
    if (actIdx === -1 || maxIdx === -1 || actIdx > maxIdx) return false;
  }

  if (energy !== 'any' && activity.energy !== energy) return false;
  if (location !== 'any' && activity.location !== 'any' && activity.location !== location) return false;
  if (area !== 'any' && activity.area !== 'Islandwide' && activity.area !== area) return false;

  return true;
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

const filterApi = { COST_ORDER, matchesFilters, passesWeather, filterActivities, pickActivity, computeStreak };

if (typeof module !== 'undefined') module.exports = filterApi;
if (typeof window !== 'undefined') window.BoredFilter = filterApi;
