// @ts-check
/*
 * Progress on an exercise this version does not know (0.626).
 *
 * A later release adds exercises, and each records progress under its own
 * key on a form. A device still on this release receives those records
 * through sync. It must carry them untouched — on load, after a sync, on a
 * restore — and read past them: nothing it shows or asks may change
 * because they are there, and nothing may throw.
 *
 * Before 0.626 the load rebuilt each form's progress from the types this
 * release knows and dropped every other key, so a device that replaced
 * the server's copy took the newer release's work with it.
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
const sharedDir = await buildOnce(["shared.tsx"]);
const { foldCourses, progressOf } = await import(path.join(sharedDir, "shared.js"));
const { checkAnswer, exOf, levelOf, TYPES } = await import(path.join(here, "..", "src", "languages.ts"));
const tense = await import(path.join(here, "..", "src", "tense-skills.ts"));

const settings = { language: "ar-PS" };
const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 14, 9);

/** A state answered `n` times, the last `ok`. */
const st = (/** @type {number} */ n, ok = true, due = NOW - DAY) => ({
  phase: "review", step: 0, ease: 2.5, interval: 3, due, reps: n, lapses: ok ? 0 : 1,
  right: ok ? n : n - 1, wrong: ok ? 0 : 1, skips: 0, near: 0, hints: 0,
  hist: Array.from({ length: n }, (_, i) => (i === n - 1 ? ok : true)), updated: NOW - 2 * DAY,
});

/* What a later release might have written: a new exercise, one of its
   accepted-answer keys, and a missed one that would read as weak. */
const FUTURE = {
  zzfuture: st(3),
  "zzfuture@1": st(2),
  zzmissed: { ...st(4, false), hist: [true, true, false, false] },
};

/** @param {number} i @param {Record<string, any>} s */
const word = (i, s) => ({
  id: `w${i}`, tags: ["Lesson"], created: 1, updated: 1, lang: "ar-PS", kind: "word",
  forms: [{ id: `w${i}`, ar: `كلمة${i}`, en: `word ${i}`, lat: `kalima${i}`, lang: "ar-PS", s }],
});

/* Cards in every state: never answered, climbing, cleared, learnt, weak. */
const known = (/** @type {number} */ i) =>
  [
    {},
    { ar2pick: st(1), ar2en: st(2) },
    { ar2pick: st(2), ar2en: st(2), en2pick: st(2), match: st(2), tr2ar: st(2), en2ar: st(2) },
    { ar2pick: st(4), ar2en: st(4), en2pick: st(4), match: st(4), tr2ar: st(4), en2ar: st(6) },
    { ar2pick: st(2), ar2en: { ...st(3, false), hist: [true, false, false] } },
  ][i % 5];

const plain = () => Array.from({ length: 30 }, (_, i) => word(i, known(i)));
const withFuture = () => Array.from({ length: 30 }, (_, i) => word(i, { ...known(i), ...FUTURE }));

/** Runs `fn` at NOW with a fixed dice. */
function fixed(/** @type {() => any} */ fn) {
  const wall = Date.now;
  const dice = Math.random;
  let a = 7;
  Date.now = () => NOW;
  Math.random = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  try {
    return fn();
  } finally {
    Date.now = wall;
    Math.random = dice;
  }
}

/** The document as the app holds it after a load. */
const loaded = (/** @type {any[]} */ items) => T.merge({ items, settings, tombstones: {}, log: {} });

test("a load carries a record for an exercise it does not know, untouched", () => {
  const doc = loaded(withFuture());
  const f = doc.items[1].forms[0];
  assert.deepEqual(f.s.zzfuture, FUTURE.zzfuture);
  assert.deepEqual(f.s["zzfuture@1"], FUTURE["zzfuture@1"]);
  assert.deepEqual(f.s.zzmissed, FUTURE.zzmissed);
});

test("and a record for a retired exercise, which it knows of but no longer asks", () => {
  const retired = { phase: "review", reps: 2, updated: 5, hist: [true, true] };
  const doc = loaded([word(1, { ar2tr: retired })]);
  assert.deepEqual(doc.items[0].forms[0].s.ar2tr, retired);
});

test("the oldest shape is still lifted, and not kept beside its new name", () => {
  const doc = loaded([word(1, { mean: { box: 2, due: 5, right: 3 } })]);
  const s = doc.items[0].forms[0].s;
  assert.equal(s.ar2en.right, 3);
  assert.equal("mean" in s, false);
});

test("loading twice is loading once", () => {
  const once = loaded(withFuture());
  const twice = loaded(once.items);
  assert.deepEqual(twice.items, once.items);
});

test("nothing the app shows of a card changes because the record is there", () => {
  const a = loaded(plain()).items;
  const b = loaded(withFuture()).items;
  T.installIndexes(a, settings);
  const standA = fixed(() => a.map((/** @type {any} */ it) => T.cardStandings(it, settings, a)));
  const reviewA = fixed(() => a.map((/** @type {any} */ it) => T.nextReviewAt(it, settings)));
  const weakA = fixed(() => a.map((/** @type {any} */ it) => T.isWeak(it, settings)));
  const loadA = fixed(() => T.workloadOf(a, settings, NOW));
  const climbA = fixed(() => T.climbOf(a, settings, a));
  const ladderA = a.map((/** @type {any} */ it) => T.laddered(it.forms[0], settings));
  T.installIndexes(b, settings);
  assert.deepEqual(fixed(() => b.map((/** @type {any} */ it) => T.cardStandings(it, settings, b))), standA, "standings");
  assert.deepEqual(fixed(() => b.map((/** @type {any} */ it) => T.nextReviewAt(it, settings))), reviewA, "next review");
  assert.deepEqual(fixed(() => b.map((/** @type {any} */ it) => T.isWeak(it, settings))), weakA, "weak spots");
  assert.deepEqual(fixed(() => T.workloadOf(b, settings, NOW)), loadA, "the workload");
  assert.deepEqual(fixed(() => T.climbOf(b, settings, b)), climbA, "the climb");
  assert.deepEqual(b.map((/** @type {any} */ it) => T.laddered(it.forms[0], settings)), ladderA, "the keys climbed with");
});

test("nothing is asked about it, and the sessions dealt are the ones dealt without it", () => {
  const types = (/** @type {any} */ built) => (built.exercises || []).map((/** @type {any} */ e) => `${e.id}:${e.type}`);
  const a = loaded(plain()).items;
  T.installIndexes(a, settings);
  const regular = fixed(() => T.buildSession({ items: a, settings, inDeck: () => true }));
  const weak = fixed(() => T.buildWeakSession({ items: a, settings, inDeck: () => true }));
  const b = loaded(withFuture()).items;
  T.installIndexes(b, settings);
  const regularB = fixed(() => T.buildSession({ items: b, settings, inDeck: () => true }));
  const weakB = fixed(() => T.buildWeakSession({ items: b, settings, inDeck: () => true }));
  assert.ok(types(regular).length > 0 && types(weak).length > 0, "sessions were dealt at all");
  assert.deepEqual(types(regularB), types(regular));
  assert.deepEqual(types(weakB), types(weak));
  for (const e of [...(regularB.exercises || []), ...(weakB.exercises || [])]) {
    assert.ok(TYPES.includes(String(e.type).split("@")[0]), `asked ${e.type}`);
  }
});

test("the record survives a sync, both ways, and a course refresh", () => {
  const mine = loaded(withFuture());
  const wire = { ...mine, items: mine.items.map(compactItem) };
  const theirs = loaded([]);
  const pulled = loaded(mergeData(theirs, wire, NOW).items);
  assert.deepEqual(pulled.items[2].forms[0].s.zzfuture, FUTURE.zzfuture, "a device that had nothing gets it");
  const pushed = mergeData(loaded(plain()), { ...pulled, items: pulled.items.map(compactItem) }, NOW);
  assert.deepEqual(pushed.items[2].forms[0].s.zzmissed, FUTURE.zzmissed, "and one that had older work keeps it");
  const course = pushed.items.map((/** @type {any} */ it) => ({ ...it, source: { cardId: it.id } }));
  const fresh = course.map((/** @type {any} */ it) => ({ ...it, forms: it.forms.map((/** @type {any} */ f) => ({ ...f, s: {} })) }));
  const folded = foldCourses(course, fresh, {});
  assert.deepEqual(folded.items[2].forms[0].s.zzfuture, FUTURE.zzfuture, "a refresh keeps it");
  const away = foldCourses(course, [], {});
  assert.deepEqual(away.parked.w2.forms.w2.s["zzfuture@1"], FUTURE["zzfuture@1"], "and the drawer keeps it");
  assert.deepEqual(progressOf(course[2]).forms.w2.s.zzfuture, FUTURE.zzfuture);
});

test("a lookup of an exercise by a name it does not know answers nothing rather than throwing", () => {
  const form = { id: "w1", ar: "كلمة", en: "word", lat: "kalima", lang: "ar-PS" };
  assert.equal(exOf("zzfuture"), null);
  assert.equal(levelOf("zzfuture"), 1);
  const r = checkAnswer("word", form, "zzfuture", settings);
  assert.equal(r.ok, false);
  assert.doesNotThrow(() => T.weakness(FUTURE.zzmissed));
});

test("a verb's persons read past it", () => {
  const cell = { id: "c", ar: "", en: "", s: { zzmissed: FUTURE.zzmissed } };
  assert.equal(tense.shaky(cell), false, "a miss on an unknown exercise is not a weak person");
  assert.equal(tense.rightAt({ id: "c", ar: "", en: "", s: { zzfuture: FUTURE.zzfuture } }, 1), false);
});
