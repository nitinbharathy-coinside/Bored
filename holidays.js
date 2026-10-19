// Singapore public holidays for 2026.
//
// Source: Ministry of Manpower press release "Public Holidays for 2026"
// (16 Jun 2025) — https://www.mom.gov.sg/newsroom/press-releases/2025/0616-public-holidays-for-2026
// Hari Raya Puasa and Hari Raya Haji depend on the sighting of the moon and
// were flagged by MOM as subject to confirmation closer to each date — treat
// those two as provisional. "(in lieu)" entries are the Monday given in place
// of a holiday that falls on a Sunday.
const SG_PUBLIC_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-02-17', name: 'Chinese New Year' },
  { date: '2026-02-18', name: 'Chinese New Year' },
  { date: '2026-03-21', name: 'Hari Raya Puasa' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-05-01', name: 'Labour Day' },
  { date: '2026-05-27', name: 'Hari Raya Haji' },
  { date: '2026-05-31', name: 'Vesak Day' },
  { date: '2026-06-01', name: 'Vesak Day (in lieu)' },
  { date: '2026-08-09', name: 'National Day' },
  { date: '2026-08-10', name: 'National Day (in lieu)' },
  { date: '2026-11-08', name: 'Deepavali' },
  { date: '2026-11-09', name: 'Deepavali (in lieu)' },
  { date: '2026-12-25', name: 'Christmas Day' },
];

function toDayKey(d) {
  return new Date(d).toDateString();
}

function isPublicHoliday(date, holidays = SG_PUBLIC_HOLIDAYS_2026) {
  const key = toDayKey(date);
  return holidays.some((h) => toDayKey(h.date) === key);
}

// Returns the next holiday on or after `fromDate` (inclusive), or null if
// the table has none left (e.g. after 25 Dec 2026).
function nextPublicHoliday(fromDate, holidays = SG_PUBLIC_HOLIDAYS_2026) {
  const fromKey = new Date(new Date(fromDate).toDateString()).getTime();
  const upcoming = holidays
    .map((h) => ({ ...h, ms: new Date(h.date).getTime() }))
    .filter((h) => h.ms >= fromKey)
    .sort((a, b) => a.ms - b.ms);
  return upcoming[0] || null;
}

// A holiday on a Monday or Friday extends the weekend on one side; this is a
// simple heuristic, not a check against actual scheduled off-days.
function isLongWeekendHoliday(dateStr) {
  const day = new Date(dateStr).getDay(); // 0 Sun .. 6 Sat
  return day === 1 || day === 5;
}

// 'YYYY-MM-DD' plus `n` days, done in UTC so the result doesn't depend on the
// device's time zone.
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// The three days of a long weekend built around a Monday or Friday holiday:
// Sat-Sun-Mon for a Monday, Fri-Sat-Sun for a Friday. Returns null for any
// other weekday.
function longWeekendDates(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (day === 1) return [addDays(dateStr, -2), addDays(dateStr, -1), dateStr];
  if (day === 5) return [dateStr, addDays(dateStr, 1), addDays(dateStr, 2)];
  return null;
}

// The next Monday/Friday holiday on or after `fromDate` that is within
// `withinDays`, with its three long-weekend dates; otherwise null. This looks
// past a holiday that falls on a Sunday, whose in-lieu Monday is the one that
// creates the long weekend.
function nextLongWeekend(fromDate, withinDays = 21, holidays = SG_PUBLIC_HOLIDAYS_2026) {
  const from = new Date(fromDate);
  const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
  const limit = addDays(fromStr, withinDays);
  const match = holidays
    .filter((h) => h.date >= fromStr && h.date <= limit && longWeekendDates(h.date))
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  return match ? { ...match, dates: longWeekendDates(match.date) } : null;
}

const holidaysApi = { SG_PUBLIC_HOLIDAYS_2026, isPublicHoliday, nextPublicHoliday, isLongWeekendHoliday, longWeekendDates, nextLongWeekend };

if (typeof module !== 'undefined') module.exports = holidaysApi;
if (typeof window !== 'undefined') window.BoredHolidays = holidaysApi;
