const test = require('node:test');
const assert = require('node:assert/strict');
const planner = require('../planner.js');
const ACTIVITIES = require('../data.js');

const { COST_RANGE, travelMinutes, eligibleActivities, findRainBackup, planDay, formatMinutes, formatCostRange, formatPlanText } = planner;

// Small seeded PRNG so "random" plans are reproducible.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function act(overrides) {
  return {
    id: 1, text: 'x', minMinutes: 30, cost: 'free', energy: 'low', location: 'any',
    weatherSensitive: false, area: 'Central', tags: ['cat'], ...overrides,
  };
}

test('travelMinutes: same area is short, Central is the hub, cross-island is longest', () => {
  assert.equal(travelMinutes('East', 'East'), 10);
  assert.equal(travelMinutes('East', 'Islandwide'), 20);
  assert.equal(travelMinutes('East', 'Central'), 30);
  assert.equal(travelMinutes('Central', 'West'), 30);
  assert.equal(travelMinutes('East', 'West'), 50);
  assert.equal(travelMinutes('East', 'West'), travelMinutes('West', 'East'));
});

test('eligibleActivities applies time, budget, energy, area, daypart and rain filters', () => {
  const pool = [
    act({ id: 1, minMinutes: 30 }),
    act({ id: 2, minMinutes: 300 }),
    act({ id: 3, cost: '30plus' }),
    act({ id: 4, energy: 'high' }),
    act({ id: 5, area: 'East' }),
    act({ id: 6, area: 'Islandwide' }),
    act({ id: 7, daypart: 'evening' }),
    act({ id: 8, weatherSensitive: true }),
  ];
  const ids = (o) => eligibleActivities(pool, { windowMinutes: 120, budget: 50, ...o }).map((a) => a.id);

  assert.deepEqual(ids({}), [1, 4, 5, 6, 8]);
  assert.deepEqual(ids({ energy: 'high' }), [4]);
  assert.deepEqual(ids({ area: 'East' }), [5, 6]);
  assert.deepEqual(ids({ rainProof: true }), [1, 4, 5, 6]);
  assert.deepEqual(ids({ daypart: 'evening' }), [7]);
  assert.deepEqual(ids({ budget: 70 }), [1, 3, 4, 5, 6, 8]);
});

test('budget uses the top of each price band, so a plan never exceeds it on paper', () => {
  const pool = [act({ id: 1, cost: '10to30' })];
  assert.equal(eligibleActivities(pool, { windowMinutes: 60, budget: 29 }).length, 0);
  assert.equal(eligibleActivities(pool, { windowMinutes: 60, budget: 30 }).length, 1);
});

test('planDay returns null only when nothing is eligible', () => {
  assert.equal(planDay([act({ minMinutes: 500 })], { windowMinutes: 60, budget: 50 }), null);
  assert.equal(planDay([], { windowMinutes: 60, budget: 50 }), null);
});

test('planDay always returns a plan when something is eligible, even with a degenerate rng', () => {
  const plan = planDay([act({ id: 1 })], { windowMinutes: 60, budget: 0 }, () => 0);
  assert.deepEqual(plan.stops.map((s) => s.id), [1]);
});

test('planDay is reproducible for the same seed and differs across seeds', () => {
  const opts = { windowMinutes: 240, budget: 50, energy: 'any', area: 'any', daypart: 'day', rainProof: false };
  const a = planDay(ACTIVITIES, opts, mulberry32(7)).stops.map((s) => s.id);
  const b = planDay(ACTIVITIES, opts, mulberry32(7)).stops.map((s) => s.id);
  assert.deepEqual(a, b);

  const variants = new Set();
  for (let seed = 1; seed <= 30; seed++) variants.add(planDay(ACTIVITIES, opts, mulberry32(seed)).stops.map((s) => s.id).join(','));
  assert.ok(variants.size > 5, `expected variety across seeds, got ${variants.size}`);
});

test('invariants hold across 400 randomised requests against the real dataset', () => {
  const rng = mulberry32(2026);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  let dayRequests = 0;
  let dayProduced = 0;

  for (let i = 0; i < 400; i++) {
    const options = {
      windowMinutes: pick([60, 120, 180, 240, 360, 480]),
      budget: pick([0, 20, 50, 100, 200]),
      energy: pick(['any', 'low', 'med', 'high']),
      area: pick(['any', 'Central', 'East', 'West', 'North', 'North-East', 'South']),
      daypart: pick(['day', 'day', 'evening']),
      rainProof: rng() < 0.4,
    };
    const plan = planDay(ACTIVITIES, options, mulberry32(i + 1));
    const pool = eligibleActivities(ACTIVITIES, options);

    if (options.daypart === 'day' && !options.rainProof) {
      dayRequests++;
      if (plan) dayProduced++;
    }

    if (!plan) {
      assert.equal(pool.length, 0, `null plan but ${pool.length} eligible activities for ${JSON.stringify(options)}`);
      continue;
    }

    const ids = plan.stops.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate stops');
    assert.ok(plan.stops.length >= 1 && plan.stops.length <= 4);
    assert.ok(plan.totalMinutes <= options.windowMinutes, `plan ${plan.totalMinutes}m exceeds window ${options.windowMinutes}m`);
    assert.ok(plan.costMax <= options.budget, `plan max cost ${plan.costMax} exceeds budget ${options.budget}`);
    assert.equal(plan.totalMinutes, plan.activityMinutes + plan.travelMinutes);
    assert.equal(plan.legs.length, plan.stops.length - 1);
    assert.equal(plan.legs.reduce((s, m) => s + m, 0), plan.travelMinutes);
    assert.equal(plan.costMax, plan.stops.reduce((s, a) => s + COST_RANGE[a.cost].max, 0));

    const poolIds = new Set(pool.map((a) => a.id));
    plan.stops.forEach((s) => assert.ok(poolIds.has(s.id), `stop ${s.id} was not eligible`));

    if (options.rainProof) {
      plan.stops.forEach((s) => assert.equal(s.weatherSensitive, false, `rain-proof plan contains outdoor stop ${s.id}`));
      assert.deepEqual(plan.backups, {});
    }

    Object.entries(plan.backups).forEach(([stopId, backup]) => {
      const stop = plan.stops.find((s) => s.id === Number(stopId));
      assert.ok(stop && stop.weatherSensitive, 'backup attached to a stop that is not weather-sensitive');
      if (!backup) return;
      assert.equal(backup.weatherSensitive, false, 'backup is itself weather-sensitive');
      assert.ok(!ids.includes(backup.id), 'backup duplicates an existing stop');
      assert.ok(backup.area === stop.area || backup.area === 'Islandwide' || stop.area === 'Islandwide', 'backup is not nearby');
      const swapped = plan.stops.map((s) => (s.id === stop.id ? backup : s));
      const minutes = swapped.reduce((s, a) => s + a.minMinutes, 0)
        + swapped.slice(1).reduce((s, a, k) => s + travelMinutes(swapped[k].area, a.area), 0);
      assert.ok(minutes <= options.windowMinutes, 'swapping in the backup overruns the window');
      assert.ok(swapped.reduce((s, a) => s + COST_RANGE[a.cost].max, 0) <= options.budget, 'swapping in the backup breaks the budget');
    });

    // Rain makes every outdoor stop wet at once, so swapping in *all* backups
    // together must still be a valid plan: no repeats, inside window and budget.
    const rainDay = plan.stops.map((s) => plan.backups[s.id] || s);
    const rainIds = rainDay.map((s) => s.id);
    assert.equal(new Set(rainIds).size, rainIds.length, 'applying every backup repeats a stop');
    const rainMinutes = rainDay.reduce((s, a) => s + a.minMinutes, 0)
      + rainDay.slice(1).reduce((s, a, k) => s + travelMinutes(rainDay[k].area, a.area), 0);
    assert.ok(rainMinutes <= options.windowMinutes, `all-backups plan is ${rainMinutes}m, over the ${options.windowMinutes}m window`);
    assert.ok(rainDay.reduce((s, a) => s + COST_RANGE[a.cost].max, 0) <= options.budget, 'all-backups plan breaks the budget');
  }

  // Daytime planning must be dependable. Evening mode is knowingly thin (only a
  // handful of entries are evening activities), so it is not held to this bar;
  // the UI says so and tells people how to loosen the request.
  assert.ok(dayProduced / dayRequests >= 0.9, `daytime coverage ${dayProduced}/${dayRequests} fell below 90%`);
});

test('backups are handed out one per stop: three wet stops with only two shelters leaves one without', () => {
  const stops = [1, 2, 3].map((id) => act({ id, area: 'Central', weatherSensitive: true, minMinutes: 30 }));
  const shelters = [10, 11].map((id) => act({ id, area: 'Central', weatherSensitive: false, minMinutes: 30 }));
  const all = [...stops, ...shelters];
  const plan = { stops };
  const options = { windowMinutes: 600, budget: 0 };

  const chosen = new Map();
  const b1 = findRainBackup(stops[0], all, plan, options, chosen);
  assert.ok(b1);
  chosen.set(stops[0].id, b1);
  const b2 = findRainBackup(stops[1], all, plan, options, chosen);
  assert.ok(b2);
  assert.notEqual(b2.id, b1.id, 'second wet stop was offered the same shelter');
  chosen.set(stops[1].id, b2);
  assert.equal(findRainBackup(stops[2], all, plan, options, chosen), null, 'no shelter left, so no backup');
});

test('a backup must fit alongside earlier backups, not just on its own', () => {
  // Window 150: two wet 60-min stops + 10 min travel = 130. An 80-min shelter
  // swapped into either stop alone gives 150 (fits). Swapped into both: 170.
  const wetA = act({ id: 1, area: 'Central', weatherSensitive: true, minMinutes: 60 });
  const wetB = act({ id: 2, area: 'Central', weatherSensitive: true, minMinutes: 60 });
  const shelterA = act({ id: 10, area: 'Central', minMinutes: 80 });
  const shelterB = act({ id: 11, area: 'Central', minMinutes: 80 });
  const all = [wetA, wetB, shelterA, shelterB];
  const plan = { stops: [wetA, wetB] };
  const options = { windowMinutes: 150, budget: 0 };

  // On its own, B's shelter is fine...
  assert.equal(findRainBackup(wetB, [wetA, wetB, shelterB], plan, options).id, 11);
  // ...but not once A has already been swapped to its 80-minute shelter.
  const chosen = new Map([[wetA.id, shelterA]]);
  assert.equal(findRainBackup(wetB, all, plan, options, chosen), null);
});

test('daytime plans never contain evening-only stops; evening plans contain only those', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const day = planDay(ACTIVITIES, { windowMinutes: 360, budget: 100, daypart: 'day' }, mulberry32(seed));
    day.stops.forEach((s) => assert.notEqual(s.daypart, 'evening'));
    const evening = planDay(ACTIVITIES, { windowMinutes: 360, budget: 100, daypart: 'evening' }, mulberry32(seed));
    evening.stops.forEach((s) => assert.equal(s.daypart, 'evening'));
  }
});

test('stops are ordered to keep travel low: East and West stops are not split by an unnecessary hop', () => {
  const pool = [
    act({ id: 1, area: 'East', minMinutes: 30 }),
    act({ id: 2, area: 'West', minMinutes: 30 }),
    act({ id: 3, area: 'East', minMinutes: 30 }),
  ];
  const plan = planDay(pool, { windowMinutes: 600, budget: 0 }, mulberry32(3));
  const areas = plan.stops.map((s) => s.area).join(',');
  assert.ok(!/East,West,East|West,East,West/.test(areas), `inefficient order: ${areas}`);
});

test('findRainBackup picks a nearby sheltered swap and rejects ones that break the window', () => {
  const outdoor = act({ id: 1, area: 'Central', weatherSensitive: true, minMinutes: 60 });
  const plan = { stops: [outdoor] };
  const options = { windowMinutes: 90, budget: 20 };

  const tooLong = act({ id: 2, area: 'Central', minMinutes: 120 });
  const wrongArea = act({ id: 3, area: 'East', minMinutes: 60 });
  const stillWet = act({ id: 4, area: 'Central', minMinutes: 60, weatherSensitive: true });
  const good = act({ id: 5, area: 'Central', minMinutes: 70 });
  const anywhere = act({ id: 6, area: 'Islandwide', minMinutes: 60 });

  assert.equal(findRainBackup(outdoor, [outdoor, tooLong, wrongArea, stillWet], plan, options), null);
  assert.equal(findRainBackup(outdoor, [outdoor, tooLong, wrongArea, stillWet, good], plan, options).id, 5);
  assert.equal(findRainBackup(outdoor, [outdoor, good, anywhere], plan, options).id, 5, 'same area should beat Islandwide');
  assert.equal(findRainBackup(outdoor, [outdoor, anywhere], plan, options).id, 6);
});

test('activities flagged skipInPlans (done at home, or "find one near you") never appear in plans', () => {
  const skipped = ACTIVITIES.filter((a) => a.skipInPlans).map((a) => a.id);
  assert.ok(skipped.length >= 2, 'expected some entries to be flagged');
  const pool = eligibleActivities(ACTIVITIES, { windowMinutes: 480, budget: 200 }).map((a) => a.id);
  skipped.forEach((id) => assert.ok(!pool.includes(id), `entry ${id} should not be plannable`));
  for (let seed = 1; seed <= 60; seed++) {
    const plan = planDay(ACTIVITIES, { windowMinutes: 480, budget: 200 }, mulberry32(seed));
    plan.stops.forEach((s) => assert.ok(!skipped.includes(s.id)));
  }
});

test('asking for an area favours named places in that area over generic "near you" entries', () => {
  const east = [1, 2, 3].map((id) => act({ id, area: 'East', minMinutes: 100, tags: ['same'] }));
  const generic = [4, 5, 6].map((id) => act({ id, area: 'Islandwide', minMinutes: 100, tags: ['same'] }));
  for (let seed = 1; seed <= 25; seed++) {
    const plan = planDay([...east, ...generic], { windowMinutes: 220, budget: 0, area: 'East' }, mulberry32(seed));
    assert.equal(plan.stops.length, 2);
    plan.stops.forEach((s) => assert.equal(s.area, 'East', `seed ${seed} picked generic stop ${s.id}`));
  }
});

test('rain-proof plans only use entries the dataset marks as sheltered (and the labels are not left at the default)', () => {
  const sheltered = ACTIVITIES.filter((a) => !a.weatherSensitive && !a.skipInPlans);
  assert.ok(sheltered.length >= 20 && sheltered.length < ACTIVITIES.length - 20, 'dataset should have a real mix');
  // Open-air street walks and the zoo must never be offered as "rain-proof".
  const exposed = [24, 25, 32, 36, 57, 59, 62];
  exposed.forEach((id) => assert.equal(ACTIVITIES.find((a) => a.id === id).weatherSensitive, true, `entry ${id} should be weather-sensitive`));
  for (let seed = 1; seed <= 60; seed++) {
    const plan = planDay(ACTIVITIES, { windowMinutes: 360, budget: 100, rainProof: true }, mulberry32(seed));
    plan.stops.forEach((s) => assert.ok(!exposed.includes(s.id), `rain-proof plan used exposed entry ${s.id}`));
  }
});

test('formatMinutes and formatCostRange', () => {
  assert.equal(formatMinutes(45), '45m');
  assert.equal(formatMinutes(120), '2h');
  assert.equal(formatMinutes(200), '3h 20m');
  assert.equal(formatCostRange(0, 0), 'Free');
  assert.equal(formatCostRange(13, 40), '$13–$40');
});

test('formatPlanText includes every stop, rain backups, totals and the honesty footer', () => {
  const plan = planDay(ACTIVITIES, { windowMinutes: 240, budget: 50 }, mulberry32(11));
  const text = formatPlanText(plan);
  plan.stops.forEach((s) => assert.ok(text.includes(s.text), `missing stop: ${s.text}`));
  assert.ok(text.includes('Bored SG plan'));
  assert.ok(text.includes('per person'));
  assert.ok(text.includes('opening hours are not checked'));
  Object.values(plan.backups).forEach((b) => {
    if (b) assert.ok(text.includes(b.text), 'backup missing from text');
  });
});

test('formatPlanText describes a free-only budget plainly', () => {
  const text = formatPlanText(planDay(ACTIVITIES, { windowMinutes: 120, budget: 0 }, mulberry32(5)));
  assert.ok(text.includes('free activities only'));
  assert.ok(text.includes('Free.'));
  assert.ok(!text.includes('Free per person'), 'should not read "roughly Free per person"');
});

test('eligibleActivities applies "who" and excludeIds', () => {
  const pool = [
    act({ id: 1, suits: ['kids'] }),
    act({ id: 2, suits: ['date'] }),
    act({ id: 3 }),
  ];
  const ids = (o) => eligibleActivities(pool, { windowMinutes: 120, budget: 50, ...o }).map((a) => a.id);
  assert.deepEqual(ids({ who: 'kids' }), [1]);
  assert.deepEqual(ids({ who: 'any' }), [1, 2, 3]);
  assert.deepEqual(ids({ excludeIds: [2] }), [1, 3]);
});

test('every plan and rain backup for a chosen group suits that group', () => {
  for (const who of ['kids', 'easy', 'date', 'group']) {
    let built = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const plan = planDay(ACTIVITIES, { windowMinutes: 240, budget: 100, daypart: 'day', who }, mulberry32(seed));
      if (!plan) continue;
      built++;
      plan.stops.forEach((s) => assert.ok(s.suits.includes(who), `${who}: stop ${s.id}`));
      Object.values(plan.backups).forEach((b) => b && assert.ok(b.suits.includes(who), `${who}: backup ${b.id}`));
    }
    assert.ok(built >= 38, `${who}: only ${built}/40 plans built`);
  }
});

test('planDays: no activity repeats across days, counting rain backups', () => {
  const opts = { windowMinutes: 240, budget: 50, daypart: 'day' };
  for (let seed = 1; seed <= 30; seed++) {
    const plans = planner.planDays(ACTIVITIES, opts, 3, mulberry32(seed));
    assert.equal(plans.length, 3, `seed ${seed}`);
    const ids = plans.flatMap((p) => [...p.stops.map((s) => s.id), ...Object.values(p.backups).filter(Boolean).map((b) => b.id)]);
    assert.equal(new Set(ids).size, ids.length, `repeat with seed ${seed}`);
    plans.forEach((p) => {
      assert.ok(p.totalMinutes <= 240);
      assert.ok(p.costMax <= 50);
    });
  }
});

test('planDays returns fewer days, not repeats, when the pool runs out', () => {
  const tiny = [act({ id: 1 }), act({ id: 2 })];
  const plans = planner.planDays(tiny, { windowMinutes: 60, budget: 10 }, 3, mulberry32(1));
  const ids = plans.flatMap((p) => p.stops.map((s) => s.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(plans.length >= 1 && plans.length < 3);
});

test('planDays with a single day matches planDay for the same seed', () => {
  const opts = { windowMinutes: 240, budget: 50, daypart: 'day' };
  const one = planner.planDays(ACTIVITIES, opts, 1, mulberry32(5))[0].stops.map((s) => s.id);
  const direct = planDay(ACTIVITIES, { ...opts, excludeIds: [] }, mulberry32(5)).stops.map((s) => s.id);
  assert.deepEqual(one, direct);
});

test('formatMultiDayText labels each day, uses dates when given, and carries the caveat once', () => {
  const plans = planner.planDays(ACTIVITIES, { windowMinutes: 180, budget: 50, daypart: 'day' }, 2, mulberry32(3));
  const text = planner.formatMultiDayText(plans, ['Sat 7 Nov', 'Sun 8 Nov']);
  assert.ok(text.startsWith('Bored SG: 2-day plan'));
  assert.ok(text.includes('Day 1 (Sat 7 Nov)') && text.includes('Day 2 (Sun 8 Nov)'));
  assert.equal(text.split('opening hours are not checked').length - 1, 1);
  assert.ok(planner.formatMultiDayText(plans).includes('Day 1:'));
});

test('encodePlans/decodePlans round-trips stops, backups, totals and dates', () => {
  const dates = ['2026-11-07', '2026-11-08', '2026-11-09'];
  for (let seed = 1; seed <= 30; seed++) {
    const plans = planner.planDays(ACTIVITIES, { windowMinutes: 240, budget: 50, daypart: 'day', who: seed % 2 ? 'any' : 'group' }, 3, mulberry32(seed));
    const code = planner.encodePlans(plans, dates);
    assert.match(code, /^[A-Za-z0-9_-]+$/, 'must be URL-safe');
    const back = planner.decodePlans(code, ACTIVITIES);
    assert.deepEqual(back.dates, dates);
    assert.equal(back.plans.length, plans.length);
    plans.forEach((plan, i) => {
      const got = back.plans[i];
      assert.deepEqual(got.stops.map((s) => s.id), plan.stops.map((s) => s.id));
      assert.deepEqual(
        Object.fromEntries(Object.entries(got.backups).map(([k, b]) => [k, b && b.id])),
        Object.fromEntries(Object.entries(plan.backups).map(([k, b]) => [k, b && b.id]))
      );
      for (const key of ['legs', 'totalMinutes', 'travelMinutes', 'costMin', 'costMax', 'windowMinutes', 'budget', 'rainProof']) {
        assert.deepEqual(got[key], plan[key], `${key} seed ${seed}`);
      }
    });
  }
});

test('encodePlans omits dates when there are none and rain-proof survives the trip', () => {
  const plans = planner.planDays(ACTIVITIES, { windowMinutes: 180, budget: 20, daypart: 'day', rainProof: true }, 1, mulberry32(2));
  const back = planner.decodePlans(planner.encodePlans(plans), ACTIVITIES);
  assert.equal(back.dates, null);
  assert.equal(back.plans[0].rainProof, true);
  assert.deepEqual(back.plans[0].backups, {});
});

test('decodePlans rejects garbage, wrong versions, unknown ids and out-of-range values', () => {
  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const good = { v: 1, w: 240, b: 50, r: 0, p: [{ s: [1, 2], k: {} }] };
  assert.ok(planner.decodePlans(enc(good), ACTIVITIES), 'baseline must decode');

  const bad = {
    'empty string': '',
    'not base64 json': 'abc',
    'json but not a plan': enc([1, 2, 3]),
    'wrong version': enc({ ...good, v: 2 }),
    'unknown stop id': enc({ ...good, p: [{ s: [99999], k: {} }] }),
    'string id': enc({ ...good, p: [{ s: ['1'], k: {} }] }),
    'too many stops': enc({ ...good, p: [{ s: [1, 2, 3, 4, 5], k: {} }] }),
    'no stops': enc({ ...good, p: [{ s: [], k: {} }] }),
    'too many days': enc({ ...good, p: [good.p[0], good.p[0], good.p[0], good.p[0]] }),
    'unknown backup id': enc({ ...good, p: [{ s: [1], k: { 1: 99999 } }] }),
    'backup for a stop not in plan': enc({ ...good, p: [{ s: [1], k: { 2: 3 } }] }),
    'negative budget': enc({ ...good, b: -1 }),
    'zero window': enc({ ...good, w: 0 }),
    'bad date': enc({ ...good, d: ['not-a-date'] }),
    'dates length mismatch': enc({ ...good, d: ['2026-11-07', '2026-11-08'] }),
    'too long': 'A'.repeat(5000),
  };
  for (const [name, code] of Object.entries(bad)) assert.equal(planner.decodePlans(code, ACTIVITIES), null, name);
  assert.equal(planner.decodePlans(null, ACTIVITIES), null);
  assert.equal(planner.decodePlans(undefined, ACTIVITIES), null);
});

test('a decoded plan can never smuggle markup: every field comes from the dataset', () => {
  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const back = planner.decodePlans(enc({ v: 1, w: 240, b: 50, r: 0, p: [{ s: [1], k: {}, text: '<script>x</script>' }], text: '<img onerror=x>' }), ACTIVITIES);
  assert.ok(back);
  assert.equal(JSON.stringify(back).includes('<script>'), false);
  assert.equal(JSON.stringify(back).includes('onerror'), false);
});
