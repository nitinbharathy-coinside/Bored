// Day planner: turns the activity dataset into a time- and budget-bounded,
// weather-aware multi-stop plan, with a rain backup for each outdoor stop.
//
// Pure and DOM-free so it can be unit tested. All randomness comes through an
// injectable `rng`, which makes plans reproducible in tests.
//
// Assumptions (also stated in the UI):
//  - The dataset stores price *bands*, not prices. Budget checks use the top of
//    each band (and an assumed $60 cap for "$30+"), so on paper a plan never
//    exceeds the stated budget. The lower ends of the bands are rough guesses.
//  - Travel time is a coarse, conservative estimate from the pair of areas. It
//    is not live transit data.
//  - Opening hours are not modelled, apart from the few entries flagged
//    `daypart: 'evening'`.
(function () {
  const COST_RANGE = {
    free: { min: 0, max: 0 },
    under10: { min: 3, max: 10 },
    '10to30': { min: 10, max: 30 },
    '30plus': { min: 30, max: 60 },
  };
  const COST_LABELS = { free: 'Free', under10: 'Under $10', '10to30': '$10–$30', '30plus': '$30+' };

  const MAX_STOPS = 4;
  const ATTEMPTS = 600;

  function travelMinutes(areaA, areaB) {
    if (areaA === areaB) return 10;
    if (areaA === 'Islandwide' || areaB === 'Islandwide') return 20;
    if (areaA === 'Central' || areaB === 'Central') return 30;
    return 50;
  }

  // `options`: { windowMinutes, budget, energy, area, daypart, rainProof, who, excludeIds }
  function eligibleActivities(activities, options) {
    const { windowMinutes, budget, energy = 'any', area = 'any', daypart = 'day', rainProof = false, who = 'any', excludeIds = [] } = options;
    return activities.filter((a) => {
      if (a.skipInPlans) return false;
      if (excludeIds.includes(a.id)) return false;
      if (who !== 'any' && !(a.suits && a.suits.includes(who))) return false;
      if (a.minMinutes > windowMinutes) return false;
      if (COST_RANGE[a.cost].max > budget) return false;
      if (energy !== 'any' && a.energy !== energy) return false;
      if (area !== 'any' && a.area !== 'Islandwide' && a.area !== area) return false;
      if (daypart === 'evening' ? a.daypart !== 'evening' : a.daypart === 'evening') return false;
      if (rainProof && a.weatherSensitive) return false;
      return true;
    });
  }

  function sampleDistinct(pool, count, rng) {
    const copy = pool.slice();
    const out = [];
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(rng() * (copy.length - i));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
      out.push(copy[i]);
    }
    return out;
  }

  function permutations(items) {
    if (items.length <= 1) return [items];
    const out = [];
    items.forEach((item, i) => {
      const rest = items.slice(0, i).concat(items.slice(i + 1));
      permutations(rest).forEach((p) => out.push([item].concat(p)));
    });
    return out;
  }

  function travelOf(ordered) {
    let total = 0;
    for (let i = 1; i < ordered.length; i++) total += travelMinutes(ordered[i - 1].area, ordered[i].area);
    return total;
  }

  function bestOrder(stops) {
    let best = stops;
    let bestTravel = travelOf(stops);
    permutations(stops).forEach((p) => {
      const t = travelOf(p);
      if (t < bestTravel) {
        best = p;
        bestTravel = t;
      }
    });
    return best;
  }

  function measure(ordered) {
    const activityMinutes = ordered.reduce((sum, a) => sum + a.minMinutes, 0);
    const legs = ordered.slice(1).map((s, i) => travelMinutes(ordered[i].area, s.area));
    const travel = legs.reduce((sum, m) => sum + m, 0);
    return {
      activityMinutes,
      travelMinutes: travel,
      totalMinutes: activityMinutes + travel,
      legs,
      costMin: ordered.reduce((sum, a) => sum + COST_RANGE[a.cost].min, 0),
      costMax: ordered.reduce((sum, a) => sum + COST_RANGE[a.cost].max, 0),
    };
  }

  function scorePlan(ordered, totals, options, avoidIds, rng) {
    const { windowMinutes, area = 'any' } = options;
    const categories = ordered.map((a) => a.tags[0]);
    const distinct = new Set(categories).size;
    const duplicates = categories.length - distinct;
    const overlap = ordered.filter((a) => avoidIds.includes(a.id)).length;
    const hasFood = ordered.some((a) => a.tags.includes('food'));
    // Generic "somewhere near you" entries are fine as filler but a plan
    // anchored in real named places is worth more, especially when the user
    // asked for a specific part of the island.
    const generic = ordered.filter((a) => a.area === 'Islandwide').length;
    const inRequestedArea = area === 'any' ? 0 : ordered.filter((a) => a.area === area).length;

    let score = (totals.totalMinutes / windowMinutes) * 10;
    score += distinct * 1.5;
    score -= duplicates * 2;
    score -= totals.travelMinutes / 30;
    score -= overlap * 2;
    score -= generic * 1;
    score += inRequestedArea * 1.5;
    if (windowMinutes >= 180 && hasFood) score += 3;
    return score + rng();
  }

  // Best swap-in for a weather-sensitive stop: a sheltered activity that is
  // near the original, not already in the plan, and keeps the whole plan
  // within the time window and budget.
  //
  // `chosen` maps stop id -> backup already picked for the plan's other stops.
  // A backup must fit both on its own (someone swaps just this one stop) and
  // together with those earlier picks (someone swaps every outdoor stop), and
  // must not repeat an earlier pick.
  function findRainBackup(stop, activities, plan, options, chosen = new Map()) {
    const taken = new Set(plan.stops.map((s) => s.id));
    chosen.forEach((b) => taken.add(b.id));
    const swapIn = (replacements) => plan.stops.map((s) => replacements.get(s.id) || s);
    const fits = (stops) => {
      const m = measure(stops);
      return m.totalMinutes <= options.windowMinutes && m.costMax <= options.budget;
    };

    const candidates = eligibleActivities(activities, { ...options, rainProof: true, energy: 'any' })
      .filter((c) => !taken.has(c.id))
      .filter((c) => c.area === stop.area || c.area === 'Islandwide' || stop.area === 'Islandwide')
      .filter((c) => fits(swapIn(new Map([[stop.id, c]]))) && fits(swapIn(new Map([...chosen, [stop.id, c]]))));

    const rank = (c) => [
      c.area === stop.area ? 0 : 1,
      c.energy === stop.energy ? 0 : 1,
      Math.abs(c.minMinutes - stop.minMinutes),
      COST_RANGE[c.cost].max,
      c.id,
    ];
    candidates.sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
      return 0;
    });
    return candidates[0] || null;
  }

  function buildPlan(ordered, totals, activities, options) {
    const plan = {
      stops: ordered,
      legs: totals.legs,
      activityMinutes: totals.activityMinutes,
      travelMinutes: totals.travelMinutes,
      totalMinutes: totals.totalMinutes,
      costMin: totals.costMin,
      costMax: totals.costMax,
      windowMinutes: options.windowMinutes,
      budget: options.budget,
      rainProof: !!options.rainProof,
      backups: {},
    };
    if (!plan.rainProof) {
      const chosen = new Map();
      plan.stops.forEach((stop) => {
        if (!stop.weatherSensitive) return;
        const backup = findRainBackup(stop, activities, plan, options, chosen);
        plan.backups[stop.id] = backup;
        if (backup) chosen.set(stop.id, backup);
      });
    }
    return plan;
  }

  // Returns a plan, or null only when no single activity is eligible.
  // `options.avoidIds` softly discourages re-using stops (used by "Shuffle").
  function planDay(activities, options, rng = Math.random) {
    const { windowMinutes, budget } = options;
    const avoidIds = options.avoidIds || [];
    const pool = eligibleActivities(activities, options);
    if (pool.length === 0) return null;

    const maxStops = Math.min(MAX_STOPS, pool.length);
    let best = null;
    for (let i = 0; i < ATTEMPTS; i++) {
      const count = 1 + Math.floor(rng() * maxStops);
      const ordered = bestOrder(sampleDistinct(pool, count, rng));
      const totals = measure(ordered);
      if (totals.totalMinutes > windowMinutes || totals.costMax > budget) continue;
      const score = scorePlan(ordered, totals, options, avoidIds, rng);
      if (!best || score > best.score) best = { ordered, totals, score };
    }

    if (!best) {
      // Every single eligible activity fits on its own, so this always works.
      const only = [pool[0]];
      best = { ordered: only, totals: measure(only) };
    }
    return buildPlan(best.ordered, best.totals, activities, options);
  }

  // Builds up to `days` plans for a multi-day trip. No activity appears twice
  // across the days, counting rain backups, so a rained-out day never sends
  // someone to a place they are visiting on another day. If the eligible pool
  // runs out first, fewer days are returned; the caller should say so.
  function planDays(activities, options, days, rng = Math.random) {
    const plans = [];
    const used = new Set();
    for (let d = 0; d < days; d++) {
      const plan = planDay(activities, { ...options, excludeIds: [...used] }, rng);
      if (!plan) break;
      plans.push(plan);
      plan.stops.forEach((s) => used.add(s.id));
      Object.values(plan.backups).forEach((b) => b && used.add(b.id));
    }
    return plans;
  }

  // ---- Shareable links ----
  // A plan is shared as the ids of its stops and rain backups, not as text, so
  // the link stays short and the receiving app rebuilds the plan from its own
  // dataset. A link that mentions an id this version doesn't know is rejected
  // rather than silently changed.
  const SHARE_VERSION = 1;
  const MAX_SHARED_DAYS = 3;

  function toBase64Url(text) {
    return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(code) {
    const padded = code.replace(/-/g, '+').replace(/_/g, '/');
    return atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  }

  // `dates` is optional: the 'YYYY-MM-DD' labels of a long-weekend plan.
  function encodePlans(plans, dates) {
    const first = plans[0];
    const data = {
      v: SHARE_VERSION,
      w: first.windowMinutes,
      b: first.budget,
      r: first.rainProof ? 1 : 0,
      p: plans.map((plan) => ({
        s: plan.stops.map((stop) => stop.id),
        k: Object.fromEntries(Object.entries(plan.backups).map(([id, backup]) => [id, backup ? backup.id : 0])),
      })),
    };
    if (dates) data.d = dates;
    return toBase64Url(JSON.stringify(data));
  }

  const isId = (n) => Number.isInteger(n) && n > 0;

  // Returns { plans, dates } or null for anything malformed, out of range, or
  // naming an activity this version doesn't have.
  function decodePlans(code, activities) {
    try {
      if (typeof code !== 'string' || code.length === 0 || code.length > 4000) return null;
      const data = JSON.parse(fromBase64Url(code));
      if (!data || data.v !== SHARE_VERSION) return null;
      if (!Number.isInteger(data.w) || data.w < 30 || data.w > 1440) return null;
      if (!Number.isInteger(data.b) || data.b < 0 || data.b > 1000) return null;
      if (!Array.isArray(data.p) || data.p.length === 0 || data.p.length > MAX_SHARED_DAYS) return null;
      let dates = null;
      if (data.d !== undefined) {
        if (!Array.isArray(data.d) || data.d.length !== data.p.length) return null;
        if (!data.d.every((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))) return null;
        dates = data.d;
      }
      const byId = new Map(activities.map((a) => [a.id, a]));
      const plans = [];
      for (const day of data.p) {
        if (!day || !Array.isArray(day.s) || day.s.length === 0 || day.s.length > MAX_STOPS) return null;
        if (!day.s.every((id) => isId(id) && byId.has(id))) return null;
        const stops = day.s.map((id) => byId.get(id));
        const backups = {};
        const k = day.k && typeof day.k === 'object' && !Array.isArray(day.k) ? day.k : {};
        for (const [stopId, backupId] of Object.entries(k)) {
          if (!stops.some((s) => String(s.id) === stopId)) return null;
          if (backupId === 0) backups[stopId] = null;
          else if (isId(backupId) && byId.has(backupId)) backups[stopId] = byId.get(backupId);
          else return null;
        }
        const totals = measure(stops);
        plans.push({
          stops,
          legs: totals.legs,
          activityMinutes: totals.activityMinutes,
          travelMinutes: totals.travelMinutes,
          totalMinutes: totals.totalMinutes,
          costMin: totals.costMin,
          costMax: totals.costMax,
          windowMinutes: data.w,
          budget: data.b,
          rainProof: data.r === 1,
          backups,
        });
      }
      return { plans, dates };
    } catch {
      return null;
    }
  }

  function formatMinutes(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  function formatCostRange(min, max) {
    if (max === 0) return 'Free';
    return `$${min}–$${max}`;
  }

  function describe(a) {
    return `${a.text} (${a.area}, ~${a.minMinutes} min, ${COST_LABELS[a.cost]})`;
  }

  // `opts.title` replaces the first line (used for "Day 2" headings) and
  // `opts.footer === false` leaves out the caveat line so a multi-day text can
  // carry it once at the end.
  function formatPlanText(plan, opts = {}) {
    const budgetText = plan.budget === 0 ? 'free activities only' : `up to $${plan.budget} per person`;
    const summary = `${formatMinutes(plan.windowMinutes)} available, ${budgetText}`;
    const lines = [opts.title ? `${opts.title}: ${summary}` : `Bored SG plan: ${summary}`];
    plan.stops.forEach((stop, i) => {
      if (i > 0) lines.push(`   ~${plan.legs[i - 1]} min travel`);
      lines.push(`${i + 1}. ${describe(stop)}`);
      if (stop.id in plan.backups) {
        const backup = plan.backups[stop.id];
        lines.push(
          backup
            ? `   If it rains: ${describe(backup)}`
            : '   If it rains: no sheltered swap found nearby, consider skipping this one'
        );
      }
    });
    const costText = plan.costMax === 0 ? 'Free.' : `Roughly ${formatCostRange(plan.costMin, plan.costMax)} per person.`;
    lines.push(`About ${formatMinutes(plan.totalMinutes)} including ~${plan.travelMinutes} min travel. ${costText}`);
    if (opts.footer !== false) lines.push(PLAN_CAVEAT);
    return lines.join('\n');
  }

  const PLAN_CAVEAT = 'Travel times are rough and opening hours are not checked. Confirm before you go.';

  // `labels[i]` names day i (for example "Sat 7 Nov"); falls back to "Day N".
  function formatMultiDayText(plans, labels = []) {
    const blocks = plans.map((plan, i) => {
      const name = labels[i] ? `Day ${i + 1} (${labels[i]})` : `Day ${i + 1}`;
      return formatPlanText(plan, { title: name, footer: false });
    });
    return [`Bored SG: ${plans.length}-day plan`, ...blocks, PLAN_CAVEAT].join('\n\n');
  }

  const plannerApi = {
    COST_RANGE,
    COST_LABELS,
    travelMinutes,
    eligibleActivities,
    findRainBackup,
    planDay,
    planDays,
    formatMinutes,
    formatCostRange,
    formatPlanText,
    formatMultiDayText,
    encodePlans,
    decodePlans,
  };

  if (typeof module !== 'undefined') module.exports = plannerApi;
  if (typeof window !== 'undefined') window.BoredPlanner = plannerApi;
})();
