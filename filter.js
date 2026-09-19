// Pure logic for filtering/picking activities and computing streaks.
// Kept dependency-free and DOM-free so it can be unit tested directly.

function matchesFilters(activity, filters) {
  const { time = 'any', cost = 'any', energy = 'any', location = 'any' } = filters || {};

  if (time !== 'any' && activity.minMinutes > Number(time)) return false;
  if (cost === 'free' && activity.cost !== 'free') return false;
  if (cost === 'low' && activity.cost === 'paid') return false;
  if (energy !== 'any' && activity.energy !== energy) return false;
  if (location !== 'any' && activity.location !== 'any' && activity.location !== location) return false;
  return true;
}

function filterActivities(activities, filters) {
  return activities.filter((a) => matchesFilters(a, filters));
}

// Picks a random activity from `activities` matching `filters`, avoiding ids
// in `recentIds` when possible. `rng` defaults to Math.random but is
// injectable for deterministic tests.
function pickActivity(activities, filters, recentIds, rng = Math.random) {
  const pool = filterActivities(activities, filters);
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

const api = { matchesFilters, filterActivities, pickActivity, computeStreak };

if (typeof module !== 'undefined') module.exports = api;
if (typeof window !== 'undefined') window.BoredFilter = api;
