(function () {
  const { pickActivity, computeStreak } = window.BoredFilter;
  const { isPublicHoliday, nextPublicHoliday, isLongWeekendHoliday } = window.BoredHolidays;
  const { fetchSingaporeWeather } = window.BoredWeather;

  const STORAGE_KEYS = { saved: 'bored.saved', done: 'bored.done', theme: 'bored.theme' };
  const RECENT_LIMIT = 8; // avoid repeating the last N picks in this session

  const COST_LABELS = { free: 'Free', under10: 'Under $10', '10to30': '$10–$30', '30plus': '$30+' };

  const el = (id) => document.getElementById(id);
  const filterTime = el('filter-time');
  const filterCost = el('filter-cost');
  const filterEnergy = el('filter-energy');
  const filterLocation = el('filter-location');
  const filterArea = el('filter-area');
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
  let weatherState = { isRaining: false, ignoreWeather: false, known: false };

  function loadList(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  }

  function saveList(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
      // storage unavailable (private mode, quota) — fail silently, app still works this session
    }
  }

  function currentFilters() {
    return {
      time: filterTime.value,
      cost: filterCost.value,
      energy: filterEnergy.value,
      location: filterLocation.value,
      area: filterArea.value,
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

  function renderHolidayBanner() {
    const today = new Date();
    if (isPublicHoliday(today)) {
      holidayBanner.hidden = false;
      holidayBanner.textContent = "🎉 It's a public holiday in Singapore today — good day to go big.";
      return;
    }
    const next = nextPublicHoliday(today);
    if (!next) {
      holidayBanner.hidden = true;
      return;
    }
    const daysAway = Math.round((new Date(next.date) - new Date(today.toDateString())) / (24 * 60 * 60 * 1000));
    if (daysAway >= 1 && daysAway <= 3 && isLongWeekendHoliday(next.date)) {
      holidayBanner.hidden = false;
      holidayBanner.textContent = `📅 Long weekend ahead: ${next.name} in ${daysAway} day${daysAway > 1 ? 's' : ''}.`;
    } else {
      holidayBanner.hidden = true;
    }
  }

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

  [filterTime, filterCost, filterEnergy, filterLocation, filterArea].forEach((f) =>
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
  renderHolidayBanner();

  fetchSingaporeWeather()
    .then((summary) => {
      weatherState.isRaining = summary.isRaining;
      weatherState.known = true;
      renderWeatherBanner();
      if (current) draw();
    })
    .catch(() => {
      // NEA API unreachable, blocked, or shape changed — degrade silently,
      // the app works fine without live weather.
      weatherState.known = false;
      renderWeatherBanner();
    });
})();
