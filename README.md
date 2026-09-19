# Bored

A tiny, dependency-free web app: tell it how much time, energy, money, and
indoor/outdoor space you have, and it gives you one concrete thing to do.

No backend, no build step, no account. Everything (saved items, done history,
theme) lives in your browser's `localStorage`.

## Run it

Just open `index.html` in a browser, or serve it locally:

```bash
npx serve .
# or
python3 -m http.server 8080
```

## Structure

- `index.html` — markup
- `style.css` — styling (light/dark via `prefers-color-scheme` + manual toggle)
- `data.js` — the activity dataset (`ACTIVITIES` array)
- `app.js` — filtering, random pick (avoids repeating your last 8 picks),
  save/done tracking

## Adding activities

Edit `data.js`. Each entry needs:

```js
{ id: <unique number>, text: "...", minMinutes: 15, cost: 'free'|'low'|'paid',
  energy: 'low'|'med'|'high', location: 'indoor'|'outdoor'|'any', tags: ['...'] }
```
