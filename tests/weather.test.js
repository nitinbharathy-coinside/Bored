const test = require('node:test');
const assert = require('node:assert/strict');
const { isRainForecast, summarizeForecast, fetchSingaporeWeather, RAIN_FRACTION_THRESHOLD, sceneFromForecasts, isNightInSingapore } = require('../weather.js');

test('isRainForecast recognizes rain-family forecast text, case-insensitively', () => {
  assert.equal(isRainForecast('Light Rain'), true);
  assert.equal(isRainForecast('heavy thundery showers'), true);
  assert.equal(isRainForecast('Passing Showers'), true);
  assert.equal(isRainForecast('Cloudy'), false);
  assert.equal(isRainForecast('Fair (Day)'), false);
  assert.equal(isRainForecast(''), false);
  assert.equal(isRainForecast(undefined), false);
});

test('summarizeForecast is not raining when no areas report rain', () => {
  const forecasts = [{ area: 'Bishan', forecast: 'Cloudy' }, { area: 'Tampines', forecast: 'Fair' }];
  const summary = summarizeForecast(forecasts);
  assert.equal(summary.isRaining, false);
  assert.equal(summary.rainingAreaCount, 0);
  assert.equal(summary.totalAreaCount, 2);
});

test('summarizeForecast flips to raining once enough areas report rain', () => {
  const forecasts = [
    { area: 'Bishan', forecast: 'Heavy Rain' },
    { area: 'Tampines', forecast: 'Thundery Showers' },
    { area: 'Jurong', forecast: 'Cloudy' },
    { area: 'Woodlands', forecast: 'Fair' },
    { area: 'Sentosa', forecast: 'Fair' },
  ];
  const summary = summarizeForecast(forecasts);
  assert.equal(summary.rainingAreaCount, 2);
  assert.equal(summary.totalAreaCount, 5);
  assert.equal(summary.rainingFraction, 0.4);
  assert.ok(summary.rainingFraction >= RAIN_FRACTION_THRESHOLD);
  assert.equal(summary.isRaining, true);
});

test('summarizeForecast does not flip for a single stray shower among many areas', () => {
  const forecasts = Array.from({ length: 10 }, (_, i) => ({ area: `Area${i}`, forecast: 'Fair' }));
  forecasts[0].forecast = 'Light Rain';
  const summary = summarizeForecast(forecasts);
  assert.equal(summary.rainingFraction, 0.1);
  assert.equal(summary.isRaining, false);
});

test('summarizeForecast handles an empty forecast list without throwing', () => {
  const summary = summarizeForecast([]);
  assert.equal(summary.isRaining, false);
  assert.equal(summary.totalAreaCount, 0);
});

test('fetchSingaporeWeather parses a well-formed API response via an injected fetch', async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({
      data: {
        items: [
          {
            forecasts: [
              { area: 'Bishan', forecast: 'Light Rain' },
              { area: 'Tampines', forecast: 'Fair' },
            ],
          },
        ],
      },
    }),
  });
  const summary = await fetchSingaporeWeather(fakeFetch);
  assert.equal(summary.totalAreaCount, 2);
  assert.equal(summary.rainingAreaCount, 1);
});

test('fetchSingaporeWeather rejects on a non-ok HTTP response', async () => {
  const fakeFetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => fetchSingaporeWeather(fakeFetch));
});

test('fetchSingaporeWeather rejects on an unexpected response shape rather than crashing silently', async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ unexpected: true }) });
  // unexpected shape -> forecasts is undefined -> summarizeForecast treats it as empty, not a throw
  const summary = await fetchSingaporeWeather(fakeFetch);
  assert.equal(summary.isRaining, false);
  assert.equal(summary.totalAreaCount, 0);
});

const META = [
  { name: 'Jurong West', label_location: { latitude: 1.34, longitude: 103.70 } },
  { name: 'Bishan', label_location: { latitude: 1.35, longitude: 103.84 } },
  { name: 'Tampines', label_location: { latitude: 1.35, longitude: 103.94 } },
];

test('sceneFromForecasts puts rain only in the zone that has it', () => {
  const s = sceneFromForecasts([
    { area: 'Jurong West', forecast: 'Fair (Day)' },
    { area: 'Bishan', forecast: 'Fair (Day)' },
    { area: 'Tampines', forecast: 'Thundery Showers' },
  ], META);
  assert.deepEqual(s.rain, { west: false, central: false, east: true });
  assert.equal(s.sky, 'clear');
});

test('sceneFromForecasts grades cloud cover: fair, partly cloudy, cloudy', () => {
  const mk = (f) => sceneFromForecasts([{ area: 'Bishan', forecast: f }], META).sky;
  assert.equal(mk('Fair & Warm'), 'clear');
  assert.equal(mk('Partly Cloudy (Day)'), 'partly');
  assert.equal(mk('Cloudy'), 'cloudy');
  assert.equal(mk('Hazy'), 'cloudy');
});

test('sceneFromForecasts without area metadata treats rain as island-wide or absent', () => {
  const wet = sceneFromForecasts([{ area: 'X', forecast: 'Light Rain' }, { area: 'Y', forecast: 'Light Rain' }], undefined);
  assert.deepEqual(wet.rain, { west: true, central: true, east: true });
  const dry = sceneFromForecasts([{ area: 'X', forecast: 'Fair' }], undefined);
  assert.deepEqual(dry.rain, { west: false, central: false, east: false });
});

test('sceneFromForecasts returns null for an empty forecast', () => {
  assert.equal(sceneFromForecasts([], META), null);
});

test('isNightInSingapore uses Singapore time (UTC+8), not the device zone', () => {
  assert.equal(isNightInSingapore(new Date('2026-06-01T00:00:00Z')), false); // 08:00 SGT
  assert.equal(isNightInSingapore(new Date('2026-06-01T11:00:00Z')), true);  // 19:00 SGT
  assert.equal(isNightInSingapore(new Date('2026-06-01T22:59:00Z')), true);  // 06:59 SGT
  assert.equal(isNightInSingapore(new Date('2026-06-01T23:00:00Z')), false); // 07:00 SGT
});
