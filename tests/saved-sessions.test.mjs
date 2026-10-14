// @ts-check
/*
 * A saved session that was built from whole decks follows those decks: a
 * card added to one since is in it, and a card taken out is not. Cards
 * picked one at a time stay named one at a time. See src/saved-sessions.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const { cardsOfSaved, describeSaved, missingFromSaved } =
  await import(path.join(here, "..", "src", "saved-sessions.ts"));

/** @param {string} id @param {string[]} tags */
const card = (id, ...tags) => /** @type {any} */ ({ id, tags, forms: [] });

/** @param {any[]} items */
const groupsOf = (items) => {
  const m = new Map();
  for (const it of items) for (const t of it.tags) m.set(t, (m.get(t) || []).concat([it]));
  return m;
};

const ids = (/** @type {any[]} */ cards) => cards.map((c) => c.id).sort();

test("a deck ticked whole is kept as the deck, not as its cards", () => {
  const items = [card("a", "Verbs"), card("b", "Verbs"), card("c", "Food")];
  const kept = describeSaved({ picked: new Set(["a", "b"]), groups: groupsOf(items), all: items });
  assert.deepEqual(kept, { ids: [], decks: ["Verbs"], everything: false });
});

test("a card added to the deck afterwards is in the session", () => {
  const before = [card("a", "Verbs"), card("b", "Verbs"), card("c", "Food")];
  const kept = describeSaved({ picked: new Set(["a", "b"]), groups: groupsOf(before), all: before });
  const after = before.concat([card("d", "Verbs")]);
  assert.deepEqual(ids(cardsOfSaved(kept, after)), ["a", "b", "d"]);
});

test("a card taken out of the deck afterwards leaves the session", () => {
  const before = [card("a", "Verbs"), card("b", "Verbs"), card("c", "Food")];
  const kept = describeSaved({ picked: new Set(["a", "b"]), groups: groupsOf(before), all: before });
  const after = [card("a", "Verbs"), card("b"), card("c", "Food")];
  assert.deepEqual(ids(cardsOfSaved(kept, after)), ["a"]);
});

test("cards picked one at a time stay exactly those cards", () => {
  const before = [card("a", "Verbs"), card("b", "Verbs"), card("c", "Food"), card("e", "Food")];
  const kept = describeSaved({ picked: new Set(["a", "c"]), groups: groupsOf(before), all: before });
  assert.deepEqual(kept, { ids: ["a", "c"], decks: [], everything: false });
  const after = before.concat([card("d", "Verbs")]);
  assert.deepEqual(ids(cardsOfSaved(kept, after)), ["a", "c"]);
});

test("a whole deck and a single card from another deck, together", () => {
  const before = [card("a", "Verbs"), card("b", "Verbs"), card("c", "Food"), card("e", "Food")];
  const kept = describeSaved({ picked: new Set(["a", "b", "c"]), groups: groupsOf(before), all: before });
  assert.deepEqual(kept, { ids: ["c"], decks: ["Verbs"], everything: false });
  assert.deepEqual(ids(cardsOfSaved(kept, before.concat([card("d", "Verbs")]))), ["a", "b", "c", "d"]);
});

test("Everything takes in whatever the learner has by then", () => {
  const before = [card("a", "Verbs"), card("c", "Food")];
  const kept = describeSaved({ picked: new Set(["a", "c"]), groups: groupsOf(before), all: before });
  assert.equal(kept.everything, true);
  assert.deepEqual(ids(cardsOfSaved(kept, before.concat([card("z", "New deck")]))), ["a", "c", "z"]);
});

test("a session kept before decks were remembered still opens on its cards", () => {
  const items = [card("a", "Verbs"), card("b", "Verbs"), card("d", "Verbs")];
  const old = { ids: ["a", "b", "gone"] };
  assert.deepEqual(ids(cardsOfSaved(old, items)), ["a", "b"]);
  assert.deepEqual(missingFromSaved(old, items), ["gone"]);
});
