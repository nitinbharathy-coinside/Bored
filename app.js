(function () {
  const STORAGE_KEYS = { saved: 'bored.saved', done: 'bored.done', theme: 'bored.theme' };
  const RECENT_LIMIT = 8; // avoid repeating the last N picks in this session

  const el = (id) => document.getElementById(id);
  const filterTime = el('filter-time');
  const filterCost = el('filter-cost');
  const filterEnergy = el('filter-energy');
  const filterLocation = el('filter-location');
  const card = el('card');
  const btnSurprise = el('btn-surprise');
  const btnSkip = el('btn-skip');
  const btnSave = el('btn-save');
  const btnDone = el('btn-done');
  const themeToggle = el('theme-toggle');

  let current = null;
  let recentIds = [];

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

  function matchesFilters(activity) {
    const time = filterTime.value;
    const cost = filterCost.value;
    const energy = filterEnergy.value;
    const location = filterLocation.value;

    if (time !== 'any' && activity.minMinutes > Number(time)) return false;
    if (cost === 'free' && activity.cost !== 'free') return false;
    if (cost === 'low' && activity.cost === 'paid') return false;
    if (energy !== 'any' && activity.energy !== energy) return false;
    if (location !== 'any' && activity.location !== 'any' && activity.location !== location) return false;
    return true;
  }

  function pickActivity() {
    const pool = ACTIVITIES.filter(matchesFilters);
    if (pool.length === 0) return null;

    let candidates = pool.filter((a) => !recentIds.includes(a.id));
    if (candidates.length === 0) candidates = pool; // exhausted the pool, allow repeats again

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function renderCard(activity) {
    if (!activity) {
      card.className = 'card empty';
      card.innerHTML = '<p>Nothing matches those filters. Try loosening one.</p>';
      btnSkip.disabled = true;
      btnSave.disabled = true;
      btnDone.disabled = true;
      return;
    }
    card.className = 'card';
    card.innerHTML = `<div><p>${escapeHtml(activity.text)}</p><span class="tags">${activity.tags.join(' · ')} · ${activity.minMinutes} min · ${activity.cost}</span></div>`;
    btnSkip.disabled = false;
    btnSave.disabled = false;
    btnDone.disabled = false;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function draw() {
    current = pickActivity();
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
    empty.style.display = saved.length ? 'none' : 'block';
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
    empty.style.display = done.length ? 'none' : 'block';
    done
      .slice()
      .reverse()
      .forEach((item) => {
        const li = document.createElement('li');
        const when = new Date(item.doneAt).toLocaleDateString();
        li.innerHTML = `<span>${escapeHtml(item.text)}</span><span style="color:var(--muted);font-size:0.75rem">${when}</span>`;
        list.appendChild(li);
      });
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
    draw();
  });

  [filterTime, filterCost, filterEnergy, filterLocation].forEach((f) =>
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

  renderSaved();
  renderDone();
})();
