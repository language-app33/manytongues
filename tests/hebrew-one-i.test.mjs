/*
 * A Hebrew verb has one "I", one "we" and one "they" in the past and the
 * future, unless the teacher says one has two (0.746).
 *
 * The present really differs by gender in every person — כותב and כותבת —
 * so its twelve boxes stay. In the past and future כתבתי, כתבנו and כתבו
 * are anybody's, and were typed, taught and asked twice, labelled "I (m)"
 * and "I (f)" as if they differed. Arabic's one *I* (tests/one-i.test.mjs)
 * joins a whole column; Hebrew's join is decided row by row, and that is
 * what is held here: the table, the drills, a sentence about a woman
 * speaker, a learner's device and the editor.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { agreedCell, foldJoined, foldedAt, personAt, personsFor, personsOf, tableOf } from "../src/verbs.ts";
import { tenseOf } from "../src/verb-drills.ts";
import { LANGUAGES, verbOf } from "../src/languages.ts";
import { buildOnce, must } from "./helpers.mjs";

const bundled = async (/** @type {string} */ name) =>
  import(path.join(await buildOnce([`${name}.tsx`]), `${name}.js`));
const { cardToItem, foldCourses } = await bundled("shared");
const { initialCells, tableCellsOf } = await bundled("card-editor");

const heLang = must(LANGUAGES["he-IL"], "Modern Hebrew");
const hebrew = must(verbOf(heLang), "the Hebrew verb table");

/** @param {string} row @param {string} col @param {string} ar @param {string} en @param {Record<string, any>} [more] @returns {any} */
const cell = (row, col, ar, en, more = {}) => ({ id: `c-${row}-${col}`, row, col, ar, en, lat: "", ...more });

const PRESENT = [
  ["i", "כּוֹתֵב", "I write"], ["i-f", "כּוֹתֶבֶת", "I write"],
  ["you-m", "כּוֹתֵב", "you write"], ["you-f", "כּוֹתֶבֶת", "you write"],
  ["he", "כּוֹתֵב", "he writes"], ["she", "כּוֹתֶבֶת", "she writes"],
  ["we", "כּוֹתְבִים", "we write"], ["we-f", "כּוֹתְבוֹת", "we write"],
  ["you-pl", "כּוֹתְבִים", "you write"], ["you-pl-f", "כּוֹתְבוֹת", "you write"],
  ["they", "כּוֹתְבִים", "they write"], ["they-f", "כּוֹתְבוֹת", "they write"],
];
/* The past as written before 0.746: "I", "we" and "they" typed twice, and
   one "I" with a dagesh the other lacks, which is one word all the same. */
const PAST = [
  ["i", "כָּתַבְתִּי", "I wrote"], ["i-f", "כָּתַבְתִי", "I wrote", { clips: ["h-said"] }],
  ["you-m", "כָּתַבְתָּ", "you wrote"], ["you-f", "כָּתַבְתְּ", "you wrote"],
  ["he", "כָּתַב", "he wrote"], ["she", "כָּתְבָה", "she wrote"],
  ["we", "כָּתַבְנוּ", "we wrote"], ["we-f", "כָּתַבְנוּ", "we wrote"],
  ["you-pl", "כְּתַבְתֶּם", "you wrote"], ["you-pl-f", "כְּתַבְתֶּן", "you wrote"],
  ["they", "כָּתְבוּ", "they wrote"], ["they-f", "כָּתְבוּ", "they wrote"],
];
const subsOf = (/** @type {any[][]} */ past) => [
  ...PRESENT.map(([col, ar, en]) => cell("present", col, ar, en)),
  ...past.map(([col, ar, en, more]) => cell("past", col, ar, en, more)),
];
const toWrite = { id: "write", ar: "כָּתַב", en: "to write", lang: "he-IL", subs: subsOf(PAST) };
const COPIES = ["c-past-i-f", "c-past-we-f", "c-past-they-f"];

/* A verb whose past "I" really is written differently in the two boxes —
   made up for the test; what matters is that the letters differ. */
const twoIs = {
  ...toWrite,
  id: "two",
  subs: subsOf(PAST.map((p) => (p[0] === "i-f" ? ["i-f", "כָּתַבְתִּיה", "I wrote"] : p))),
};

const labelsIn = (/** @type {any} */ card, /** @type {string} */ row) =>
  tableOf(card, hebrew).filter((c) => c.row === row).map((c) => `${c.col}:${c.person.label}`);

test("the columns stay all twelve: the present needs every one", () => {
  assert.equal(personsFor(toWrite, hebrew).length, 12);
  assert.deepEqual(personsFor(toWrite, hebrew).map((p) => p.id), personsOf(hebrew).map((p) => p.id));
});

test("the past has one I, one we and one they, under their plain names; the present has twelve", () => {
  const past = labelsIn(toWrite, "past");
  for (const col of ["i-f", "we-f", "they-f"]) assert.ok(!past.some((l) => l.startsWith(`${col}:`)), `${col} in the past`);
  assert.ok(past.includes("i:I"), past.join(" "));
  assert.ok(past.includes("we:we"), past.join(" "));
  assert.ok(past.includes("they:they"), past.join(" "));
  /* The plural "you (f)" is its own in every row. */
  assert.ok(past.includes("you-pl-f:you (f pl)"), past.join(" "));
  assert.equal(past.length, 9);
  const present = labelsIn(toWrite, "present");
  assert.equal(present.length, 12);
  assert.ok(present.includes("i:I (m)") && present.includes("i-f:I (f)"), present.join(" "));
  assert.ok(present.includes("we:we (m)") && present.includes("they-f:they (f)"), present.join(" "));
  assert.equal(foldedAt(toWrite, hebrew, "past", "i-f"), true);
  assert.equal(foldedAt(toWrite, hebrew, "present", "i-f"), false);
  assert.equal(must(personAt(toWrite, hebrew, "past", "i"), "past I").label, "I");
  assert.equal(must(personAt(toWrite, hebrew, "present", "i"), "present I").label, "I (m)");
});

test("folding takes out exactly the three past copies, keeps the present, and keeps the recording", () => {
  const { forms, into } = foldJoined(toWrite.subs, hebrew);
  const ids = forms.map((f) => f.id);
  for (const id of COPIES) assert.ok(!ids.includes(id), id);
  assert.equal(forms.length, toWrite.subs.length - 3);
  for (const [col] of PRESENT) assert.ok(ids.includes(`c-present-${col}`), `present ${col}`);
  assert.deepEqual(into, { "c-past-i-f": "c-past-i", "c-past-we-f": "c-past-we", "c-past-they-f": "c-past-they" });
  assert.deepEqual(must(forms.find((f) => f.id === "c-past-i"), "past I").clips, ["h-said"]);
});

test("a past I written two ways keeps both, labelled as declared, and the past we is still one", () => {
  const past = labelsIn(twoIs, "past");
  assert.ok(past.includes("i:I (m)") && past.includes("i-f:I (f)"), past.join(" "));
  assert.ok(past.includes("we:we") && !past.some((l) => l.startsWith("we-f:")), past.join(" "));
  const { into } = foldJoined(twoIs.subs, hebrew);
  assert.deepEqual(into, { "c-past-we-f": "c-past-we", "c-past-they-f": "c-past-they" });
});

test("the same word typed twice in the present is not folded", () => {
  const heb = [cell("present", "i", "אוכל", "I eat"), cell("present", "i-f", "אוכל", "I eat")];
  assert.equal(foldJoined(heb, hebrew).forms, heb);
  assert.ok(labelsIn({ subs: heb }, "present").includes("i-f:I (f)"));
});

test("a sentence about a woman speaker takes the one past I, and her own present", () => {
  const woman = { person: "i-f" };
  const wrote = must(agreedCell(toWrite, hebrew, "past", woman), "her past");
  assert.equal(wrote.id, "c-past-i", "the I cell, whose progress it is");
  assert.equal(wrote.ar, "כָּתַבְתִּי");
  assert.equal(wrote.col, "i-f", "under the column asked for");
  const writes = must(agreedCell(toWrite, hebrew, "present", woman), "her present");
  assert.equal(writes.id, "c-present-i-f");
  assert.equal(writes.ar, "כּוֹתֶבֶת");
});

test("the past a learner reads lists each person once", () => {
  const tense = must(tenseOf(toWrite, hebrew, "past"), "the past");
  const ids = tense.places.map((p) => p.person.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, ["i", "you-m", "you-f", "he", "she", "we", "you-pl", "you-pl-f", "they"]);
  assert.equal(tense.places[0].person.label, "I");
  const present = must(tenseOf(toWrite, hebrew, "present"), "the present");
  assert.equal(present.places.length, 12);
});

test("a learner's device holds one past I, with the schedule they had got further with", () => {
  const { subs, ...rest } = toWrite;
  const server = { ...rest, id: "k1write", forms: [{ ar: "כָּתַב", en: "to write", lat: "" }, ...subs] };
  const fresh = cardToItem(server, "Verbs", "c1", "d1", () => ({}));
  const ids = fresh.forms.map((/** @type {any} */ f) => f.id);
  assert.ok(!ids.some((/** @type {string} */ id) => id.endsWith("~c-past-i-f")), "no past copy made");
  assert.ok(ids.some((/** @type {string} */ id) => id.endsWith("~c-present-i-f")), "the present I (f) is kept");
  const iId = must(ids.find((/** @type {string} */ id) => id.endsWith("~c-past-i")), "the past I");
  const copyId = iId.replace("c-past-i", "c-past-i-f");

  const state = (/** @type {number} */ right) => ({ en2ar: { phase: "review", right, interval: right, reps: right } });
  const before = cardToItem(server, "Verbs", "c1", "d1", () => ({}));
  const heldForms = [
    ...before.forms.map((/** @type {any} */ f) => (f.id === iId ? { ...f, s: state(1) } : f)),
    { ...must(before.forms.find((/** @type {any} */ f) => f.id === iId), "I"), id: copyId, col: "i-f", s: state(5) },
  ];
  const held = { ...before, forms: heldForms.map(({ joinedFrom: _j, ...f }) => f) };
  const after = foldCourses([held], [fresh]).items[0];
  const mine = must(after.forms.find((/** @type {any} */ f) => f.id === iId), "the past I after the fold");
  assert.equal(mine.s.en2ar.right, 5, "the copy's schedule, being further along");
  assert.ok(!after.forms.some((/** @type {any} */ f) => f.id === copyId), "and the copy is gone");
  assert.ok(!after.forms.some((/** @type {any} */ f) => "joinedFrom" in f), "nothing about it stored");
});

test("the editor opens an old card folded in the past only, and saves it so", () => {
  const opened = initialCells(toWrite, heLang);
  const at = (/** @type {any[]} */ cells, /** @type {string} */ row, /** @type {string} */ col) =>
    cells.some((c) => c.row === row && c.col === col);
  for (const col of ["i-f", "we-f", "they-f"]) {
    assert.ok(!at(opened, "past", col), `past ${col} opened`);
    assert.ok(at(opened, "present", col), `present ${col} kept`);
  }
  assert.equal(opened.filter((/** @type {any} */ c) => c.row === "present").length, 12);
  const saved = tableCellsOf(toWrite.subs, hebrew, []);
  for (const col of ["i-f", "we-f", "they-f"]) assert.ok(!at(saved, "past", col), `past ${col} saved`);
  assert.equal(saved.filter((/** @type {any} */ c) => c.row === "present").length, 12);
});
