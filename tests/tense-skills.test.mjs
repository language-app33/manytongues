// @ts-check
/*
 * A verb's tense, learnt as one thing.
 *
 * Where a language offers the practices of a tense as a whole — Arabic,
 * Hebrew — every tense the teacher has filled in is a skill: one schedule,
 * one ladder, and a person drawn for every question. What is held to
 * here is the whole of what the owner chose:
 *
 *   * each filled tense is made once, and starts where most of its persons
 *     are (3a); the persons keep their own progress (10a);
 *   * the persons and the verb's own word are no longer dealt; the past
 *     "he" is one person of the past like any other (5b);
 *   * a level of a tense opens on two right answers running and once every
 *     person has been answered right on the level below (4b) — two persons
 *     spelt the same counting as one (18a), and "I get it" counting for
 *     nobody (17c);
 *   * a person who keeps going wrong is asked first (2a);
 *   * an answer marks the tense and the person; a question about the whole
 *     tense marks the tense once and each person on their own;
 *   * a tense opens once the one before it is cleared;
 *   * each filled tense counts as a card of its own on Progress (8b);
 *   * Vietnamese's verbs, whose language offers no practices, are left as they are
 *     (11a).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import path from "node:path";
import { must } from "./helpers.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".tense-skills-build");
const bundle = async (/** @type {string} */ name, /** @type {string} */ file) => {
  await build({
    entryPoints: [path.join(here, "..", "src", file)],
    outfile: path.join(out, `${name}.js`),
    bundle: true,
    format: "esm",
    jsx: "automatic",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".jsx": "jsx" },
    logLevel: "silent",
    define: {
      "process.env.NODE_ENV": '"development"',
      __APP_RELEASE__: '"0"',
      __APP_VERSION__: '"test"',
      __BUILT_AT__: '"0"',
    },
  });
  return import(path.join(out, `${name}.js`));
};
const T = await bundle("trainer", "ArabicTrainer.tsx");
const { foldCourses } = await bundle("shared", "shared.tsx");
const { mergeData } = await import("../src/sync.ts");
const { LANGUAGES, verbOf } = await import("../src/languages.ts");
const { gradeInto } = await import("../src/grade.ts");
const skills = await import("../src/tense-skills.ts");
const { capOf, drawPerson, middleState, tenseIdOf, withTenses } = skills;
const { tenseOf } = await import("../src/verb-drills.ts");
const { EXAMPLE_TYPES } = await import("../src/offers.ts");

const AR = LANGUAGES["ar-PS"];
const HE = LANGUAGES["he-IL"];
const VI = LANGUAGES["vi"];
const settings = { language: "ar-PS" };

/** @param {number[]} hist @returns {any} */
const st = (hist, more = {}) => ({
  phase: hist.length >= 2 && hist.slice(-2).every(Boolean) ? "review" : hist.length ? "learning" : "new",
  step: 0, ease: 2.5, interval: hist.length >= 2 && hist.slice(-2).every(Boolean) ? 1 : 0, due: 0,
  reps: hist.length, lapses: 0, right: hist.filter(Boolean).length, wrong: hist.filter((x) => !x).length,
  skips: 0, near: 0, hints: 0, hist, passes: 0, updated: 1, ...more,
});

/** @param {string} id @param {string} ar @param {string} en @param {string} lat @param {string} row @param {string} col @returns {any} */
const cell = (id, ar, en, lat, row, col) => ({ id, ar, en, lat, lang: "ar-PS", row, col, s: {} });

/* To write, in the present and the past, with the command left blank.
   بتكتب is "you (m)" and "she". */
const verb = () => /** @type {any} */ ({
  id: "v1", tags: ["Verbs"], created: 1, lang: "ar-PS", kind: "word", category: "verb", name: "to write",
  forms: [
    { id: "v1", ar: "كتب", en: "he wrote", lat: "katab", lang: "ar-PS", s: {} },
    cell("p-i", "بكتب", "I write", "baktub", "present", "i"),
    cell("p-youm", "بتكتب", "you (m) write", "btiktub", "present", "you-m"),
    cell("p-youf", "بتكتبي", "you (f) write", "btiktbi", "present", "you-f"),
    cell("p-he", "بيكتب", "he writes", "biktub", "present", "he"),
    cell("p-she", "بتكتب", "she writes", "btiktub", "present", "she"),
    cell("p-they", "بيكتبوا", "they write", "biktbu", "present", "they"),
    cell("x-he", "كتب", "he wrote", "katab", "past", "he"),
    cell("x-she", "كتبت", "she wrote", "katabat", "past", "she"),
  ],
});
const formOf = (/** @type {any} */ card, /** @type {string} */ id) => must(card.forms.find((/** @type {any} */ f) => f.id === id), id);
const PRESENT = tenseIdOf("v1", "present");
const PAST = tenseIdOf("v1", "past");

/** Plain words, so a session has more than the verb to deal. */
const words = (/** @type {number} */ n) =>
  Array.from({ length: n }, (_, i) => /** @type {any} */ ({
    id: `w${i + 1}`, tags: [], created: i + 2, lang: "ar-PS", kind: "word",
    forms: [{ id: `w${i + 1}`, ar: `كلمة${i + 1}`, en: `word ${i + 1}`, lat: `kilma${i + 1}`, lang: "ar-PS", s: {} }],
  }));

/* ---- made, and seeded ---- */

test("each tense the teacher filled in is made once, and a blank one is not", () => {
  const v = withTenses(verb(), AR);
  const tenses = v.forms.filter((/** @type {any} */ f) => f.tense);
  assert.deepEqual(tenses.map((/** @type {any} */ f) => f.id), [PRESENT, PAST]);
  assert.ok(tenses.every((/** @type {any} */ f) => f.ar === "" && f.en === "" && f.lat === ""), "a tense carries no words");
  assert.equal(withTenses(v, AR), v, "made once: the same card back");
});

test("Hebrew's tenses are skills too; Vietnamese's verbs are left as they are", () => {
  const he = verb();
  he.lang = "he-IL";
  assert.ok(withTenses(he, HE).forms.some((/** @type {any} */ f) => f.tense), "Hebrew");
  const hue = { ...verb(), lang: "vi" };
  assert.equal(withTenses(hue, VI), hue, "Vietnamese");
});

test("a tense starts where most of its persons are, and the persons keep theirs", () => {
  const v = verb();
  const solid = st([1, 1]);
  /* Four of six persons past "what it means": the middle of them is too. */
  for (const id of ["p-i", "p-youm", "p-he", "p-she"]) formOf(v, id).s = { ar2en: solid };
  /* Two of six past "write it from its meaning": the middle is not. */
  for (const id of ["p-i", "p-he"]) formOf(v, id).s.en2ar = solid;
  const lifted = withTenses(v, AR);
  const present = formOf(lifted, PRESENT);
  assert.deepEqual(present.s.ar2en.hist, [1, 1], "seeded from the middle");
  assert.equal(present.s.en2ar, undefined, "the middle never wrote it");
  assert.deepEqual(formOf(lifted, "p-i").s.ar2en.hist, [1, 1], "the person keeps its own");
  assert.equal(middleState([null, null, solid]), null, "two of three never asked: the middle is the bottom");
});

/* ---- what is dealt ---- */

test("the persons and the verb's own word are no longer dealt; the tense is", () => {
  const v = withTenses(verb(), AR);
  installIndexes([v]);
  for (const id of ["v1", "p-i", "p-she", "x-he"]) assert.deepEqual(T.laddered(formOf(v, id), settings), [], id);
  const keys = T.laddered(formOf(v, PRESENT), settings);
  for (const t of ["vpattern", "vread", "vwho", "vrow", "vshift", "ar2en", "en2ar"]) assert.ok(keys.includes(t), t);
});

test("the past 'he' is one person of the past, asked the tense's practices", () => {
  const v = withTenses(verb(), AR);
  /* The present cleared, and every person of it answered right on every
     level, so the past is open. */
  for (const f of v.forms) if (f.row === "present") f.s = Object.fromEntries(["ar2pick", "ar2en", "en2pick", "tr2ar", "en2ar", "vread", "vwho", "vrow", "vshift"].map((k) => [k, st([1, 1])]));
  const present = formOf(v, PRESENT);
  installIndexes([v]);
  present.s = Object.fromEntries(T.laddered(present, settings).map((/** @type {string} */ k) => [k, st([1, 1])]));
  installIndexes([v]);
  const past = T.laddered(formOf(v, PAST), settings);
  assert.ok(past.includes("vwho"), "two persons of the past to tell apart");
  const tense = must(tenseOf(v, verbOf(AR), "past"), "the past");
  assert.ok(tense.places.some((/** @type {any} */ p) => p.form.id === "x-he"), "the cited cell is in it");
});

test("a session asks the tense, each question of a person, the table first", () => {
  const v = withTenses(verb(), AR);
  const items = [v].concat(words(8));
  installIndexes(items);
  const asked = T.buildSession({ items, settings, inDeck: () => true }).exercises.filter((/** @type {any} */ e) => e.id === "v1");
  assert.ok(asked.length > 0, "the verb is dealt");
  assert.ok(asked.every((/** @type {any} */ e) => e.subId === PRESENT), `only the present: ${asked.map((/** @type {any} */ e) => e.subId)}`);
  assert.ok(asked.every((/** @type {any} */ e) => typeof e.person === "string" && e.person.startsWith("p-")), "each about a person of it");
  assert.equal(asked[0].type, "vpattern");
});

test("a question about a tense is shown as the person drawn", () => {
  const v = withTenses(verb(), AR);
  installIndexes([v]);
  const r = must(T.resolveQuestion([v], { id: "v1", subId: PRESENT, type: "ar2en", person: "p-he" }, false, []), "resolved");
  assert.equal(r.unit.id, "p-he");
  assert.equal(r.unit.ar, "بيكتب");
});

/* ---- whom ---- */

test("whoever has gone wrong on the question is asked first, then whoever is not yet right on its level", () => {
  const v = verb();
  const tense = must(tenseOf(v, verbOf(AR), "present"), "the present");
  const all = () => true;
  formOf(v, "p-they").s = { ar2en: st([1, 0]) };
  assert.equal(must(drawPerson(tense, "ar2en", all, "s", AR), "drawn").form.id, "p-they", "the miss comes back");
  formOf(v, "p-they").s = {};
  for (const id of ["p-i", "p-youm", "p-youf", "p-he", "p-they"]) formOf(v, id).s = { ar2en: st([1]) };
  /* بتكتب is answered right as "you (m)", which counts for "she" too. */
  const drawn = must(drawPerson(tense, "ar2en", all, "s", AR), "drawn");
  assert.ok(["p-i", "p-youm", "p-youf", "p-he", "p-she", "p-they"].includes(drawn.form.id));
  formOf(v, "p-youm").s = {};
  assert.equal(must(drawPerson(tense, "ar2en", all, "s", AR), "drawn").form.ar, "بتكتب", "the one not yet right");
  const taken = new Set(["p-youm", "p-she"]);
  assert.ok(!taken.has(must(drawPerson(tense, "ar2en", all, "s", AR, taken), "drawn").form.id), "not twice in a sitting");
});

/* ---- every person, on every level ---- */

test("a tense is held on a level until every person is answered right there", () => {
  const v = verb();
  const tense = must(tenseOf(v, verbOf(AR), "present"), "the present");
  const supports = () => ["ar2en", "en2ar"];
  const keys = ["ar2en", "en2ar"];
  assert.equal(capOf(tense, keys, supports, AR), 1, "nobody answered");
  for (const id of ["p-i", "p-youm", "p-youf", "p-he", "p-they"]) formOf(v, id).s = { ar2en: st([1]) };
  assert.equal(capOf(tense, keys, supports, AR), 4, "she counts through you (m), spelt the same; level 4 next");
  for (const f of v.forms) if (f.row === "present") f.s = { ...f.s, en2ar: st([1]) };
  assert.equal(capOf(tense, keys, supports, AR), null, "every person, every level");
});

test("'I get it' counts for nobody", () => {
  const v = verb();
  const tense = must(tenseOf(v, verbOf(AR), "present"), "the present");
  for (const f of v.forms) if (f.row === "present") f.s = { vpattern: st([1]) };
  assert.equal(capOf(tense, ["vpattern", "ar2en"], () => ["vpattern", "ar2en"], AR), 1);
});

test("the past opens only once the present is cleared, every person included", () => {
  const v = withTenses(verb(), AR);
  installIndexes([v]);
  const present = formOf(v, PRESENT);
  const keys = T.laddered(present, settings);
  present.s = Object.fromEntries(keys.map((/** @type {string} */ k) => [k, st([1, 1])]));
  installIndexes([v]);
  assert.deepEqual(T.laddered(formOf(v, PAST), settings), [], "the present is up its ladder, and nobody answered");
  for (const f of v.forms) if (f.row === "present") f.s = Object.fromEntries(keys.map((/** @type {string} */ k) => [k, st([1])]));
  installIndexes([v]);
  assert.ok(T.laddered(formOf(v, PAST), settings).length > 0, "every person right on every level");
});

/* ---- what an answer marks ---- */

test("an answer marks the tense and the person", () => {
  const v = withTenses(verb(), AR);
  installIndexes([v]);
  const ex = { id: "v1", subId: PRESENT, type: "ar2en", person: "p-she" };
  const r = must(T.resolveQuestion([v], ex, false, []), "resolved");
  const marks = T.marksForAnswer({ exercise: ex, item: r.unit, parentItem: r.parent, asking: [v], settings, systems: [], correct: false, rating: "again", practice: false, grid: null });
  assert.deepEqual(marks.map((/** @type {any} */ m) => [m.subId, m.correct]), [[PRESENT, false], ["p-she", false]]);
  const next = must(gradeInto([v], marks, { type: "ar2en", how: {} }), "written")[0];
  assert.deepEqual(formOf(next, PRESENT).s.ar2en.hist, [0]);
  assert.deepEqual(formOf(next, "p-she").s.ar2en.hist, [0]);
});

test("a question about the whole tense marks it once, right only where every person was", () => {
  const v = withTenses(verb(), AR);
  installIndexes([v]);
  const ex = { id: "v1", subId: PRESENT, type: "vread", person: "p-i" };
  const r = must(T.resolveQuestion([v], ex, false, []), "resolved");
  const tense = must(tenseOf(v, verbOf(AR), "present"), "the present").places.map((/** @type {any} */ p) => ({ unit: p.form, right: p.form.id !== "p-they" }));
  const marks = T.marksForAnswer({ exercise: ex, item: r.unit, parentItem: r.parent, asking: [v], settings, systems: [], correct: false, rating: "again", practice: false, grid: null, tense });
  assert.deepEqual(marks[0], { id: "v1", subId: PRESENT, rating: "again", correct: false, advance: true });
  assert.equal(marks.length, 7, "the tense, then each of its six persons");
  assert.equal(marks.find((/** @type {any} */ m) => m.subId === "p-they").correct, false);
  assert.equal(marks.find((/** @type {any} */ m) => m.subId === "p-he").correct, true);
});

test("'I get it' marks the tense alone", () => {
  const v = withTenses(verb(), AR);
  installIndexes([v]);
  const ex = { id: "v1", subId: PRESENT, type: "vpattern", person: "p-i" };
  const r = must(T.resolveQuestion([v], ex, false, []), "resolved");
  const tense = must(tenseOf(v, verbOf(AR), "present"), "the present").places.map((/** @type {any} */ p) => ({ unit: p.form, right: true }));
  const marks = T.marksForAnswer({ exercise: ex, item: r.unit, parentItem: r.parent, asking: [v], settings, systems: [], correct: true, rating: "good", practice: false, grid: null, tense });
  assert.deepEqual(marks.map((/** @type {any} */ m) => m.subId), [PRESENT]);
});

/* ---- in somebody else's sentence ---- */

/** "I want to ___", a sentence whose blank any verb fills. */
const frame = () => /** @type {any} */ ({
  id: "f1", tags: [], created: 1, lang: "ar-PS", kind: "sentence",
  forms: [{ id: "f1", ar: "{{verb}} هلأ", en: "{{verb}} now", lat: "{{verb}} hala2", lang: "ar-PS", s: {} }],
});

test("a person stands in a sentence once its tense is cleared, and not while going wrong", () => {
  const v = withTenses(verb(), AR);
  const items = [v, frame()];
  T.installIndexes(items, settings);
  const standing = () => T.valueReachOf(items, settings).forms.get("p-he");
  assert.equal(standing(), false, "the present is not cleared yet");
  const present = formOf(v, PRESENT);
  const keys = T.laddered(present, settings);
  present.s = Object.fromEntries(keys.map((/** @type {string} */ k) => [k, st([1, 1])]));
  for (const f of v.forms) if (f.row === "present") f.s = Object.fromEntries(keys.map((/** @type {string} */ k) => [k, st([1])]));
  T.installIndexes(items, settings);
  assert.equal(standing(), true, "cleared, and every person answered right");
  formOf(v, "p-he").s = { ...formOf(v, "p-he").s, ar2en: st([1, 0]) };
  T.installIndexes(items, settings);
  assert.equal(standing(), false, "he has gone wrong lately");
  assert.equal(T.valueReachOf(items, settings).forms.get("p-she"), true, "and she has not");
});

test("a sentence answered right credits the tense and the person who stood in it", () => {
  const v = withTenses(verb(), AR);
  const f = frame();
  const items = [v, f];
  T.installIndexes(items, settings);
  const found = T.fillersIn({ ...f.forms[0], filled: { verb: "p-he" } }, "ar2en", settings);
  assert.deepEqual(found.map((/** @type {any} */ x) => x.subId), [PRESENT, "p-he"]);
  assert.equal(found[0].asked, true, "the tense climbs that question");
});

/* ---- the subjunctive ---- */

test("the subjunctive is a tense like the others, asked only in its examples", () => {
  const subj = (/** @type {string} */ col, /** @type {string} */ word) =>
    ({ id: `eat-s-${col}`, ar: word, en: "", lat: word, lang: "ar-PS", row: "subjunctive", col, s: {} });
  const eat = withTenses(/** @type {any} */ ({
    id: "eat", lang: "ar-PS", category: "verb", name: "to eat", tags: [], created: 1, kind: "word",
    forms: [
      { id: "eat", ar: "أكل", en: "he ate", lat: "akal", lang: "ar-PS", s: {} },
      subj("i", "آكل"), subj("she", "تاكل"), subj("we", "ناكل"),
    ],
    examples: [{ ar: "لازم {{verb}}", lat: "laazim {{verb}}", en: "{{verb-who}} must {{verb-plain}}" }],
  }), AR);
  const form = formOf(eat, tenseIdOf("eat", "subjunctive"));
  T.installIndexes([eat], settings);
  const keys = T.laddered(form, settings);
  assert.ok(keys.length > 0, "the tense is asked");
  assert.ok(keys.every((/** @type {string} */ k) => EXAMPLE_TYPES.includes(k)), `asked in examples alone: ${keys}`);
  const asked = T.buildSession({ items: [eat].concat(words(8)), settings, inDeck: () => true }).exercises.filter((/** @type {any} */ e) => e.id === "eat");
  assert.ok(asked.length > 0, "and dealt");
  for (const ex of asked) {
    const r = must(T.resolveQuestion([eat], ex, false, []), "resolved");
    assert.match(String(r.unit.ar), /لازم/, `${ex.type} is asked in the example`);
  }
});

/* ---- carried ---- */

test("a refresh of the teacher's card keeps the tense's progress", () => {
  const v = withTenses(verb(), AR);
  formOf(v, PRESENT).s = { ar2en: st([1, 1]) };
  const held = { ...v, source: { courseId: "c", deckId: "d", cardId: "v1", rev: 1 } };
  const fresh = { ...verb(), source: held.source };
  const kept = foldCourses([held], [fresh]).items.find((/** @type {any} */ i) => i.id === "v1");
  assert.deepEqual(formOf(kept, PRESENT).s.ar2en.hist, [1, 1]);
});

test("a device that knows nothing of tenses does not take them away", () => {
  const mine = withTenses(verb(), AR);
  formOf(mine, PRESENT).s = { ar2en: st([1, 1]) };
  mine.updated = 1;
  const theirs = { ...verb(), updated: 2 };
  const merged = mergeData(/** @type {any} */ ({ items: [mine], settings: {} }), /** @type {any} */ ({ items: [theirs] }));
  assert.deepEqual(formOf(merged.items[0], PRESENT).s.ar2en.hist, [1, 1]);
});

/* ---- counted ---- */

test("on Progress a verb counts as each tense it has, named for the verb and the tense", () => {
  const v = withTenses(verb(), AR);
  installIndexes([v]);
  const counted = must(T.tenseCardsOf(v), "its tenses");
  assert.deepEqual(counted.map((/** @type {any} */ c) => c.name), ["to write · present", "to write · past"]);
  assert.ok(counted.every((/** @type {any} */ c) => c.tenseOf === "v1"), "each opens the verb");
  assert.equal(T.asCounted([v].concat(words(2))).length, 4);
  assert.equal(T.climbOf([v], settings, [v]).n, 2);
});

/** Every index a session needs, over these cards. */
function installIndexes(/** @type {any[]} */ items) {
  T.installIndexes(items, settings);
}
