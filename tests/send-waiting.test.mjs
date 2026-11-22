// @ts-check
/*
 * A teacher's waiting cards, sent from anywhere in the app (0.669).
 *
 * The trainer and the Teaching screen both ask for them to be sent, and a
 * second ask while one is going must share it, not start another: two
 * senders draining the same queue would put a card up twice.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

/** @type {Map<string, string>} */
const held = new Map();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (/** @type {string} */ k) => (held.has(k) ? held.get(k) : null),
    setItem: (/** @type {string} */ k, /** @type {string} */ v) => held.set(k, String(v)),
    removeItem: (/** @type {string} */ k) => held.delete(k),
    key: (/** @type {number} */ i) => [...held.keys()][i] ?? null,
    clear: () => held.clear(),
    get length() {
      return held.size;
    },
  },
  configurable: true,
});

const { sendWaitingCards, lockedNote, droppedCards, dismissDropped } = await import("../src/send-waiting.ts");
const { watchOutbox, keep, CARD_OUTBOX } = await import("../src/outbox.ts");

test("two asks at once share one send", async () => {
  /** @type {string[]} */
  const said = [];
  const say = (/** @type {string} */ m) => void said.push(m);
  const a = sendWaitingCards({ say });
  const b = sendWaitingCards({ say });
  assert.equal(a, b);
  assert.equal(await a, 0);
  /* And once it is done, the next ask is a send of its own. */
  assert.notEqual(sendWaitingCards({ say }), a);
  assert.deepEqual(said, []);
});

test("the queue tells whoever is watching when it changes", () => {
  let heard = 0;
  const stop = watchOutbox(() => {
    heard += 1;
  });
  keep(CARD_OUTBOX, { card: { id: "c1" }, decks: [] });
  assert.equal(heard, 1);
  stop();
  keep(CARD_OUTBOX, { card: { id: "c2" }, decks: [] });
  assert.equal(heard, 1);
});

test("a locked deck is named, once or several", () => {
  assert.equal(lockedNote(new Set(["Food"])), '"Food" is locked, so its cards were not changed.');
  assert.equal(lockedNote(new Set(["Food", "Days"])), '"Food", "Days" are locked, so their cards were not changed.');
});

test("nothing discarded until something is, and Dismiss clears it", () => {
  assert.deepEqual(droppedCards(), []);
  dismissDropped();
  assert.deepEqual(droppedCards(), []);
});
