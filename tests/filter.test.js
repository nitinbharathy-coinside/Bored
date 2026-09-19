const test = require('node:test');
const assert = require('node:assert/strict');
const { matchesFilters, filterActivities, pickActivity, computeStreak, COST_ORDER } = require('../filter.js');
const ACTIVITIES = require('../data.js');

const VALID_AREAS = ['Islandwide', 'Central', 'East', 'West', 'North', 'North-East', 'South'];

test('data set has unique, well-formed ids', () => {
  const ids = ACTIVITIES.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids found');
  for (const a of ACTIVITIES) {
    assert.ok(a.text && a.text.length > 0, `activity ${a.id} missing text`);
    assert.ok(typeof a.minMinutes === 'number' && a.minMinutes > 0, `activity ${a.id} bad minMinutes`);
    assert.ok(COST_ORDER.includes(a.cost), `activity ${a.id} bad cost`);
    assert.ok(['low', 'med', 'high'].includes(a.energy), `activity ${a.id} bad energy`);
    assert.ok(['indoor', 'outdoor', 'any'].includes(a.location), `activity ${a.id} bad location`);
    assert.ok(typeof a.weatherSensitive === 'boolean', `activity ${a.id} missing weatherSensitive`);
    assert.ok(VALID_AREAS.includes(a.area), `activity ${a.id} bad area`);
    assert.ok(Array.isArray(a.tags) && a.tags.length > 0, `activity ${a.id} missing tags`);
  }
});

test('matchesFilters: time cutoff is inclusive of exact match, excludes longer', () => {
  const activity = { minMinutes: 15, cost: 'free', energy: 'low', location: 'any', area: 'Islandwide' };
  assert.equal(matchesFilters(activity, { time: '15' }), true);
  assert.equal(matchesFilters(activity, { time: '10' }), false);
  assert.equal(matchesFilters(activity, { time: 'any' }), true);
});

test('matchesFilters: cost is a max-budget cutoff over ascending SGD bands', () => {
  const free = { minMinutes: 5, cost: 'free', energy: 'low', location: 'any', area: 'Islandwide' };
  const under10 = { minMinutes: 5, cost: 'under10', energy: 'low', location: 'any', area: 'Islandwide' };
  const tenTo30 = { minMinutes: 5, cost: '10to30', energy: 'low', location: 'any', area: 'Islandwide' };
  const thirtyPlus = { minMinutes: 5, cost: '30plus', energy: 'low', location: 'any', area: 'Islandwide' };

  assert.equal(matchesFilters(under10, { cost: 'free' }), false);
  assert.equal(matchesFilters(free, { cost: 'free' }), true);

  assert.equal(matchesFilters(tenTo30, { cost: 'under10' }), false);
  assert.equal(matchesFilters(under10, { cost: 'under10' }), true);
  assert.equal(matchesFilters(free, { cost: 'under10' }), true);

  assert.equal(matchesFilters(thirtyPlus, { cost: '10to30' }), false);
  assert.equal(matchesFilters(tenTo30, { cost: '10to30' }), true);

  assert.equal(matchesFilters(thirtyPlus, { cost: 'any' }), true);
});

test('matchesFilters: location "any" on the activity always matches a specific filter', () => {
  const anywhere = { minMinutes: 5, cost: 'free', energy: 'low', location: 'any', area: 'Islandwide' };
  assert.equal(matchesFilters(anywhere, { location: 'indoor' }), true);
  assert.equal(matchesFilters(anywhere, { location: 'outdoor' }), true);

  const indoorOnly = { minMinutes: 5, cost: 'free', energy: 'low', location: 'indoor', area: 'Islandwide' };
  assert.equal(matchesFilters(indoorOnly, { location: 'outdoor' }), false);
});

test('matchesFilters: area "Islandwide" on the activity always matches a specific area filter', () => {
  const islandwide = { minMinutes: 5, cost: 'free', energy: 'low', location: 'any', area: 'Islandwide' };
  assert.equal(matchesFilters(islandwide, { area: 'East' }), true);

  const eastOnly = { minMinutes: 5, cost: 'free', energy: 'low', location: 'any', area: 'East' };
  assert.equal(matchesFilters(eastOnly, { area: 'West' }), false);
  assert.equal(matchesFilters(eastOnly, { area: 'East' }), true);
  assert.equal(matchesFilters(eastOnly, { area: 'any' }), true);
});

test('filterActivities narrows the full data set without throwing', () => {
  const filters = { time: '30', cost: 'under10', energy: 'low', location: 'outdoor', area: 'Central' };
  const result = filterActivities(ACTIVITIES, filters);
  assert.ok(Array.isArray(result));
  for (const a of result) {
    assert.equal(matchesFilters(a, filters), true);
  }
});

test('filterActivities hides weather-sensitive activities when it is raining', () => {
  const activities = [
    { id: 1, minMinutes: 5, cost: 'free', energy: 'low', location: 'any', area: 'Islandwide', weatherSensitive: true },
    { id: 2, minMinutes: 5, cost: 'free', energy: 'low', location: 'any', area: 'Islandwide', weatherSensitive: false },
  ];
  const result = filterActivities(activities, {}, { isRaining: true });
  assert.deepEqual(result.map((a) => a.id), [2]);
});

test('filterActivities keeps weather-sensitive activities when ignoreWeather is set', () => {
  const activities = [
    { id: 1, minMinutes: 5, cost: 'free', energy: 'low', location: 'any', area: 'Islandwide', weatherSensitive: true },
  ];
  const result = filterActivities(activities, {}, { isRaining: true, ignoreWeather: true });
  assert.deepEqual(result.map((a) => a.id), [1]);
});

test('filterActivities applies no weather filtering when it is not raining', () => {
  const activities = [
    { id: 1, minMinutes: 5, cost: 'free', energy: 'low', location: 'any', area: 'Islandwide', weatherSensitive: true },
  ];
  const result = filterActivities(activities, {}, { isRaining: false });
  assert.deepEqual(result.map((a) => a.id), [1]);
});

test('pickActivity avoids recent ids when alternatives exist', () => {
  const activities = [
    { id: 1, minMinutes: 5, cost: 'free', energy: 'low', location: 'any', area: 'Islandwide' },
    { id: 2, minMinutes: 5, cost: 'free', energy: 'low', location: 'any', area: 'Islandwide' },
  ];
  // rng that always picks index 0 of whatever candidate array it's given
  const rng = () => 0;
  const picked = pickActivity(activities, {}, [1], rng);
  assert.equal(picked.id, 2);
});

test('pickActivity falls back to the full pool once recent ids exhaust it', () => {
  const activities = [{ id: 1, minMinutes: 5, cost: 'free', energy: 'low', location: 'any', area: 'Islandwide' }];
  const picked = pickActivity(activities, {}, [1], () => 0);
  assert.equal(picked.id, 1);
});

test('pickActivity returns null when nothing matches', () => {
  const activities = [{ id: 1, minMinutes: 5, cost: 'free', energy: 'low', location: 'any', area: 'Islandwide' }];
  const picked = pickActivity(activities, { time: '1' }, [], () => 0);
  assert.equal(picked, null);
});

test('pickActivity respects weather context, falling back once it exhausts the dry pool', () => {
  const activities = [
    { id: 1, minMinutes: 5, cost: 'free', energy: 'low', location: 'any', area: 'Islandwide', weatherSensitive: true },
  ];
  const picked = pickActivity(activities, {}, [], () => 0, { isRaining: true });
  // only weather-sensitive activity exists; weather filtering leaves nothing
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
