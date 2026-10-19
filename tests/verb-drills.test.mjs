// @ts-check
/*
 * The practices of a verb's tense as a whole: seeing the pattern, reading
 * the forms, who a form is about (read and heard), filling the row, and
 * changing the person.
 *
 * Each is offered where the language's verb table names it, on the cells
 * of a tense with something to tell apart, and never on the cell a
 * dictionary cites. The three asked of a whole tense mark every form in
 * it from one answer, and the tense is seen before anything else about it
 * is asked.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import path from "node:path";
import { must } from "./helpers.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".verb-drills-build");

await build({
  entryPoints: [path.join(here, "..", "src", "ArabicTrainer.tsx")],
  outfile: path.join(out, "trainer.js"),
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
const { afterItsUse, buildSession, installIndexes, laddered, marksForAnswer, withRows } = await import(path.join(out, "trainer.js"));
const { LANGUAGES, EX, TYPES, verbOf, keysFor } = await import("../src/languages.ts");
const drills = await import("../src/verb-drills.ts");
const { drillFits, whoChoices, whoIsRight, rowMarks, shiftCue, tenseOf, drillTable } = drills;

const AR = LANGUAGES["ar-PS"];
const HE = LANGUAGES["he-IL"];
const VI = LANGUAGES["vi-Hue"];
const settings = { language: "ar-PS" };
const PRACTICES = ["vpattern", "vread", "vwho", "vwhorec", "vrow", "vshift"];

/** @param {string} id @param {string} ar @param {string} en @param {string} lat @param {string} row @param {string} col */
const cell = (id, ar, en, lat, row, col) => ({ id, ar, en, lat, lang: "ar-PS", row, col, s: {} });

/** To write, in the present and the cited past. بتكتب is both "you (m)" and "she". */
const verb = () => /** @type {any} */ ({
  id: "v1", tags: [], created: 1, lang: "ar-PS", kind: "word", category: "verb", name: "to write",
  forms: [
    { id: "v1", ar: "كتب", en: "to write", lat: "katab", lang: "ar-PS", s: {} },
    cell("p-i", "بكتب", "I write", "baktub", "present", "i"),
    cell("p-youm", "بتكتب", "you (m) write", "btiktub", "present", "you-m"),
    cell("p-youf", "بتكتبي", "you (f) write", "btiktbi", "present", "you-f"),
    cell("p-he", "بيكتب", "he writes", "biktub", "present", "he"),
    cell("p-she", "بتكتب", "she writes", "btiktub", "present", "she"),
    cell("p-they", "بيكتبوا", "they write", "biktbu", "present", "they"),
    cell("x-he", "كتب", "he wrote", "katab", "past", "he"),
  ],
});
const cellOf = (/** @type {any} */ card, /** @type {string} */ id) => must(card.forms.find((/** @type {any} */ f) => f.id === id), id);

/** Plain words, so a session has more than the verb to deal. */
const words = (/** @type {number} */ n) =>
  Array.from({ length: n }, (_, i) => /** @type {any} */ ({
    id: `w${i + 1}`, tags: [], created: i + 2, lang: "ar-PS", kind: "word",
    forms: [{ id: `w${i + 1}`, ar: `كلمة${i + 1}`, en: `word ${i + 1}`, lat: `kilma${i + 1}`, lang: "ar-PS", s: {} }],
  }));

test("Arabic and Hebrew offer every practice on their verb tables; Huế offers none", () => {
  assert.deepEqual([...(must(verbOf(AR), "Arabic's verbs").practices || [])].sort(), [...PRACTICES].sort());
  assert.deepEqual([...(must(verbOf(HE), "Hebrew's verbs").practices || [])].sort(), [...PRACTICES].sort());
  assert.equal((must(verbOf(VI), "Huế's verbs").practices || []).length, 0);
  for (const t of PRACTICES) {
    assert.ok(TYPES.includes(t), `${t} is scheduled`);
    assert.ok(EX[t].verbDrill, `${t} is a verb practice`);
  }
});

test("each practice stands on the level it was planned for", () => {
  const levels = Object.fromEntries(PRACTICES.map((t) => [t, EX[t].level]));
  assert.deepEqual(levels, { vpattern: 1, vread: 1, vwho: 1, vwhorec: 1, vrow: 2, vshift: 3 });
});

test("a verb practice keeps one schedule per form, whatever the form accepts", () => {
  const form = { id: "f", ar: "بكتب / باكتب", en: "I write", lat: "baktub", s: {} };
  for (const t of PRACTICES) assert.deepEqual(keysFor(form, t), [t], t);
});

test("a cell of a tense with something to tell apart can be asked every practice", () => {
  const v = verb();
  for (const t of PRACTICES) assert.ok(drillFits(v, cellOf(v, "p-she"), t, AR), t);
});

test("the cell a dictionary cites is asked none of them", () => {
  const v = verb();
  for (const t of PRACTICES) assert.equal(drillFits(v, cellOf(v, "x-he"), t, AR), false, t);
});

test("a tense of one person, or of forms all spelt alike, has nothing to practise", () => {
  const one = verb();
  one.forms = one.forms.filter((/** @type {any} */ f) => !f.row || f.col === "he");
  assert.equal(drillFits(one, cellOf(one, "p-he"), "vwho", AR), false, "one person");
  const alike = verb();
  alike.forms = alike.forms.filter((/** @type {any} */ f) => !f.row || f.id === "p-youm" || f.id === "p-she");
  assert.equal(drillFits(alike, cellOf(alike, "p-she"), "vrow", AR), false, "two persons, one spelling");
});

test("a word, and a language whose table names no practice, are asked none of them", () => {
  const v = verb();
  assert.equal(drillFits(v, cellOf(v, "v1"), "vwho", AR), false, "the card's own word");
  const hue = { ...cellOf(v, "p-he"), row: "plain", col: "any" };
  assert.equal(drillTable(VI, hue), null);
});

test("the tense is laid out by person, two forms spelt the same kept as two rows", () => {
  const v = verb();
  const tense = must(tenseOf(v, verbOf(AR), "present"), "the present");
  assert.deepEqual(tense.places.map((/** @type {any} */ p) => p.person.id), ["i", "you-m", "you-f", "he", "she", "they"]);
});

test("who a form is about: every person spelt the same is right", () => {
  const v = verb();
  const tense = must(tenseOf(v, verbOf(AR), "present"), "the present");
  const she = cellOf(v, "p-she");
  const { right, wrong } = whoChoices(tense, she, AR, (/** @type {string} */ a, /** @type {string} */ b) => Math.abs(a.length - b.length), 4);
  assert.deepEqual(right.map((/** @type {any} */ p) => p.id).sort(), ["she", "you-m"]);
  assert.ok(!wrong.some((/** @type {any} */ p) => p.id === "she" || p.id === "you-m"), "neither is offered as wrong");
  assert.ok(whoIsRight(tense, she, "you-m", AR), "you (m) is as right as she");
  assert.equal(whoIsRight(tense, she, "you-f", AR), false, "you (f) is not");
});

test("filling the row: a tile spelt like the right one is right in either place", () => {
  const v = verb();
  const tense = must(tenseOf(v, verbOf(AR), "present"), "the present");
  const placed = {
    i: "بكتب", "you-m": "بتكتب", "you-f": "بتكتبي", he: "بيكتب", she: "بتكتب", they: "بيكتب",
  };
  const marks = rowMarks(tense, placed);
  const byId = Object.fromEntries(marks.map((/** @type {any} */ m) => [m.form.id, m.right]));
  assert.deepEqual(byId, {
    "p-i": true, "p-youm": true, "p-youf": true, "p-he": true, "p-she": true, "p-they": false,
  });
  assert.equal(rowMarks(tense, {}).some((/** @type {any} */ m) => m.right), false, "an empty place is a miss");
});

test("changing the person never starts from a form spelt like the answer", () => {
  const v = verb();
  const tense = must(tenseOf(v, verbOf(AR), "present"), "the present");
  const she = cellOf(v, "p-she");
  for (let seed = 0; seed < 12; seed++) {
    const cue = must(shiftCue(tense, she, AR, () => 0, seed), "a cue");
    assert.notEqual(cue.form.ar, she.ar, `seed ${seed} started from ${cue.person.id}`);
  }
  /* And the one the learner has got furthest with, where one stands out. */
  const rank = (/** @type {any} */ f) => (f.id === "p-they" ? 5 : 0);
  assert.equal(must(shiftCue(tense, she, AR, rank, 3), "a cue").form.id, "p-they");
});

test("a verb's cells climb the practices as well as every other question", () => {
  const v = verb();
  installIndexes([v], settings);
  const keys = laddered(cellOf(v, "p-she"), settings);
  for (const t of ["vpattern", "vread", "vwho", "vrow", "vshift"]) assert.ok(keys.includes(t), t);
  assert.ok(!keys.includes("vwhorec"), "nothing to hear without a recording");
  assert.ok(!laddered(cellOf(v, "x-he"), settings).some((/** @type {string} */ k) => PRACTICES.includes(k)), "the cited cell climbs none");
});

test("a tense is seen before it is asked anything, and dealt once for all its forms", () => {
  const v = verb();
  const items = [v].concat(words(8));
  installIndexes(items, settings);
  /* A session takes one form of the verb, and the cited past is one of
     them: the first of a few sessions that takes the present. */
  const ofVerb = Array.from({ length: 20 }, () => buildSession({ items, settings, inDeck: () => true }).exercises
    .filter((/** @type {any} */ e) => e.id === "v1" && e.subId && e.subId.startsWith("p-")))
    .find((list) => list.length > 0) || [];
  assert.ok(ofVerb.length > 0, "the present is dealt");
  assert.ok(ofVerb.every((/** @type {any} */ e) => e.type === "vpattern"), `asked ${ofVerb.map((/** @type {any} */ e) => e.type).join(", ")}`);
  assert.equal(ofVerb.length, 1, "one table for the whole tense");
});

test("once the pattern is got, the rest of the tense's questions are open", () => {
  const v = verb();
  const got1 = { phase: "learning", step: 1, ease: 2.5, interval: 0, due: 0, reps: 1, lapses: 0, right: 1, wrong: 0, skips: 0, near: 0, hints: 0, hist: [1], updated: 1 };
  for (const f of v.forms) if (f.row === "present") f.s = { vpattern: got1 };
  const items = [v].concat(words(8));
  installIndexes(items, settings);
  /* A session takes one form of the verb, and the cited past is one of
     them, so the present is looked for over a few sessions. */
  const ofVerb = Array.from({ length: 10 }, () => buildSession({ items, settings, inDeck: () => true }).exercises)
    .flat()
    .filter((/** @type {any} */ e) => e.id === "v1" && e.subId && e.subId.startsWith("p-"));
  assert.ok(ofVerb.some((/** @type {any} */ e) => e.type !== "vpattern"), `asked ${ofVerb.map((/** @type {any} */ e) => e.type).join(", ")}`);
});

test("a verb already learnt goes back to learning until the practices are answered", () => {
  /* The owner's choice: the new questions are on the ladder for everybody,
     so level two is shut on a form whose level-one practices are new. */
  const v = verb();
  const solid = { phase: "review", step: 0, ease: 2.5, interval: 30, due: Date.now() + 86400000, reps: 6, lapses: 0, right: 6, wrong: 0, skips: 0, near: 0, hints: 0, hist: [1, 1], updated: 1 };
  const she = cellOf(v, "p-she");
  installIndexes([v], settings);
  she.s = Object.fromEntries(laddered(she, settings).filter((/** @type {string} */ k) => !PRACTICES.includes(k)).map((/** @type {string} */ k) => [k, solid]));
  installIndexes([v], settings);
  const items = [v].concat(words(8));
  installIndexes(items, settings);
  const got = buildSession({ items, settings, inDeck: () => true });
  const asked = got.exercises.filter((/** @type {any} */ e) => e.subId === "p-she").map((/** @type {any} */ e) => e.type);
  assert.ok(!asked.some((/** @type {string} */ t) => EX[t].level > 1), `asked ${asked.join(", ")}`);
});

test("two forms of one tense dealt the same tense question keep the first", () => {
  const v = verb();
  const list = [
    { id: "v1", subId: "p-he", type: "vrow" },
    { id: "v1", subId: "p-she", type: "vrow" },
    { id: "v1", subId: "p-she", type: "vwho" },
    { id: "v1", subId: "x-he", type: "vrow" },
  ];
  const kept = withRows(list, [v]);
  assert.deepEqual(kept.map((/** @type {any} */ e) => `${e.subId} ${e.type}`), ["p-he vrow", "p-she vwho", "x-he vrow"]);
});

test("a tense answered as a whole marks each of its forms on its own", () => {
  const v = verb();
  const he = cellOf(v, "p-he");
  const she = cellOf(v, "p-she");
  const marks = marksForAnswer({
    exercise: { id: "v1", subId: "p-he", type: "vrow" },
    item: he,
    parentItem: v,
    asking: [v],
    settings,
    systems: [],
    correct: false,
    rating: "again",
    practice: false,
    grid: null,
    tense: [{ unit: he, right: true }, { unit: she, right: false }],
  });
  assert.deepEqual(
    marks.map((/** @type {any} */ m) => [m.subId, m.correct, m.advance]),
    [["p-he", true, true], ["p-she", false, true]],
  );
});

/** A phrase that uses the verb: its words include one of the verb's forms. */
const phrase = () => /** @type {any} */ ({
  id: "ph1", tags: [], created: 3, lang: "ar-PS", kind: "phrase", uses: ["v1"],
  forms: [{ id: "ph1", ar: "هي بتكتب رسالة", en: "she is writing a letter", lat: "hiyye btiktub risaale", lang: "ar-PS", s: {} }],
});

test("the tense comes straight after a phrase in the session that uses the verb", () => {
  const items = [verb(), phrase()].concat(words(3));
  installIndexes(items, settings);
  const list = [
    { id: "v1", subId: "p-she", type: "vpattern" },
    { id: "w1", subId: null, type: "ar2en" },
    { id: "ph1", subId: null, type: "ar2en" },
    { id: "w2", subId: null, type: "ar2en" },
  ];
  const got = afterItsUse(list, items, settings);
  assert.deepEqual(got.map((/** @type {any} */ q) => `${q.id}:${q.type}`), ["w1:ar2en", "ph1:ar2en", "v1:vpattern", "w2:ar2en"]);
});

test("with nothing in the session using the verb, the tense stays where it was dealt", () => {
  const items = [verb(), phrase()].concat(words(3));
  installIndexes(items, settings);
  const list = [
    { id: "w1", subId: null, type: "ar2en" },
    { id: "v1", subId: "p-she", type: "vpattern" },
    { id: "v1", subId: "p-he", type: "vwho" },
    { id: "w2", subId: null, type: "ar2en" },
  ];
  assert.deepEqual(afterItsUse(list, items, settings), list, "the verb's own questions are not a use of it");
});
