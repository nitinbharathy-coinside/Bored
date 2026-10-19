const test = require('node:test');
const assert = require('node:assert/strict');
const { createDeck } = require('../deck.js');
const { shuffle, buildDeck, matchesFilters } = require('../filter.js');
const ACTIVITIES = require('../data.js');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const card = (id, extra) => ({ id, ...extra });

test('shuffle returns a permutation, does not mutate its input, and is seed-reproducible', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const copy = input.slice();
  const out = shuffle(input, mulberry32(4));
  assert.deepEqual(input, copy);
  assert.deepEqual(out.slice().sort(), copy);
  assert.deepEqual(shuffle(input, mulberry32(4)), out);
  const orders = new Set();
  for (let s = 1; s <= 20; s++) orders.add(shuffle(input, mulberry32(s)).join());
  assert.ok(orders.size > 10, 'different seeds should give different orders');
});

test('shuffle handles empty and single-item arrays', () => {
  assert.deepEqual(shuffle([]), []);
  assert.deepEqual(shuffle([9]), [9]);
});

test('buildDeck contains exactly the activities matching the filters, once each', () => {
  const filters = { cost: 'free', area: 'East', who: 'kids' };
  const deck = buildDeck(ACTIVITIES, filters, mulberry32(1));
  const expected = ACTIVITIES.filter((a) => matchesFilters(a, filters)).map((a) => a.id).sort((a, b) => a - b);
  assert.ok(expected.length > 0);
  assert.deepEqual(deck.map((a) => a.id).sort((a, b) => a - b), expected);
});

test('buildDeck does not apply weather: that is the deck predicate\'s job', () => {
  const sensitive = ACTIVITIES.filter((a) => a.weatherSensitive).length;
  assert.ok(sensitive > 0);
  assert.equal(buildDeck(ACTIVITIES, {}, mulberry32(1)).length, ACTIVITIES.length);
});

test('a deck hands out each card once, in order, then reports empty', () => {
  const deck = createDeck([card(1), card(2), card(3)]);
  assert.deepEqual(deck.peek(2).map((c) => c.id), [1, 2]);
  assert.equal(deck.take().id, 1);
  assert.equal(deck.take().id, 2);
  assert.equal(deck.take().id, 3);
  assert.equal(deck.take(), null);
  assert.equal(deck.remaining(), 0);
  assert.deepEqual(deck.peek(3), []);
});

test('peek never returns more than asked or than remain', () => {
  const deck = createDeck([card(1), card(2)]);
  assert.equal(deck.peek(5).length, 2);
  assert.equal(deck.peek(0).length, 0);
});

test('undo puts the last taken card back on top, repeatedly, and stops at the start', () => {
  const deck = createDeck([card(1), card(2), card(3)]);
  assert.equal(deck.canUndo(), false);
  assert.equal(deck.undo(), null);
  deck.take();
  deck.take();
  assert.equal(deck.undo().id, 2);
  assert.equal(deck.peek(1)[0].id, 2);
  assert.equal(deck.undo().id, 1);
  assert.equal(deck.peek(1)[0].id, 1);
  assert.equal(deck.canUndo(), false);
  assert.equal(deck.take().id, 1);
});

test('rain-hidden cards are skipped and counted, and come back once they pass again', () => {
  let raining = true;
  const deck = createDeck([card(1, { wet: true }), card(2), card(3, { wet: true }), card(4)], (c) => !(raining && c.wet));
  assert.deepEqual(deck.peek(5).map((c) => c.id), [2, 4]);
  assert.equal(deck.hiddenCount(), 2);
  assert.equal(deck.take().id, 2);
  assert.equal(deck.take().id, 4);
  assert.equal(deck.take(), null);
  assert.equal(deck.hiddenCount(), 2, 'the two wet cards are still unseen, so the UI can say why it is empty');
  raining = false;
  assert.deepEqual(deck.peek(5).map((c) => c.id), [1, 3], 'wet cards that were passed over are offered again');
  assert.equal(deck.hiddenCount(), 0);
});

test('a late rain change hides cards that were already queued, and clearing it restores them', () => {
  let raining = false;
  const deck = createDeck([card(1, { wet: true }), card(2, { wet: true }), card(3)], (c) => !(raining && c.wet));
  assert.equal(deck.peek(1)[0].id, 1);
  raining = true;
  assert.equal(deck.peek(1)[0].id, 3);
  assert.equal(deck.hiddenCount(), 2);
  raining = false;
  assert.equal(deck.peek(1)[0].id, 1);
});

test('when only rain-hidden cards remain, remaining is 0 but hiddenCount says why', () => {
  const deck = createDeck([card(1, { wet: true })], (c) => !c.wet);
  assert.equal(deck.remaining(), 0);
  assert.equal(deck.hiddenCount(), 1);
  assert.equal(deck.take(), null);
  assert.equal(deck.size, 1);
});

test('undo restores a card taken before rain arrived, even if rain now hides it', () => {
  let raining = false;
  const deck = createDeck([card(1, { wet: true }), card(2)], (c) => !(raining && c.wet));
  deck.take();
  raining = true;
  assert.equal(deck.undo().id, 1);
  assert.deepEqual(deck.peek(2).map((c) => c.id), [2], 'but it is hidden again while it rains');
});

test('an empty deck is safe', () => {
  const deck = createDeck([]);
  assert.equal(deck.size, 0);
  assert.equal(deck.take(), null);
  assert.equal(deck.undo(), null);
  assert.equal(deck.remaining(), 0);
});

test('createDeck copies its input, so later changes to the array do not affect it', () => {
  const cards = [card(1), card(2)];
  const deck = createDeck(cards);
  cards.pop();
  assert.equal(deck.remaining(), 2);
});

test('undo of a card taken while an earlier card was hidden returns it to its original place', () => {
  let raining = true;
  const deck = createDeck([card(1, { wet: true }), card(2), card(3)], (c) => !(raining && c.wet));
  assert.equal(deck.take().id, 2);
  raining = false;
  assert.deepEqual(deck.peek(5).map((c) => c.id), [1, 3]);
  assert.equal(deck.undo().id, 2);
  assert.deepEqual(deck.peek(5).map((c) => c.id), [1, 2, 3], 'original order, not "on top"');
});

test('hiddenCount ignores cards already taken, even if rain would now hide them', () => {
  let raining = false;
  const deck = createDeck([card(1, { wet: true }), card(2, { wet: true }), card(3)], (c) => !(raining && c.wet));
  deck.take(); // card 1, taken while dry
  raining = true;
  assert.equal(deck.hiddenCount(), 1, 'only card 2 is unseen and hidden');
});
