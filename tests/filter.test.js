const test = require('node:test');
const assert = require('node:assert/strict');
const { matchesFilters, filterActivities, pickActivity, computeStreak } = require('../filter.js');
const ACTIVITIES = require('../data.js');

test('data set has unique, well-formed ids', () => {
  const ids = ACTIVITIES.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids found');
  for (const a of ACTIVITIES) {
    assert.ok(a.text && a.text.length > 0, `activity ${a.id} missing text`);
    assert.ok(typeof a.minMinutes === 'number' && a.minMinutes > 0, `activity ${a.id} bad minMinutes`);
    assert.ok(['free', 'low', 'paid'].includes(a.cost), `activity ${a.id} bad cost`);
    assert.ok(['low', 'med', 'high'].includes(a.energy), `activity ${a.id} bad energy`);
    assert.ok(['indoor', 'outdoor', 'any'].includes(a.location), `activity ${a.id} bad location`);
    assert.ok(Array.isArray(a.tags) && a.tags.length > 0, `activity ${a.id} missing tags`);
  }
});

test('matchesFilters: time cutoff is inclusive of exact match, excludes longer', () => {
  const activity = { minMinutes: 15, cost: 'free', energy: 'low', location: 'any' };
  assert.equal(matchesFilters(activity, { time: '15' }), true);
  assert.equal(matchesFilters(activity, { time: '10' }), false);
  assert.equal(matchesFilters(activity, { time: 'any' }), true);
});

test('matchesFilters: cost "free" excludes low and paid; "low" excludes only paid', () => {
  const free = { minMinutes: 5, cost: 'free', energy: 'low', location: 'any' };
  const low = { minMinutes: 5, cost: 'low', energy: 'low', location: 'any' };
  const paid = { minMinutes: 5, cost: 'paid', energy: 'low', location: 'any' };

  assert.equal(matchesFilters(low, { cost: 'free' }), false);
  assert.equal(matchesFilters(paid, { cost: 'free' }), false);
  assert.equal(matchesFilters(free, { cost: 'free' }), true);

  assert.equal(matchesFilters(paid, { cost: 'low' }), false);
  assert.equal(matchesFilters(low, { cost: 'low' }), true);
  assert.equal(matchesFilters(free, { cost: 'low' }), true);
});

test('matchesFilters: location "any" on the activity always matches a specific filter', () => {
  const anywhere = { minMinutes: 5, cost: 'free', energy: 'low', location: 'any' };
  assert.equal(matchesFilters(anywhere, { location: 'indoor' }), true);
  assert.equal(matchesFilters(anywhere, { location: 'outdoor' }), true);

  const indoorOnly = { minMinutes: 5, cost: 'free', energy: 'low', location: 'indoor' };
  assert.equal(matchesFilters(indoorOnly, { location: 'outdoor' }), false);
});

test('filterActivities narrows the full data set without throwing', () => {
  const result = filterActivities(ACTIVITIES, { time: '15', cost: 'free', energy: 'low', location: 'indoor' });
  assert.ok(Array.isArray(result));
  for (const a of result) {
    assert.equal(matchesFilters(a, { time: '15', cost: 'free', energy: 'low', location: 'indoor' }), true);
  }
});

test('pickActivity avoids recent ids when alternatives exist', () => {
  const activities = [
    { id: 1, minMinutes: 5, cost: 'free', energy: 'low', location: 'any' },
    { id: 2, minMinutes: 5, cost: 'free', energy: 'low', location: 'any' },
  ];
  // rng that always picks index 0 of whatever candidate array it's given
  const rng = () => 0;
  const picked = pickActivity(activities, {}, [1], rng);
  assert.equal(picked.id, 2);
});

test('pickActivity falls back to the full pool once recent ids exhaust it', () => {
  const activities = [{ id: 1, minMinutes: 5, cost: 'free', energy: 'low', location: 'any' }];
  const picked = pickActivity(activities, {}, [1], () => 0);
  assert.equal(picked.id, 1);
});

test('pickActivity returns null when nothing matches', () => {
  const activities = [{ id: 1, minMinutes: 5, cost: 'free', energy: 'low', location: 'any' }];
  const picked = pickActivity(activities, { time: '1' }, [], () => 0);
  assert.equal(picked, null);
});

test('computeStreak is 0 for no history', () => {
  assert.equal(computeStreak([]), 0);
  assert.equal(computeStreak(null), 0);
});

test('computeStreak counts consecutive days ending today', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const timestamps = [now, now - day, now - 2 * day];
  assert.equal(computeStreak(timestamps, now), 3);
});

test('computeStreak still counts as alive if today has no entry yet but yesterday does', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const timestamps = [now - day, now - 2 * day];
  assert.equal(computeStreak(timestamps, now), 2);
});

test('computeStreak breaks on a gap', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const timestamps = [now, now - 3 * day];
  assert.equal(computeStreak(timestamps, now), 1);
});
