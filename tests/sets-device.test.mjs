// @ts-check
/*
 * A personal set's answer on the device (0.630): a record in a picture's
 * progress that Reset scheduling keeps, and that the merge between two
 * devices keeps after a reset.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { buildOnce } from "./helpers.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const built = await buildOnce(["ArabicTrainer.tsx"]);
const T = await import(path.join(built, "ArabicTrainer.js"));
const syncDir = await buildOnce(["sync.ts"]);
const { mergeData, compactItem } = await import(path.join(syncDir, "sync.js"));
const S = await import(path.join(here, "..", "src", "sets.ts"));
const { freshStates } = await import(path.join(here, "..", "src", "scheduler.ts"));

const settings = { language: "ar-PS" };
const ANSWERED = 1000;
const RESET = 5000;
const st = { phase: "review", step: 0, ease: 2.5, interval: 3, due: 1, reps: 3, lapses: 0, right: 3, wrong: 0, skips: 0, near: 0, hints: 0, hist: [1, 1, 1], updated: ANSWERED };

const picture = () => ({
  id: "srvLan", tags: ["Our family"], created: 1, updated: ANSWERED, lang: "ar-PS", kind: "word",
  source: { courseId: "c", deckId: "dFamily", cardId: "Lan", rev: 1 },
  forms: [{ id: "srvLan", ar: "لان", en: "Lan", lat: "lan", lang: "ar-PS", images: ["f".repeat(64)], met: { x: 1 },
    s: { img2pick: st, [S.SET_KEY]: { updated: ANSWERED, meaning: "aunt", list: "dHanoi" } } }],
});

const reset = (/** @type {any} */ it) => ({ ...it, forms: it.forms.map((/** @type {any} */ f) => T.resetForm(f, RESET)), reset: RESET, updated: RESET });

test("Reset scheduling sends the schedules back and keeps the answer, stamped with the reset", () => {
  const f = reset(picture()).forms[0];
  assert.deepEqual(f.s[S.SET_KEY], { updated: RESET, meaning: "aunt", list: "dHanoi" });
  assert.equal(f.s.img2pick.phase, "new");
  assert.equal(f.met, undefined);
});

test("a form with no answer is reset exactly as before", () => {
  const plain = { ...picture().forms[0], s: { img2pick: st } };
  const f = T.resetForm(plain, RESET);
  assert.equal(S.SET_KEY in f.s, false);
  assert.deepEqual(f.s, freshStates());
});

test("after a reset, a merge with the other device's older copy keeps the answer", () => {
  const mine = { items: [reset(picture())], settings, tombstones: {}, log: {} };
  const theirs = { items: [picture()], settings, tombstones: {}, log: {} };
  const wire = (/** @type {any} */ d) => ({ ...d, items: d.items.map(compactItem) });
  for (const merged of [mergeData(wire(mine), wire(theirs), RESET + 1), mergeData(wire(theirs), wire(mine), RESET + 1)]) {
    const f = T.merge(merged).items[0].forms[0];
    assert.deepEqual(f.s[S.SET_KEY], { updated: RESET, meaning: "aunt", list: "dHanoi" });
    assert.equal(f.s.img2pick.phase, "new", "and the schedule stays reset");
  }
});
