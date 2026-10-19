(function () {
  const { pickActivity, computeStreak, nearestArea } = window.BoredFilter;
  const { isPublicHoliday, nextLongWeekend } = window.BoredHolidays;
  const { fetchSingaporeWeather } = window.BoredWeather;
  const { planDays, formatPlanText, formatMultiDayText, formatMinutes, formatCostRange, encodePlans, decodePlans, COST_LABELS } = window.BoredPlanner;

  const STORAGE_KEYS = { saved: 'bored.saved', done: 'bored.done', plans: 'bored.plans', theme: 'bored.theme' };
  const RECENT_LIMIT = 8; // avoid repeating the last N picks in this session

  const el = (id) => document.getElementById(id);
  const filterTime = el('filter-time');
  const filterCost = el('filter-cost');
  const filterEnergy = el('filter-energy');
  const filterLocation = el('filter-location');
  const filterArea = el('filter-area');
  const filterWho = el('filter-who');
  const card = el('card');
  const btnSurprise = el('btn-surprise');
  const btnSkip = el('btn-skip');
  const btnSave = el('btn-save');
  const btnDone = el('btn-done');
  const themeToggle = el('theme-toggle');
  const weatherBanner = el('weather-banner');
  const holidayBanner = el('holiday-banner');
  const btnShowAnyway = el('btn-show-anyway');

  let current = null;
  let recentIds = [];
  // `known` is true only once a fetch has actually resolved with real data.
  // `checked` is true once a fetch attempt has settled at all (success or
  // failure) — this is what lets the status line distinguish "still
  // loading" from "the API call failed" from "loaded, and it's dry".
  let weatherState = { isRaining: false, ignoreWeather: false, known: false, checked: false, rainingFraction: 0 };

  function loadList(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  }

  // Returns whether the write actually stuck, so callers can avoid claiming
  // "saved" when storage is unavailable (private mode, quota).
  function saveList(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  }

  function currentFilters() {
    return {
      time: filterTime.value,
      cost: filterCost.value,
      energy: filterEnergy.value,
      location: filterLocation.value,
      area: filterArea.value,
      who: filterWho.value,
    };
  }

  function currentWeatherContext() {
    return { isRaining: weatherState.isRaining, ignoreWeather: weatherState.ignoreWeather };
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function renderCard(activity) {
    if (!activity) {
      card.className = 'card empty';
      card.innerHTML = '<p>Nothing matches those filters right now. Try loosening one, or tap "show outdoor anyway" if it\'s the rain filter.</p>';
      btnSkip.disabled = true;
      btnSave.disabled = true;
      btnDone.disabled = true;
      return;
    }
    card.className = 'card';
    card.innerHTML = `<div><span class="category">${escapeHtml(activity.tags[0])}</span><p>${escapeHtml(activity.text)}</p><span class="meta">${activity.area} · ${activity.minMinutes} min · ${COST_LABELS[activity.cost]}</span></div>`;
    btnSkip.disabled = false;
    btnSave.disabled = false;
    btnDone.disabled = false;
  }

  function draw() {
    current = pickActivity(ACTIVITIES, currentFilters(), recentIds, Math.random, currentWeatherContext());
    if (current) {
      recentIds.push(current.id);
      if (recentIds.length > RECENT_LIMIT) recentIds.shift();
    }
    renderCard(current);
  }

  function renderSaved() {
    const saved = loadList(STORAGE_KEYS.saved);
    const list = el('saved-list');
    const empty = el('saved-empty');
    list.innerHTML = '';
    empty.hidden = saved.length > 0;
    saved.forEach((item) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${escapeHtml(item.text)}</span>`;
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.onclick = () => {
        saveList(STORAGE_KEYS.saved, loadList(STORAGE_KEYS.saved).filter((i) => i.id !== item.id));
        renderSaved();
      };
      li.appendChild(removeBtn);
      list.appendChild(li);
    });
  }

  function renderDone() {
    const done = loadList(STORAGE_KEYS.done);
    const list = el('done-list');
    const empty = el('done-empty');
    el('done-count').textContent = done.length;
    list.innerHTML = '';
    empty.hidden = done.length > 0;
    done
      .slice()
      .reverse()
      .forEach((item) => {
        const li = document.createElement('li');
        const when = new Date(item.doneAt).toLocaleDateString();
        li.innerHTML = `<span>${escapeHtml(item.text)}</span><span class="muted-note">${when}</span>`;
        list.appendChild(li);
      });
  }

  function renderStats() {
    const done = loadList(STORAGE_KEYS.done);
    const streak = computeStreak(done.map((d) => d.doneAt));
    el('stat-total').textContent = done.length;
    el('stat-streak').textContent = streak;

    const counts = {};
    done.forEach((item) => {
      const activity = ACTIVITIES.find((a) => a.id === item.id);
      const category = activity ? activity.tags[0] : 'other';
      counts[category] = (counts[category] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    el('stat-top').textContent = top ? `${top[0]} (${top[1]})` : '—';
  }

  function renderWeatherBanner() {
    if (!weatherState.known) {
      weatherBanner.hidden = true;
      return;
    }
    if (weatherState.isRaining && !weatherState.ignoreWeather) {
      weatherBanner.hidden = false;
      weatherBanner.innerHTML = '🌧️ Raining across parts of Singapore right now — showing indoor/sheltered picks. <button id="btn-show-anyway-inner" class="link-btn">Show outdoor anyway</button>';
      el('btn-show-anyway-inner').addEventListener('click', () => {
        weatherState.ignoreWeather = true;
        renderWeatherBanner();
        draw();
      });
    } else if (weatherState.isRaining && weatherState.ignoreWeather) {
      weatherBanner.hidden = false;
      weatherBanner.innerHTML = '🌧️ Still raining in parts of Singapore — outdoor picks are back on. <button id="btn-hide-outdoor-inner" class="link-btn">Hide outdoor again</button>';
      el('btn-hide-outdoor-inner').addEventListener('click', () => {
        weatherState.ignoreWeather = false;
        renderWeatherBanner();
        draw();
      });
    } else {
      weatherBanner.hidden = true;
    }
  }

  // Always visible, regardless of whether it's raining — this is the one
  // place you can check "did the live weather integration actually work?"
  // without needing to catch it mid-rainstorm.
  function renderWeatherStatus() {
    const statusEl = el('weather-status');
    if (!weatherState.known) {
      statusEl.textContent = weatherState.checked
        ? '⚠️ Weather: unavailable right now (NEA API unreachable or blocked) — outdoor picks are not being filtered for rain.'
        : 'Checking Singapore weather…';
      statusEl.className = weatherState.checked ? 'weather-status weather-status-bad' : 'weather-status';
      return;
    }
    const pct = Math.round(weatherState.rainingFraction * 100);
    statusEl.textContent = weatherState.isRaining
      ? `🌧️ Weather: rain reported in ~${pct}% of NEA's forecast areas — outdoor picks are being filtered.`
      : `☀️ Weather: dry across Singapore right now, via NEA — no filtering applied.`;
    statusEl.className = 'weather-status weather-status-good';
  }

  function renderHolidayBanner() {
    const today = new Date();
    if (isPublicHoliday(today)) {
      holidayBanner.hidden = false;
      holidayBanner.textContent = "🎉 It's a public holiday in Singapore today — good day to go big.";
      return;
    }
    // Look past a Sunday holiday to its in-lieu Monday, which is what makes the long weekend.
    const next = nextLongWeekend(today, 3);
    if (!next) {
      holidayBanner.hidden = true;
      return;
    }
    const daysAway = Math.round((new Date(next.date) - new Date(today.toDateString())) / (24 * 60 * 60 * 1000));
    if (daysAway >= 1) {
      holidayBanner.hidden = false;
      holidayBanner.textContent = `📅 Long weekend ahead: ${next.name} in ${daysAway} day${daysAway > 1 ? 's' : ''}.`;
    } else {
      holidayBanner.hidden = true;
    }
  }

  // ---- Day planner (Pro preview) ----
  let lastPlans = [];
  let lastPlanText = '';
  let planBuiltOnce = false;
  // Dates of the long weekend the user chose to plan, or null for plain "Day N" labels.
  let weekendDates = null;
  // The 'YYYY-MM-DD' dates behind the plan on screen, if it has any (used when sharing).
  let lastDates = null;

  function planOptionsFromForm(avoidIds) {
    const liveRain = weatherState.known && weatherState.isRaining && !weatherState.ignoreWeather;
    return {
      windowMinutes: Number(el('plan-time').value),
      budget: Number(el('plan-budget').value),
      energy: el('plan-energy').value,
      area: el('plan-area').value,
      daypart: el('plan-when').value,
      who: el('plan-who').value,
      rainProof: el('plan-rainproof').checked || liveRain,
      avoidIds: avoidIds || [],
    };
  }

  function planSummary(plan) {
    const cost = plan.costMax === 0 ? 'Free' : `${formatCostRange(plan.costMin, plan.costMax)} per person`;
    return `${plan.stops.length} stop${plan.stops.length > 1 ? 's' : ''} · about ${formatMinutes(plan.totalMinutes)} · ${cost}`;
  }

  function dayLabel(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  }

  function planBodyHtml(plan) {
    const stopsHtml = plan.stops
      .map((stop, i) => {
        const leg = i > 0 ? `<span class="leg">about ${plan.legs[i - 1]} min travel from the previous stop</span>` : '';
        let backupHtml = '';
        if (stop.id in plan.backups) {
          const b = plan.backups[stop.id];
          backupHtml = b
            ? `<span class="backup"><strong>If it rains:</strong> ${escapeHtml(b.text)} <span class="meta">${b.area} · ${b.minMinutes} min · ${COST_LABELS[b.cost]}</span></span>`
            : '<span class="backup"><strong>If it rains:</strong> no sheltered swap found nearby, so consider skipping this one.</span>';
        }
        return `<li class="plan-stop">${leg}<span class="category">${escapeHtml(stop.tags[0])}</span><p>${escapeHtml(stop.text)}</p><span class="meta">${stop.area} · ${stop.minMinutes} min · ${COST_LABELS[stop.cost]}</span>${backupHtml}</li>`;
      })
      .join('');

    let note = '';
    if (plan.rainProof) note = 'Planned around rain: indoor and sheltered stops only.';
    else if (Object.keys(plan.backups).length > 0) note = 'The weather now may not match the day you go, so each outdoor stop comes with a rain backup.';

    return `<p class="plan-summary">${escapeHtml(planSummary(plan))}</p>
        ${note ? `<p class="plan-note">${escapeHtml(note)}</p>` : ''}
        <ol class="plan-stops">${stopsHtml}</ol>`;
  }

  function renderPlans(plans, requestedDays, options) {
    const out = el('plan-result');
    if (plans.length === 0) {
      lastPlans = [];
      lastPlanText = '';
      const hint =
        options.daypart === 'evening'
          ? 'Evening out has fewer picks. Try removing the energy filter, turning off rain-proof, or choosing "Anywhere".'
          : 'Try more time, a bigger budget, a different energy level, "Anyone", or "Anywhere".';
      out.innerHTML = `<p class="empty-note">Nothing fits that combination. ${hint}</p>`;
      return;
    }

    const dates = weekendDates && requestedDays <= weekendDates.length ? weekendDates.slice(0, requestedDays) : null;
    const labels = dates ? dates.map(dayLabel) : [];
    lastDates = dates;
    lastPlans = plans;
    lastPlanText = plans.length === 1 ? formatPlanText(plans[0]) : formatMultiDayText(plans, labels);

    const shortNote =
      plans.length < requestedDays
        ? `<p class="plan-note">Only ${plans.length} of ${requestedDays} days could be filled without repeating a place. Loosen a filter (area, who's going, energy) for more.</p>`
        : '';
    const bodyHtml =
      plans.length === 1
        ? planBodyHtml(plans[0])
        : plans
            .map((plan, i) => `<h3 class="day-heading">Day ${i + 1}${labels[i] ? ` · ${escapeHtml(labels[i])}` : ''}</h3>${planBodyHtml(plan)}`)
            .join('');

    out.innerHTML = `
      <div class="plan">
        ${shortNote}
        ${bodyHtml}
        <div class="actions">
          <button data-action="shuffle">Shuffle</button>
          <button data-action="share">Share / copy</button>
          <button data-action="link">Copy link</button>
          <button data-action="save">Save plan</button>
        </div>
        <span id="plan-status" class="muted-note" role="status"></span>
        <textarea id="plan-fallback" class="plan-fallback" rows="8" readonly hidden></textarea>
        <p class="plan-footnote">Travel times are rough estimates, not live transit data. Opening hours aren't checked: confirm before you go.</p>
      </div>`;
  }

  function buildAndRenderPlan(avoidIds) {
    const options = planOptionsFromForm(avoidIds);
    const days = Number(el('plan-days').value);
    planBuiltOnce = true;
    el('shared-note').hidden = true;
    clearShareHash();
    renderPlans(planDays(ACTIVITIES, options, days), days, options);
  }

  // The link carries the plan itself in the URL fragment, which browsers never
  // send to a server, so there is nothing to host and nothing is uploaded.
  function planLink() {
    return `${location.href.split('#')[0]}#p=${encodePlans(lastPlans, lastDates)}`;
  }

  function clearShareHash() {
    try {
      if (location.hash.startsWith('#p=')) history.replaceState(null, '', location.href.split('#')[0]);
    } catch {
      // older browsers or sandboxed frames; the stale hash is harmless
    }
  }

  async function copyText(text, okMessage) {
    const status = el('plan-status');
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = okMessage;
    } catch {
      status.textContent = 'Could not copy automatically. Select and copy the text below.';
      const box = el('plan-fallback');
      box.value = text;
      box.hidden = false;
    }
  }

  async function sharePlan() {
    if (lastPlans.length === 0) return;
    const text = `${lastPlanText}\n\nOpen this plan in the app: ${planLink()}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Bored SG plan', text });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    copyText(text, 'Copied with a link. Paste it into WhatsApp or Notes.');
  }

  // Opens a plan from a shared link, if the page was opened with one. Returns
  // true when a plan was shown.
  function openSharedPlan() {
    if (!location.hash.startsWith('#p=')) return false;
    const note = el('shared-note');
    const decoded = decodePlans(location.hash.slice(3), ACTIVITIES);
    // Mark the planner as built first so opening it doesn't replace the shared plan (or clear the link).
    if (decoded) planBuiltOnce = true;
    document.querySelector('[data-mode="plan"]').click();
    note.hidden = false;
    if (!decoded) {
      note.textContent = "That shared plan link couldn't be opened. It may be cut off, or made with a different version of the app. Build your own below.";
      return false;
    }
    const first = decoded.plans[0];
    const setIfOption = (id, value) => {
      const select = el(id);
      if ([...select.options].some((o) => o.value === String(value))) select.value = String(value);
    };
    setIfOption('plan-time', first.windowMinutes);
    setIfOption('plan-budget', first.budget);
    setIfOption('plan-days', decoded.plans.length);
    el('plan-rainproof').checked = first.rainProof;
    weekendDates = decoded.dates;
    note.textContent = 'You are viewing a plan someone shared with you. Change anything below and tap "Build my plan" to make your own.';
    renderPlans(decoded.plans, decoded.plans.length, { daypart: 'day' });
    return true;
  }

  function savePlan() {
    if (lastPlans.length === 0) return;
    const status = el('plan-status');
    const plans = loadList(STORAGE_KEYS.plans);
    if (plans.some((p) => p.text === lastPlanText)) {
      status.textContent = 'Already saved.';
      return;
    }
    const summary = lastPlans.length === 1 ? planSummary(lastPlans[0]) : `${lastPlans.length}-day plan · ${lastPlans.reduce((n, p) => n + p.stops.length, 0)} stops`;
    plans.unshift({ id: Date.now(), summary, text: lastPlanText });
    if (saveList(STORAGE_KEYS.plans, plans)) {
      status.textContent = 'Saved on this device.';
      renderSavedPlans();
    } else {
      status.textContent = 'Could not save: this browser is blocking storage (private mode?).';
    }
  }

  function renderSavedPlans() {
    const plans = loadList(STORAGE_KEYS.plans);
    const list = el('plans-list');
    list.innerHTML = '';
    el('plans-empty').hidden = plans.length > 0;
    plans.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'saved-plan';
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = p.summary;
      const pre = document.createElement('pre');
      pre.textContent = p.text;
      details.append(summary, pre);
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.onclick = () => {
        saveList(STORAGE_KEYS.plans, loadList(STORAGE_KEYS.plans).filter((x) => x.id !== p.id));
        renderSavedPlans();
      };
      li.append(details, removeBtn);
      list.appendChild(li);
    });
  }

  el('btn-plan').addEventListener('click', () => buildAndRenderPlan([]));

  el('plan-result').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'shuffle') buildAndRenderPlan(lastPlans.flatMap((p) => p.stops.map((s) => s.id)));
    else if (action === 'share') sharePlan();
    else if (action === 'link') copyText(planLink(), 'Link copied.');
    else if (action === 'save') savePlan();
  });

  // "Use my location": asks the browser for a position, maps it to the nearest
  // region centre and selects that area. The position is used once and never
  // stored or sent anywhere.
  document.querySelectorAll('[data-locate]').forEach((btn) => {
    const select = el(btn.dataset.locate);
    const status = document.querySelector(`[data-locate-status="${btn.dataset.locate}"]`);
    btn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        status.textContent = 'Location is not available in this browser.';
        return;
      }
      status.textContent = 'Locating…';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const area = nearestArea(pos.coords.latitude, pos.coords.longitude);
          if (!area) {
            status.textContent = "You don't seem to be in Singapore, so the area was left unchanged.";
            return;
          }
          select.value = area;
          select.dispatchEvent(new Event('change'));
          status.textContent = `Nearest region: ${area}. This is a rough guess near borders; change it if wrong.`;
        },
        (err) => {
          status.textContent = err && err.code === 1 ? 'Location permission was denied.' : 'Could not get your location.';
        },
        { timeout: 10000, maximumAge: 600000 }
      );
    });
  });

  // Offer a one-tap multi-day plan when a long weekend is coming up.
  const upcomingWeekend = nextLongWeekend(new Date(), 21);
  if (upcomingWeekend) {
    const hint = el('longweekend-hint');
    hint.hidden = false;
    hint.innerHTML = `📅 Long weekend: ${escapeHtml(dayLabel(upcomingWeekend.dates[0]))} to ${escapeHtml(dayLabel(upcomingWeekend.dates[2]))} (${escapeHtml(upcomingWeekend.name)}). <button type="button" id="btn-weekend" class="link-btn">Plan all 3 days</button>`;
    el('btn-weekend').addEventListener('click', () => {
      weekendDates = upcomingWeekend.dates;
      el('plan-days').value = '3';
      buildAndRenderPlan([]);
    });
  }
  el('plan-days').addEventListener('change', () => {
    weekendDates = null;
  });

  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      document.querySelectorAll('.mode-btn').forEach((b) => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', String(active));
      });
      el('mode-quick').hidden = mode !== 'quick';
      el('mode-plan').hidden = mode !== 'plan';
      // Open the planner with a real plan on screen rather than an empty form.
      if (mode === 'plan' && !planBuiltOnce) buildAndRenderPlan([]);
    });
  });

  btnSurprise.addEventListener('click', draw);

  btnSkip.addEventListener('click', draw);

  btnSave.addEventListener('click', () => {
    if (!current) return;
    const saved = loadList(STORAGE_KEYS.saved);
    if (!saved.some((i) => i.id === current.id)) {
      saved.push({ id: current.id, text: current.text });
      saveList(STORAGE_KEYS.saved, saved);
      renderSaved();
    }
  });

  btnDone.addEventListener('click', () => {
    if (!current) return;
    const done = loadList(STORAGE_KEYS.done);
    done.push({ id: current.id, text: current.text, doneAt: Date.now() });
    saveList(STORAGE_KEYS.done, done);
    renderDone();
    renderStats();
    draw();
  });

  [filterTime, filterCost, filterEnergy, filterLocation, filterArea, filterWho].forEach((f) =>
    f.addEventListener('change', () => {
      if (current) draw();
    })
  );

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      el(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  }

  themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });

  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
  if (savedTheme) applyTheme(savedTheme);
  else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) applyTheme('dark');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // offline support is a nice-to-have; ignore registration failures
      });
    });
  }

  renderSaved();
  renderDone();
  renderStats();
  renderSavedPlans();
  renderHolidayBanner();
  openSharedPlan();
  renderWeatherStatus();

  fetchSingaporeWeather()
    .then((summary) => {
      weatherState.isRaining = summary.isRaining;
      weatherState.rainingFraction = summary.rainingFraction;
      weatherState.known = true;
      weatherState.checked = true;
      renderWeatherBanner();
      renderWeatherStatus();
      if (current) draw();
    })
    .catch(() => {
      // NEA API unreachable, blocked, or shape changed — the app still
      // works fine without live weather, but the status line surfaces this
      // instead of silently pretending nothing happened.
      weatherState.known = false;
      weatherState.checked = true;
      renderWeatherBanner();
      renderWeatherStatus();
    });
})();
