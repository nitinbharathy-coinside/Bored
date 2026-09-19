# Bored

A tiny, dependency-free web app: tell it how much time, energy, money, and
indoor/outdoor space you have, and it gives you one concrete thing to do.

No backend, no build step, no account. Everything (saved items, done history,
streaks, theme) lives in your browser's `localStorage`, and the app works
offline once loaded once (it's an installable PWA).

## Run it

Just open `index.html` in a browser, or serve it locally:

```bash
npm start
# or: python3 -m http.server 8080
```

On mobile, open the served URL and use "Add to Home Screen" — it installs
like a native app and works offline afterward.

## Deploying so you can reach it from your phone

Pushing to `main` deploys the site to GitHub Pages automatically (see
`.github/workflows/deploy.yml`) — enable Pages once for the repo under
Settings → Pages → Source: GitHub Actions, and every push to `main` gives you
a stable URL you can open on any device.

## Structure

- `index.html` — markup
- `style.css` — styling (light/dark via `prefers-color-scheme` + manual toggle)
- `data.js` — the activity dataset (`ACTIVITIES` array, 100 entries)
- `filter.js` — pure, DOM-free logic (filtering, picking, streak math) —
  unit tested and shared between the app and the test suite
- `app.js` — DOM wiring: rendering, event handlers, localStorage I/O
- `manifest.json`, `icon.svg`, `sw.js` — PWA install + offline support
- `tests/filter.test.js` — unit tests for `filter.js` and dataset integrity

## Testing

```bash
npm test
```

Runs on Node's built-in test runner (`node --test`), no dependencies. Covers
filter matching, the repeat-avoidance pick logic, streak calculation, and
dataset integrity (unique ids, well-formed fields).

## Adding activities

Edit `data.js`. Each entry needs:

```js
{ id: <unique number>, text: "...", minMinutes: 15, cost: 'free'|'low'|'paid',
  energy: 'low'|'med'|'high', location: 'indoor'|'outdoor'|'any', tags: ['...'] }
```

`tags[0]` is shown as the activity's category badge and used for the
"top category" stat.
