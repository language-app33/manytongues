// @ts-check
/*
 * The You menu's sync line (0.655): when the last sync was and what is
 * waiting for the next, instead of "Sync failed" — which is now the bar at
 * the foot of the app, with Retry.
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const { syncLine, syncedWhen, changesBetween, pendingAdd, pendingSetOut, pendingSent, pendingFailed, pendingCount, NO_PENDING } =
  await import("../src/sync.ts");
const { holdReach, updateReach, reachState, resetReach, dismissReach, showReach } = await import("../src/reach.ts");

beforeEach(() => resetReach());

/* A moment on a known local day, so "today" and "yesterday" are fixed. */
const at = new Date(2026, 10, 20, 15, 0).getTime();
/** @param {number} h @param {number} m */
const hm = (h, m) => new Date(2026, 10, 20, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

test("the last sync is said as today, yesterday, then a date", () => {
  assert.equal(syncedWhen(new Date(2026, 10, 20, 14, 32).getTime(), at), `today at ${hm(14, 32)}`);
  assert.equal(syncedWhen(new Date(2026, 10, 19, 9, 10).getTime(), at), `yesterday at ${hm(9, 10)}`);
  const older = syncedWhen(new Date(2026, 10, 3, 9, 10).getTime(), at);
  assert.match(older, / at /);
  assert.doesNotMatch(older, /2026/, "this year's date leaves the year off");
  assert.match(syncedWhen(new Date(2025, 10, 3, 9, 10).getTime(), at), /2025/);
  assert.equal(syncedWhen(0, at), "");
});

test("nothing waiting: up to date, and when", () => {
  const last = new Date(2026, 10, 20, 14, 32).getTime();
  assert.deepEqual(syncLine({ lastSync: last, at }), {
    main: "Up to date",
    sub: `Last synced today at ${hm(14, 32)}`,
  });
});

test("what is waiting is counted, reports then cards then recordings", () => {
  const last = new Date(2026, 10, 20, 14, 32).getTime();
  const l = syncLine({ lastSync: last, reports: 2, cards: 23, clips: 1, at });
  assert.equal(l.main, "2 reports, 23 cards and 1 recording to sync");
  assert.equal(l.sub, `Last synced today at ${hm(14, 32)}`);
  assert.equal(syncLine({ lastSync: last, cards: 1, at }).main, "1 card to sync");
  assert.equal(syncLine({ lastSync: last, reports: 1, cards: 3, at }).main, "1 report and 3 cards to sync");
  /* Pictures and recordings added offline in the card editor (0.659). */
  assert.equal(syncLine({ lastSync: last, cards: 3, pictures: 2, clips: 1, at }).main, "3 cards, 2 pictures and 1 recording to sync");
});

test("never synced says so, and what is at stake", () => {
  assert.deepEqual(syncLine({ cards: 23, at }), { main: "Not synced yet", sub: "23 cards to sync" });
  assert.deepEqual(syncLine({ at }), { main: "Not synced yet", sub: "" });
});

test("the menu never says the sync failed: that is the bar's", () => {
  const last = new Date(2026, 10, 20, 14, 32).getTime();
  for (const l of [syncLine({ failed: true, lastSync: last, at }), syncLine({ failed: true, cards: 2, lastSync: last, at })]) {
    assert.doesNotMatch(l.main + l.sub, /fail/i);
  }
  /* And a failure with nothing waiting is not "up to date". */
  assert.equal(syncLine({ failed: true, lastSync: last, at }).main, "Nothing waiting to sync");
});

test("offline says the work is safe, then what is waiting and since when", () => {
  const last = new Date(2026, 10, 19, 9, 10).getTime();
  assert.deepEqual(syncLine({ offline: true, lastSync: last, cards: 4, at }), {
    main: "Offline — your work is saved on this device",
    sub: `4 cards to sync · last synced yesterday at ${hm(9, 10)}`,
  });
  assert.equal(syncLine({ offline: true, lastSync: last, at }).sub, `Last synced yesterday at ${hm(9, 10)}`);
});

test("syncing, and trying a space", () => {
  assert.equal(syncLine({ busy: true, lastSync: at - 1000, at }).main, "Syncing now");
  assert.equal(syncLine({ trying: true, cards: 9, at }).main, "Practice here stays on this device");
});

/* -------- counting -------- */

/** @param {string} id @param {number} updated @param {Record<string, unknown>} [states] */
const card = (id, updated, states = {}) =>
  /** @type {any} */ ({ id, kind: "word", ar: "x", en: "x", updated, s: states, forms: [] });

test("a change counts the cards it altered, added or removed, by content (0.663)", () => {
  const a = card("a", 100);
  const b = card("b", 100);
  const prev = /** @type {any} */ ({ items: [a, b, card("gone", 1)], settings: { x: 1 } });
  const next = /** @type {any} */ ({
    items: [
      a,
      /* Answered: a new state on it. */
      card("b", 100, { meaning: { updated: 200 } }),
      card("new", 300),
    ],
    settings: { x: 1 },
  });
  assert.deepEqual(changesBetween(prev, next).cards.sort(), ["b", "gone", "new"]);
  assert.equal(changesBetween(prev, next).other, false);
  /* Every card handed back as a fresh object with nothing changed is no change. */
  const copied = /** @type {any} */ ({ items: prev.items.map((/** @type {any} */ x) => ({ ...x })), settings: { x: 1 } });
  assert.deepEqual(changesBetween(prev, copied), { cards: [], other: false });
  /* A setting alone is a change that is not a card. */
  assert.deepEqual(changesBetween(prev, { ...prev, settings: { x: 2 } }), { cards: [], other: true });
});

test("what a trip carries is let go when it lands and waits again when it fails", () => {
  let p = pendingAdd(NO_PENDING, { cards: ["a", "b"], other: true });
  assert.deepEqual(pendingCount(p), { cards: 2, other: true });
  p = pendingSetOut(p);
  /* Changed again while the trip is out: still waiting after it lands. */
  p = pendingAdd(p, { cards: ["b", "c"], other: false });
  assert.deepEqual(pendingCount(p), { cards: 3, other: true }, "in flight still counts");
  const landed = pendingSent(p);
  assert.deepEqual(pendingCount(landed), { cards: 2, other: false }, "b and c, changed during the trip");
  const failed = pendingFailed(p);
  assert.deepEqual(pendingCount(failed), { cards: 3, other: true }, "nothing went up");
  assert.deepEqual(pendingCount(pendingSent(pendingSetOut(landed))), { cards: 0, other: false });
});

test("something waiting that is not a card is said, never Up to date (0.663)", () => {
  const last = new Date(2026, 10, 20, 14, 32).getTime();
  assert.equal(syncLine({ lastSync: last, other: true, at }).main, "Changes to sync");
  assert.equal(syncLine({ lastSync: last, other: true, cards: 2, at }).main, "2 cards to sync", "the count says it already");
  assert.equal(syncLine({ offline: true, lastSync: last, other: true, at }).sub, `Changes to sync · last synced today at ${hm(14, 32)}`);
});

/* -------- the bar -------- */

test("the bar can say Sync failed, and change its reason in place", () => {
  const id = holdReach({ title: "Sync failed", detail: "Your work is saved on this device.", retry: () => {} });
  assert.equal(reachState().title, "Sync failed");
  assert.equal(reachState().shown, true);
  dismissReach();
  updateReach(id, { detail: "Passphrase rejected" });
  /* A background failure again changes what it says, not whether it shows. */
  assert.equal(reachState().shown, false);
  assert.equal(reachState().detail, "Passphrase rejected");
  showReach();
  assert.equal(reachState().shown, true);
});
