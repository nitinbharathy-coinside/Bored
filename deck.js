// The Quick pick card stack, kept free of the DOM so it can be unit tested.
//
// `cards` is a pre-shuffled list; `passes(card)` says whether a card may be
// shown right now (used for the live rain filter, so it is re-evaluated on
// every call and can change while the deck is in use). Cards are never shown
// twice until the deck is rebuilt. Cards that `passes` hides stay in the deck
// and come back if they pass again later.
(function () {
  function createDeck(cards, passes = () => true) {
    const list = cards.slice();
    const seen = new Set(); // indexes already taken
    const taken = []; // taken indexes, newest last, for undo

    // Unseen cards that may be shown right now, in deck order. A card hidden by
    // `passes` stays unseen, so it returns if it passes again later.
    const visible = () => {
      const out = [];
      for (let i = 0; i < list.length; i++) if (!seen.has(i) && passes(list[i])) out.push(i);
      return out;
    };

    return {
      size: list.length,
      peek(n) {
        return visible().slice(0, n).map((i) => list[i]);
      },
      // Removes and returns the top visible card, or null if none is left.
      take() {
        const index = visible()[0];
        if (index === undefined) return null;
        seen.add(index);
        taken.push(index);
        return list[index];
      },
      canUndo() {
        return taken.length > 0;
      },
      // Puts the most recently taken card back and returns it. It goes back to
      // its original place in the deck order, which is the top unless a card
      // ahead of it was hidden by `passes` when it was taken.
      undo() {
        if (taken.length === 0) return null;
        const index = taken.pop();
        seen.delete(index);
        return list[index];
      },
      remaining() {
        return visible().length;
      },
      // Unseen cards currently hidden by `passes` (e.g. the rain filter).
      hiddenCount() {
        let n = 0;
        for (let i = 0; i < list.length; i++) if (!seen.has(i) && !passes(list[i])) n++;
        return n;
      },
    };
  }

  const deckApi = { createDeck };

  if (typeof module !== 'undefined') module.exports = deckApi;
  if (typeof window !== 'undefined') window.BoredDeck = deckApi;
})();
