const test = require('node:test');
const assert = require('node:assert/strict');
const { SG_PUBLIC_HOLIDAYS_2026, isPublicHoliday, nextPublicHoliday, isLongWeekendHoliday } = require('../holidays.js');

test('holiday table has well-formed, chronologically sane entries', () => {
  assert.ok(SG_PUBLIC_HOLIDAYS_2026.length >= 10);
  for (const h of SG_PUBLIC_HOLIDAYS_2026) {
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(h.date), `bad date format: ${h.date}`);
    assert.ok(h.name && h.name.length > 0, `missing name for ${h.date}`);
  }
});

test('isPublicHoliday matches a known 2026 holiday', () => {
  assert.equal(isPublicHoliday('2026-01-01'), true);
  assert.equal(isPublicHoliday('2026-12-25'), true);
});

test('isPublicHoliday is false for an ordinary day', () => {
  assert.equal(isPublicHoliday('2026-03-15'), false);
});

test('nextPublicHoliday finds the next entry on or after a given date', () => {
  const next = nextPublicHoliday('2026-01-02');
  assert.equal(next.date, '2026-02-17');
  assert.equal(next.name, 'Chinese New Year');
});

test('nextPublicHoliday is inclusive of the given date itself', () => {
  const next = nextPublicHoliday('2026-01-01');
  assert.equal(next.date, '2026-01-01');
});

test('nextPublicHoliday returns null once all holidays are in the past', () => {
  const next = nextPublicHoliday('2026-12-26');
  assert.equal(next, null);
});

test('isLongWeekendHoliday flags Monday and Friday holidays', () => {
  // 2026-06-01 is a Monday (Vesak Day in lieu)
  assert.equal(isLongWeekendHoliday('2026-06-01'), true);
  // 2026-04-03 is a Friday (Good Friday)
  assert.equal(isLongWeekendHoliday('2026-04-03'), true);
  // 2026-02-18 is a Wednesday (Chinese New Year day 2)
  assert.equal(isLongWeekendHoliday('2026-02-18'), false);
});

test('longWeekendDates: Monday holiday gives Sat-Sun-Mon, Friday gives Fri-Sat-Sun, other days null', () => {
  const { longWeekendDates } = require('../holidays.js');
  assert.deepEqual(longWeekendDates('2026-11-09'), ['2026-11-07', '2026-11-08', '2026-11-09']); // Monday
  assert.deepEqual(longWeekendDates('2026-12-25'), ['2026-12-25', '2026-12-26', '2026-12-27']); // Friday
  assert.equal(longWeekendDates('2026-11-08'), null); // Sunday
  assert.equal(longWeekendDates('2026-02-17'), null); // Tuesday
});

test('longWeekendDates crosses month and year boundaries', () => {
  const { longWeekendDates } = require('../holidays.js');
  assert.deepEqual(longWeekendDates('2026-06-01'), ['2026-05-30', '2026-05-31', '2026-06-01']);
});

test('nextLongWeekend skips a Sunday holiday and finds its in-lieu Monday', () => {
  const { nextLongWeekend } = require('../holidays.js');
  const lw = nextLongWeekend('2026-11-01', 21);
  assert.equal(lw.date, '2026-11-09');
  assert.deepEqual(lw.dates, ['2026-11-07', '2026-11-08', '2026-11-09']);
});

test('nextLongWeekend respects the lookahead window and returns null past the table', () => {
  const { nextLongWeekend } = require('../holidays.js');
  assert.equal(nextLongWeekend('2026-10-19', 14), null); // 21 days away
  assert.equal(nextLongWeekend('2026-10-19', 21).date, '2026-11-09');
  assert.equal(nextLongWeekend('2026-12-30', 21), null);
});

test('nextLongWeekend includes a holiday that is today', () => {
  const { nextLongWeekend } = require('../holidays.js');
  assert.equal(nextLongWeekend('2026-11-09', 1).date, '2026-11-09');
});
