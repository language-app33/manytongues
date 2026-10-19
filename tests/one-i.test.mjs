/*
 * A Palestinian verb has one "I" unless the teacher says it has two.
 *
 * Until 0.456 every verb had an *I (m)* and an *I (f)* box, so باكل was
 * typed, recorded and learnt twice, and the table told a learner a woman
 * says it differently. Only a few words — رايح and رايحة — really have two.
 * What is checked here is the whole of the promise: a verb with the same
 * word in both is one *I* everywhere (the table, a learner's device, a
 * sentence about a woman speaker), a verb with two keeps both, the
 * learner keeps whichever copy they had got further with, and Hebrew —
 * whose *I* really does change with gender — is left alone.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { build } from "esbuild";

import { agreedCell, foldJoined, keepsApart, personsFor, personsOf, tableOf } from "../src/verbs.ts";
import { tenseOf } from "../src/verb-drills.ts";
import { LANGUAGES, verbOf } from "../src/languages.ts";
import { must } from "./helpers.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".one-i-build");
const bundled = async (/** @type {string} */ name) => {
  await build({
    entryPoints: [path.join(here, "..", "src", `${name}.tsx`)],
    outfile: path.join(out, `${name}.js`),
    bundle: true,
    format: "esm",
    jsx: "automatic",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".jsx": "jsx" },
    logLevel: "silent",
  });
  return import(path.join(out, `${name}.js`));
};
const { cardToItem, foldCourses } = await bundled("shared");
const { initialCells, tableCellsOf } = await bundled("card-editor");

const arLang = must(LANGUAGES["ar-PS"], "Palestinian Arabic");
const arabic = must(verbOf(arLang), "the Arabic verb table");
const hebrew = must(verbOf(LANGUAGES["he-IL"]), "the Hebrew verb table");
const iF = must(personsOf(arabic).find((p) => p.id === "i-f"), "the I (f) column");

/** @param {string} row @param {string} col @param {string} ar @param {string} en @param {Record<string, any>} [more] @returns {any} */
const cell = (row, col, ar, en, more = {}) => ({ id: `c-${row}-${col}`, row, col, ar, en, lat: "", ...more });

/* "To eat", written before 0.456: the same word typed under both *I*s,
   once with a haraka the other lacks, which is one word all the same. */
const toEat = {
  id: "eat",
  ar: "أكل",
  en: "to eat",
  lang: "ar-PS",
  subs: [
    cell("present", "i", "باكل", "I eat"),
    cell("present", "i-f", "باكُل", "I eat", { clips: ["h-said"] }),
    cell("present", "she", "بتاكل", "she eats"),
    cell("past", "i", "أكلت", "I ate"),
    cell("past", "i-f", "أكلت", "I ate"),
    cell("past", "he", "أكل", "he ate"),
  ],
};

/* "To be going", which really has two. */
const going = {
  id: "go",
  ar: "رايح",
  en: "going",
  lang: "ar-PS",
  subs: [
    cell("present", "i", "رايح", "I am going"),
    cell("present", "i-f", "رايحة", "I am going"),
    cell("present", "he", "رايح", "he is going"),
    cell("past", "i", "رحت", "I went"),
  ],
};

test("a verb with the same word under both I's has one I, called plain I", () => {
  assert.equal(keepsApart(toEat, arabic, iF), false, "a haraka is spelling, not a second form");
  const persons = personsFor(toEat, arabic);
  assert.ok(!persons.some((p) => p.id === "i-f"), "no I (f) column");
  assert.equal(must(persons.find((p) => p.id === "i"), "the I column").label, "I");
  /* And a verb with no I (f) written at all is the same verb. */
  const bare = { ...toEat, subs: toEat.subs.filter((c) => c.col !== "i-f") };
  assert.equal(keepsApart(bare, arabic, iF), false);
});

test("a word whose two I's differ keeps both, under the labels it always had", () => {
  assert.equal(keepsApart(going, arabic, iF), true);
  const labels = personsFor(going, arabic).filter((p) => p.id.startsWith("i")).map((p) => p.label);
  assert.deepEqual(labels, ["I (m)", "I (f)"]);
});

test("the table and the tense a learner reads show one I", () => {
  const cols = tableOf(toEat, arabic).filter((c) => c.row === "present").map((c) => c.col);
  assert.ok(!cols.includes("i-f"));
  const tense = must(tenseOf(toEat, arabic, "present"), "the present");
  assert.deepEqual(tense.places.map((p) => p.person.label), ["I", "she"]);
  /* Both, where there are two. */
  const two = must(tenseOf(going, arabic, "present"), "the present of going");
  assert.deepEqual(two.places.map((p) => p.person.id), ["i", "i-f", "he"]);
});

test("a sentence about a woman speaker takes the verb's one I, and still reads as a woman's", () => {
  const woman = { person: "i-f" };
  const ate = must(agreedCell(toEat, arabic, "past", woman), "the past for a woman speaker");
  assert.equal(ate.id, "c-past-i", "the I cell, whose progress it is");
  assert.equal(ate.ar, "أكلت");
  assert.equal(ate.col, "i-f", "under the column asked for, so what follows it agrees with a woman");
  /* Where there are two, her own. And where a word with two has left a
     row's I (f) blank, that sentence is not asked rather than given the
     man's word. */
  assert.equal(must(agreedCell(going, arabic, "present", woman), "her present").ar, "رايحة");
  assert.equal(agreedCell(going, arabic, "past", woman), null);
});

test("folding takes the copy out, keeps its recording, and says what it went into", () => {
  const { forms, into } = foldJoined(toEat.subs, arabic);
  assert.ok(!forms.some((f) => f.col === "i-f"));
  assert.deepEqual(into, { "c-present-i-f": "c-present-i", "c-past-i-f": "c-past-i" });
  const said = must(forms.find((f) => f.id === "c-present-i"), "the present I");
  assert.deepEqual(said.clips, ["h-said"], "the recording made under the copy");
  /* A word with two, and Hebrew, whose table joins nothing, are left as they are. */
  assert.equal(foldJoined(going.subs, arabic).forms, going.subs);
  const heb = [cell("present", "i", "אוכל", "I eat"), cell("present", "i-f", "אוכל", "I eat")];
  assert.equal(foldJoined(heb, hebrew).forms, heb);
});

test("the editor opens a doubled I as one, and saves it as one", () => {
  const opened = initialCells(toEat, arLang);
  assert.ok(!opened.some((/** @type {any} */ c) => c.col === "i-f"));
  /* A second I typed the same as the first is saved as the one, tick or no tick. */
  const typed = [cell("present", "i", "باكل", "I eat"), cell("present", "i-f", "باكل", "I eat")];
  assert.deepEqual(tableCellsOf(typed, arabic, []).map((/** @type {any} */ c) => c.col), ["i"]);
  const two = [cell("present", "i", "رايح", "I am going"), cell("present", "i-f", "رايحة", "I am going")];
  assert.deepEqual(tableCellsOf(two, arabic, []).map((/** @type {any} */ c) => c.col), ["i", "i-f"]);
});

test("a learner's device holds one I, with the schedule they had got further with", () => {
  const { subs, ...rest } = toEat;
  const server = { ...rest, id: "k1eat", forms: [{ ar: "أكل", en: "to eat", lat: "" }, ...subs] };
  const fresh = cardToItem(server, "Verbs", "c1", "d1", () => ({}));
  const ids = fresh.forms.map((/** @type {any} */ f) => f.id);
  assert.ok(!ids.some((/** @type {string} */ id) => id.endsWith("~c-present-i-f")), "no copy made");
  const iId = must(ids.find((/** @type {string} */ id) => id.endsWith("~c-present-i")), "the present I");
  const copyId = iId.replace("c-present-i", "c-present-i-f");

  /* Held from before: the copy answered right five times, the I once. */
  const state = (/** @type {number} */ right) => ({ en2ar: { phase: "review", right, interval: right, reps: right } });
  const before = cardToItem({ ...server, forms: server.forms }, "Verbs", "c1", "d1", () => ({}));
  const heldForms = [
    ...before.forms.map((/** @type {any} */ f) => (f.id === iId ? { ...f, s: state(1) } : f)),
    { ...must(before.forms.find((/** @type {any} */ f) => f.id === iId), "I"), id: copyId, col: "i-f", s: state(5) },
  ];
  const held = { ...before, forms: heldForms.map(({ joinedFrom: _j, ...f }) => f) };

  const after = foldCourses([held], [fresh]).items[0];
  const mine = must(after.forms.find((/** @type {any} */ f) => f.id === iId), "the I after the fold");
  assert.equal(mine.s.en2ar.right, 5, "the copy's schedule, being further along");
  assert.ok(!after.forms.some((/** @type {any} */ f) => f.id === copyId), "and the copy is gone");
  assert.ok(!after.forms.some((/** @type {any} */ f) => "joinedFrom" in f), "nothing about it stored");

  /* Further along the other way, the I keeps its own. */
  const reversed = {
    ...held,
    forms: held.forms.map((/** @type {any} */ f) => (f.id === iId ? { ...f, s: state(7) } : f)),
  };
  const kept = foldCourses([reversed], [fresh]).items[0];
  assert.equal(must(kept.forms.find((/** @type {any} */ f) => f.id === iId), "I").s.en2ar.right, 7);
});

test("the command is offered for the three persons it is said to, and they are columns the table has", () => {
  const command = must(arabic.tenses.find((t) => t.id === "command"), "the command row");
  assert.deepEqual(command.persons, ["you-m", "you-f", "you-pl"]);
  const cols = new Set(personsOf(arabic).map((p) => p.id));
  for (const id of command.persons || []) assert.ok(cols.has(id), `${id} is a column`);
});
