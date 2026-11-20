// @ts-check
/*
 * The You menu's sync line (0.654): when the last sync was and what is
 * waiting for the next, instead of "Sync failed" — which is now the bar at
 * the foot of the app, with Retry.
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const { syncLine, syncedWhen, cardsToSync, clipsToSync, latestStamp } = await import("../src/sync.ts");
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

test("a card counts once it has changed since the sync, by any of its stamps", () => {
  const doc = /** @type {any} */ ({
    items: [
      card("a", 100),
      card("b", 300),
      /* Answered after the sync: only the exercise state says so. */
      card("c", 100, { meaning: { updated: 400 } }),
      { ...card("d", 100), priorityAt: 350 },
    ],
    tombstones: { gone: 500, old: 50 },
  });
  assert.equal(cardsToSync(doc, 200), 4, "b, c, d and the card removed since");
  assert.equal(cardsToSync(doc, 0), 6, "never synced: everything");
  assert.equal(cardsToSync(doc, latestStamp(doc)), 0);
  assert.equal(latestStamp(doc), 500);
});

test("a recording counts if it is here, named by a card, and not yet sent", () => {
  const doc = /** @type {any} */ ({
    items: [{ ...card("a", 1), recs: [{ id: "r1" }, { id: "r2" }, { id: "r3" }] }],
  });
  assert.equal(clipsToSync(doc, new Set(["r1", "r2", "elsewhere"]), ["r1"]), 1);
  assert.equal(clipsToSync(doc, null, []), 0, "not looked yet: nothing claimed");
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
