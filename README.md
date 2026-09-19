# Bored SG

A tiny, dependency-free web app: tell it how much time, budget, energy, and
which part of Singapore you're in, and it gives you one concrete thing to do
— with a curated set of real Singapore places, live weather awareness, and
Singapore public holiday awareness baked in.

No backend, no build step, no account. Saved items, done history, streaks,
and theme live in your browser's `localStorage`, and the app works offline
once loaded once (it's an installable PWA).

## What's Singapore-specific about it

- **72 real Singapore activities** across hawker food, parks and nature,
  heritage, paid attractions, water/active, malls and rainy-day indoor
  options, neighbourhood walks, and fitness — each tagged with a part of the
  island (Central / East / West / North / North-East / South / Islandwide).
- **Live weather awareness.** On load, the app fetches NEA's 2-hour weather
  forecast (via `data.gov.sg`) and, if enough of Singapore's ~47 forecast
  areas are reporting rain, automatically hides outdoor activities that would
  actually be spoiled by it (a covered hawker centre stays available; East
  Coast Park cycling doesn't). A banner explains what happened and lets you
  override it with one tap ("show outdoor anyway").
- **Public holiday awareness.** Singapore's 2026 public holiday calendar
  (from MOM) is baked in. On a public holiday, the app says so; ahead of a
  long weekend (a holiday landing on a Monday or Friday), it gives you a
  heads-up a few days out.
- **SGD-realistic pricing.** Cost is shown in bands (Free / Under $10 /
  $10–$30 / $30+) rather than generic "free/low/paid" labels, and the budget
  filter works as a "up to" cutoff over those bands.

### Accuracy notes — read before trusting the dates or the weather blindly

- **Public holidays**: sourced from MOM's official press release, "Public
  Holidays for 2026" (16 Jun 2025). Hari Raya Puasa and Hari Raya Haji depend
  on the sighting of the moon and were flagged by MOM as provisional —
  double-check those two closer to the date. See `holidays.js` for the exact
  source link and the full table.
- **Weather**: this was built and tested in a sandboxed environment that
  could not reach `data.gov.sg` directly, so the exact API response shape and
  CORS behavior could not be verified against the live endpoint from here.
  The fetch wrapper (`weather.js`) is written defensively — any failure
  (network, CORS, unexpected shape) is caught and the app simply runs without
  the weather feature rather than breaking. If you find the live integration
  doesn't work as expected, that's the first place to check.
- "Raining in Singapore" is a heuristic: it flips once roughly 20% or more of
  NEA's forecast areas report rain, not a guarantee about your exact
  neighbourhood.

## Run it

Just open `index.html` in a browser, or serve it locally:

```bash
npm start
# or: python3 -m http.server 8080
```

On mobile, open the served URL and use "Add to Home Screen" — it installs
like a native app and works offline afterward (except live weather, which
needs a connection).

## Deploying so you can reach it from your phone

Pushing to `main` deploys the site to GitHub Pages automatically (see
`.github/workflows/deploy.yml`) — enable Pages once for the repo under
Settings → Pages → Source: GitHub Actions, and make sure the `github-pages`
environment's deployment branch policy allows `main` (Settings →
Environments → github-pages). Every push to `main` after that gives you a
stable URL you can open on any device.

## Structure

- `index.html` — markup
- `style.css` — styling (light/dark via `prefers-color-scheme` + manual toggle)
- `data.js` — the activity dataset (`ACTIVITIES` array, 72 Singapore entries)
- `filter.js` — pure, DOM-free logic (filtering, picking, streak math, and
  weather-based filtering) — unit tested
- `holidays.js` — Singapore's 2026 public holiday table and pure date helpers
  — unit tested
- `weather.js` — NEA live weather fetch + pure forecast-aggregation logic —
  the aggregation is unit tested against mocked API responses; the live fetch
  itself could not be integration-tested from this environment (see above)
- `app.js` — DOM wiring: rendering, event handlers, localStorage I/O, weather
  and holiday banners
- `manifest.json`, `icon.svg`, `sw.js` — PWA install + offline support (the
  service worker deliberately never caches cross-origin requests, so live
  weather isn't accidentally served stale forever)
- `tests/` — unit tests for `filter.js`, `holidays.js`, `weather.js`, and
  dataset integrity

## Testing

```bash
npm test
```

Runs on Node's built-in test runner (`node --test`), no dependencies.

## Adding activities

Edit `data.js`. Each entry needs:

```js
{ id: <unique number>, text: "...", minMinutes: 15,
  cost: 'free'|'under10'|'10to30'|'30plus',
  energy: 'low'|'med'|'high', location: 'indoor'|'outdoor'|'any',
  weatherSensitive: true|false,
  area: 'Islandwide'|'Central'|'East'|'West'|'North'|'North-East'|'South',
  tags: ['...'] }
```

`weatherSensitive` should be `true` only if rain would genuinely spoil the
activity (a walk in the park, cycling East Coast Park) — a covered hawker
centre or an indoor museum is `false` even though the walk there is outdoors.

`tags[0]` is shown as the activity's category badge and used for the "top
category" stat.
