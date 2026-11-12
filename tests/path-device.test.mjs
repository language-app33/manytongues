// @ts-check
/*
 * A course's path on the learner's device (0.613): which never-met cards a
 * session may bring in, what counts a unit as finished, and how the units
 * reached are kept across devices. The rules themselves are in
 * src/path.ts and tests/path.test.mjs; this is the trainer obeying them.
 *
 * The owner's rule (R22): a new word arrives as soon as any place it lives
 * is open. An ordinary deck is always open; a unit is open once reached in
 * any course. A never-met card is held only while every place it lives is
 * a unit the learner has not reached. Nothing else about a session changes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { must, buildOnce } from "./helpers.mjs";

let rolling = 20261111 >>> 0;
Math.random = () => {
  rolling = (Math.imul(rolling, 1664525) + 1013904223) >>> 0;
  return rolling / 4294967296;
};

const here = path.dirname(new URL(import.meta.url).pathname);
const built = await buildOnce(["ArabicTrainer.tsx"]);
const T = await import(path.join(built, "ArabicTrainer.js"));
const { buildSession, installIndexes, pathHolds, pathIndexNow, pathIndexOf, unitItems, everMet, unitStages, pathStateWord, stageWords } = T;
const { TYPES, LANGUAGES } = await import(path.join(here, "..", "src", "languages.ts"));
const { freshState } = await import(path.join(here, "..", "src", "scheduler.ts"));
const { mergeData } = await import(path.join(here, "..", "src", "sync.ts"));
const { mergeReached, reachesFurther } = await import(path.join(here, "..", "src", "path.ts"));
const { generate, fileIntoDecks, isRangeSkill, isNumeralCard } = await import(path.join(here, "..", "src", "numbers", "generate.ts"));
const { arComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.ts"));
const { arTimeComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.time.ts"));

/** @type {Record<string, any>} */
const settings = { language: "ar-PS" };
const DAY = 86400000;
const NOW = Date.now();

/** @param {Record<string, any>} over */
const state = (over) => ({ ...freshState(), ...over });
/** Up every level, its review a few days off: cleared, not due. */
const cleared = () => state({ phase: "review", interval: 4, due: NOW + 3 * DAY, reps: 2, right: 2, hist: [1, 1], updated: NOW - DAY });
/** Answered once, in learning, due now. */
const learning = () => state({ phase: "learning", interval: 0, due: NOW - 60000, reps: 1, right: 1, hist: [1], updated: NOW - DAY });

/**
 * A course word, from server card `k<i>`, with every question in the state
 * `s` makes, or new.
 * @param {number} i @param {(() => any) | null} [s]
 */
const word = (i, s = null) => ({
  id: `srvk${i}`, tags: ["Deck"], created: i, lang: "ar-PS", kind: "word",
  source: { courseId: "A", deckId: "u1", cardId: `k${i}`, rev: 1 },
  forms: [{ id: `srvk${i}`, ar: `كلمة${i}`, en: `word ${i}`, lat: `kalima${i}`, lang: "ar-PS",
    s: s ? Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, s()])) : {} }],
});

/** A path unit holding server cards. @param {string} id @param {number[]} cards */
const unit = (id, cards) => ({ id, unit: true, title: `Unit ${id}`, cardIds: cards.map((i) => `k${i}`) });
/** An ordinary deck. @param {string} id @param {number[]} cards */
const deck = (id, cards) => ({ id, title: `Deck ${id}`, cardIds: cards.map((i) => `k${i}`) });
/** A course whose path is these units, all published. @param {string} id @param {string[]} path @param {Record<string, any>} [over] */
const course = (id, path, over = {}) => ({
  id, decks: [...path], path, pathLive: Object.fromEntries(path.map((p) => [p, 1])), ...over,
});

/** The ids of the cards a regular session deals. @param {any[]} items @param {Record<string, any>} [o] */
const dealt = (items, o = {}) => {
  const got = buildSession({ items, settings: o.settings || settings, inDeck: () => true, budget: 60, ...o });
  return new Set(got.exercises.map((/** @type {any} */ e) => e.id));
};
/** @param {any[]} items @param {any[]} courses @param {any[]} decks @param {Record<string, any>} [s] */
const install = (items, courses, decks, s = settings) => installIndexes(items, s, [], { courses, decks });

test("two units and nothing practised: a session brings unit 1's new words only", () => {
  const items = [1, 2, 3, 4, 5, 6].map((i) => word(i));
  install(items, [course("A", ["u1", "u2"])], [unit("u1", [1, 2, 3]), unit("u2", [4, 5, 6])]);
  const ids = dealt(items);
  for (const i of [1, 2, 3]) assert.ok(ids.has(`srvk${i}`), `unit 1's word ${i} did not come`);
  for (const i of [4, 5, 6]) assert.ok(!ids.has(`srvk${i}`), `unit 2's word ${i} came before unit 2 opened`);
});

test("the home screen's count of new words is the session's, with a path", () => {
  const items = [1, 2, 3, 4, 5, 6].map((i) => word(i));
  install(items, [course("A", ["u1", "u2"])], [unit("u1", [1, 2, 3]), unit("u2", [4, 5, 6])]);
  /* The pool the home screen counts, built the way it builds it. */
  const counted = items.filter((it) => !pathHolds(it, settings) && !everMet(it, settings)).map((it) => it.id);
  const ids = dealt(items);
  assert.deepEqual(counted.sort(), [...ids].sort());
});

test("once unit 1's words are all cleared, unit 2's start to arrive", () => {
  const items = [word(1, cleared), word(2, cleared), word(3, cleared), word(4), word(5)];
  install(items, [course("A", ["u1", "u2"])], [unit("u1", [1, 2, 3]), unit("u2", [4, 5])]);
  const idx = pathIndexNow();
  assert.deepEqual(idx.rows.get("A").map((/** @type {any} */ r) => r.state), ["finished", "open"]);
  const ids = dealt(items);
  assert.ok(ids.has("srvk4") && ids.has("srvk5"));
  assert.deepEqual(idx.reached.A, ["u1", "u2"]);
});

test("a word also in an ordinary deck arrives straight away", () => {
  const items = [1, 2, 3].map((i) => word(i));
  install(items, [course("A", ["u1", "u2"])], [unit("u1", [1]), unit("u2", [2, 3]), deck("d", [3])]);
  const ids = dealt(items);
  assert.ok(ids.has("srvk3"), "the word in an ordinary deck was held");
  assert.ok(!ids.has("srvk2"));
});

test("a word in unit 1 and unit 3 arrives with unit 1, and when cleared counts toward finishing both", () => {
  const items = [word(1), word(2), word(3)];
  install(items, [course("A", ["u1", "u2", "u3"])], [unit("u1", [1]), unit("u2", [2]), unit("u3", [1, 3])]);
  assert.ok(dealt(items).has("srvk1"));
  const after = [word(1, cleared), word(2), word(3)];
  const idx = pathIndexOf(after, [course("A", ["u1", "u2", "u3"])], [unit("u1", [1]), unit("u2", [2]), unit("u3", [1, 3])], settings);
  assert.equal(idx.finished.get("u1"), true);
  /* Unit 3 holds it too, and with word 3 cleared as well it is finished. */
  install(after, [course("A", ["u1", "u2", "u3"])], [unit("u1", [1]), unit("u2", [2]), unit("u3", [1, 3])]);
  assert.deepEqual(unitItems("u3", after).map((/** @type {any} */ it) => it.id).sort(), ["srvk1", "srvk3"]);
  const three = [word(1, cleared), word(2), word(3, cleared)];
  assert.equal(pathIndexOf(three, [course("A", ["u1", "u2", "u3"])], [unit("u1", [1]), unit("u2", [2]), unit("u3", [1, 3])], settings).finished.get("u3"), true);
});

test("a word of a locked unit already met still comes back; holding is for never-met words", () => {
  const items = [word(1), word(2, learning)];
  install(items, [course("A", ["u1", "u2"])], [unit("u1", [1]), unit("u2", [2])]);
  assert.equal(pathHolds(items[1], settings), false);
  assert.ok(dealt(items).has("srvk2"));
});

test("Practise this unit on a unit opened early brings its new words", () => {
  const items = [1, 2, 3].map((i) => word(i));
  install(items, [course("A", ["u1", "u2"], { opened: ["u2"] })], [unit("u1", [1]), unit("u2", [2, 3])]);
  const row = pathIndexNow().rows.get("A")[1];
  assert.equal(row.openedEarly, true);
  assert.ok(!dealt(items).has("srvk2"), "an ordinary session brings the opened unit's words");
  const ids = dealt(items, { pathUnit: "u2", inDeck: (/** @type {any} */ it) => ["srvk2", "srvk3"].includes(it.id) });
  assert.ok(ids.has("srvk2") && ids.has("srvk3"));
});

test("a unit locked in one course and open in another is not held", () => {
  const items = [1, 2].map((i) => word(i));
  install(items, [course("A", ["u1", "shared"]), course("B", ["shared"])], [unit("u1", [1]), unit("shared", [2])]);
  assert.equal(pathHolds(items[1], settings), false);
  assert.ok(dealt(items).has("srvk2"));
});

test("a learner with no path units is dealt exactly as before", () => {
  const items = [1, 2, 3].map((i) => word(i));
  install(items, [{ id: "A", decks: ["d"] }], [deck("d", [1, 2, 3])]);
  assert.equal(pathIndexNow().unitIds.size, 0);
  assert.ok(items.every((it) => !pathHolds(it, settings)));
});

/* ---- word sets: a unit that holds a number part (R37) ---- */

const load = (/** @type {string} */ name) => JSON.parse(readFileSync(new URL(`./golden/${name}`, import.meta.url), "utf8"));
const SYS = load("ar-PS.numbers.json").system;
const TIME = load("ar-PS.times.json").system;
const SET = { composer: arComposer, sys: SYS, timeComposer: arTimeComposer, timeSys: TIME };
const generated = generate({ ...SET, now: 1750000000000, numerals: LANGUAGES["ar-PS"].numerals });

test("numbers filed with no deck id come out exactly as before", () => {
  const parts = ["numbers:0-9"];
  const old = fileIntoDecks(generated.items, SET, [{ title: "Numbers", parts }]);
  assert.ok(old.length > 0);
  assert.ok(old.every((/** @type {any} */ it) => !("deckIds" in it)));
  const withId = fileIntoDecks(generated.items, SET, [{ id: "dn", title: "Numbers", parts }]);
  assert.deepEqual(withId.map((/** @type {any} */ it) => it.tags), old.map((/** @type {any} */ it) => it.tags));
  assert.ok(withId.every((/** @type {any} */ it) => it.deckIds && it.deckIds.includes("dn")));
});

test("a unit that holds 0 to 9 holds back its skill, its words and the figures until it opens", () => {
  const nums = fileIntoDecks(generated.items, SET, [{ id: "u2", title: "Unit u2", parts: ["numbers:0-9"] }]);
  const skill = must(nums.find((/** @type {any} */ it) => isRangeSkill(it) && it.range.id === "numbers:0-9"), "0 to 9");
  const figure = must(nums.find((/** @type {any} */ it) => isNumeralCard(it)), "a figure");
  const words = nums.filter((/** @type {any} */ it) => !isRangeSkill(it) && !isNumeralCard(it));
  assert.ok(words.length > 0);
  const items = [word(1), ...nums];
  install(items, [course("A", ["u1", "u2"])], [unit("u1", [1]), { id: "u2", unit: true, title: "Unit u2", cardIds: [], parts: ["numbers:0-9"] }]);
  for (const it of [skill, figure, ...words]) assert.equal(pathHolds(it, settings), true, `${it.id} was not held`);
  assert.equal(unitItems("u2", items).length, nums.length);
  /* Unit 1 cleared: unit 2 opens, and they arrive. */
  const later = [word(1, cleared), ...nums];
  install(later, [course("A", ["u1", "u2"])], [unit("u1", [1]), { id: "u2", unit: true, title: "Unit u2", cardIds: [], parts: ["numbers:0-9"] }]);
  for (const it of [skill, figure, ...words]) assert.equal(pathHolds(it, settings), false, `${it.id} was still held`);
  /* And unit 2 is not finished while they are not cleared. */
  assert.equal(pathIndexNow().finished.get("u2"), false);
});

test("the same part held by a locked unit and an ordinary deck arrives straight away", () => {
  const nums = fileIntoDecks(generated.items, SET, [
    { id: "u2", title: "Unit u2", parts: ["numbers:0-9"] },
    { id: "d", title: "Numbers", parts: ["numbers:0-9"] },
  ]);
  const items = [word(1), ...nums];
  install(items, [course("A", ["u1", "u2"])], [unit("u1", [1]), { id: "u2", unit: true, title: "Unit u2", cardIds: [] }, { id: "d", title: "Numbers", cardIds: [] }]);
  assert.ok(nums.every((/** @type {any} */ it) => !pathHolds(it, settings)));
});

/* ---- the units reached, kept across devices ---- */

/** @param {Record<string, any>} settings @param {number} updated */
const doc = (settings, updated) => ({ items: [], tombstones: {}, log: {}, settings, settingsUpdated: updated });

test("sync keeps the union of the units reached, and the newer of everything else", () => {
  const local = doc({ language: "ar-PS", prep: { name: "old" }, pathReached: { A: ["1", "2", "3"] } }, 100);
  const remote = doc({ language: "ar-PS", prep: { name: "new" }, pathReached: { A: ["1"] } }, 200);
  const merged = mergeData(local, remote, NOW);
  assert.deepEqual(merged.settings.pathReached, { A: ["1", "2", "3"] });
  assert.deepEqual(merged.settings.prep, { name: "new" }, "prep is still last-writer-wins");
  /* And the other way round. */
  const back = mergeData(remote, local, NOW);
  assert.deepEqual(back.settings.pathReached.A.slice().sort(), ["1", "2", "3"]);
});

test("a document with no path merges its settings exactly as before", () => {
  const local = doc({ language: "ar-PS", theme: "dark" }, 100);
  const remote = doc({ language: "ar-PS", theme: "light" }, 200);
  const merged = mergeData(local, remote, NOW);
  assert.deepEqual(merged.settings, { language: "ar-PS", theme: "light" });
  assert.ok(!("pathReached" in merged.settings));
});

test("after the merge, a unit that has slipped back stays reached and its followers stay open", () => {
  const items = [word(1), word(2), word(3), word(4)];
  const stored = mergeData(doc({ pathReached: { A: ["u1", "u2", "u3"] } }, 1), doc({ pathReached: { A: ["u1"] } }, 2), NOW).settings;
  const idx = pathIndexOf(items, [course("A", ["u1", "u2", "u3", "u4"])], [unit("u1", [1]), unit("u2", [2]), unit("u3", [3]), unit("u4", [4])], { ...settings, ...stored });
  assert.deepEqual(idx.rows.get("A").map((/** @type {any} */ r) => r.state), ["open", "open", "open", "locked"]);
});

test("remembering what was reached is written once: the next build finds nothing new", () => {
  const items = [word(1, cleared), word(2)];
  const courses = [course("A", ["u1", "u2"])];
  const decks = [unit("u1", [1]), unit("u2", [2])];
  const first = pathIndexOf(items, courses, decks, settings);
  assert.equal(reachesFurther(settings.pathReached, first.reached), true, "there is something to write the first time");
  const written = { ...settings, pathReached: mergeReached(undefined, first.reached) };
  const second = pathIndexOf(items, courses, decks, written);
  assert.equal(reachesFurther(written.pathReached, second.reached), false, "and nothing the second");
});

/* ---- phase 5: what a learner is shown of a unit ---- */

/** A sentence card from server card `k<i>`. @param {number} i @param {(() => any) | null} [s] */
const sentence = (i, s = null) => ({ ...word(i, s), kind: "phrase", sentence: true,
  forms: [{ ...word(i, s).forms[0], ar: `جملة رقم ${i} هون`, en: `sentence ${i} here` }] });
/** A text from server card `k<i>`. @param {number} i */
const text = (i) => ({
  id: `srvk${i}`, tags: ["Deck"], created: i, lang: "ar-PS", sceneKind: "text", speakers: [],
  source: { courseId: "A", deckId: "u1", cardId: `k${i}`, rev: 1 },
  forms: [{ id: `srvk${i}`, ar: "", en: `text ${i}` }],
  lines: [{ id: `srvk${i}-l1`, ar: "الكتاب كبير كتير", en: "the book is very big", lat: "il-ktaab kbiir ktiir", s: {} },
    { id: `srvk${i}-l2`, ar: "البيت صغير", en: "the house is small", lat: "il-beet zghiir", s: {} }],
});

test("a unit's stages: words, sentences and its text, counted as cleared of all", () => {
  const items = [
    ...[1, 2, 3, 4].map((i) => word(i, cleared)), word(5), word(6),
    sentence(11, cleared), ...[12, 13, 14, 15].map((i) => sentence(i)),
    text(20),
  ];
  install(items, [course("A", ["u1"])], [unit("u1", [1, 2, 3, 4, 5, 6, 11, 12, 13, 14, 15, 20])]);
  const st = unitStages("u1", items, settings);
  assert.deepEqual(st.words, { done: 4, all: 6 });
  assert.deepEqual(st.sentences, { done: 1, all: 5 });
  assert.deepEqual(st.final, { kind: "text", done: false });
  assert.equal(st.learnt, false);
  assert.deepEqual(stageWords(st), ["Words 4/6", "Sentences 1/5", "Text: not yet"]);
});

test("a card in two units counts in both; one that can never be asked counts in neither", () => {
  const never = { ...word(9), drill: false, forms: [{ ...word(9).forms[0], ask: false }] };
  const items = [word(1, cleared), word(2), never];
  install(items, [course("A", ["u1", "u2"])], [unit("u1", [1, 9]), unit("u2", [1, 2, 9])]);
  assert.deepEqual(unitStages("u1", items, settings).words, { done: 1, all: 1 });
  assert.deepEqual(unitStages("u2", items, settings).words, { done: 1, all: 2 });
});

test("a unit holding 0 to 9 counts the part's skill and words under Words, and is not finished till they are cleared", () => {
  const nums = fileIntoDecks(generated.items, SET, [{ id: "u1", title: "Unit u1", parts: ["numbers:0-9"] }]);
  const items = [word(1, cleared), ...nums];
  install(items, [course("A", ["u1", "u2"])], [{ ...unit("u1", [1]), parts: ["numbers:0-9"] }, unit("u2", [])]);
  const st = unitStages("u1", items, settings);
  assert.ok(st.words.all > 1, `only ${st.words.all} under Words`);
  assert.ok(st.words.done < st.words.all);
  assert.equal(pathIndexNow().finished.get("u1"), false);
});

test("each unit's row says where it stands in the owner's words", () => {
  const row = (/** @type {Record<string, any>} */ o) => ({ id: "u", number: 1, state: "open", openedEarly: false, current: false, ...o });
  assert.equal(pathStateWord(row({ state: "finished" })), "Finished");
  assert.equal(pathStateWord(row({ current: true })), "Current");
  assert.equal(pathStateWord(row({ state: "locked" })), "Locked");
  assert.equal(pathStateWord(row({ state: "locked", openedEarly: true })), "Opened by your teacher");
});

