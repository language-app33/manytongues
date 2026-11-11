// @ts-check
/*
 * A course's path — see src/path.ts.
 *
 * The rules are the owner's (the units plan, section 3): units in a fixed
 * order per course, each opening when the one before it is finished; once
 * reached, always reached; a never-met card held only while every place it
 * lives is a unit nobody has reached.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cardHeld, drawsFrom, isPathUnit, mergeReached, neverAskedAlone, pathRows, pathUnits,
} from "../src/path.ts";
import { NAME_KINDS } from "../src/deck-quality.ts";

/** @param {string} id @returns {{ id: string, unit: true, cardIds: string[] }} */
const unit = (id) => ({ id, unit: true, cardIds: [] });
/** @param {string} id */
const deck = (id) => ({ id, cardIds: [] });

/**
 * A course with these units on its path, all published unless named in `drafts`.
 * @param {string[]} path @param {{ drafts?: string[], opened?: string[], id?: string }} [o]
 */
const courseOf = (path, o = {}) => ({
  id: o.id || "c1",
  decks: [...path],
  path: [...path],
  pathLive: Object.fromEntries(path.filter((p) => !(o.drafts || []).includes(p)).map((p) => [p, 1])),
  opened: o.opened || [],
});

/** @param {string[]} done */
const finished = (done) => (/** @type {string} */ id) => done.includes(id);
/** @param {any} rows @param {string} id */
const rowOf = (rows, id) => rows.find((/** @type {any} */ r) => r.id === id);

/* ---- phase 1 ---- */

test("a course with no path gives no rows, and draws from nothing", () => {
  const c = { id: "c1", decks: ["d1"] };
  assert.deepEqual(pathRows(c, [deck("d1")], () => false, []).rows, []);
  assert.equal(drawsFrom(c, [deck("d1")], "d1").size, 0);
  assert.deepEqual(pathUnits(c, [deck("d1")]), []);
});

test("isPathUnit reads the flag", () => {
  assert.equal(isPathUnit(unit("u")), true);
  assert.equal(isPathUnit(deck("d")), false);
  assert.equal(isPathUnit(null), false);
});

test("three published units, none finished: the first is open and current, the rest locked", () => {
  const units = ["u1", "u2", "u3"].map(unit);
  const { rows, reached } = pathRows(courseOf(["u1", "u2", "u3"]), units, finished([]), []);
  assert.deepEqual(rows.map((r) => r.state), ["open", "locked", "locked"]);
  assert.deepEqual(rows.map((r) => r.current), [true, false, false]);
  assert.deepEqual(rows.map((r) => r.number), [1, 2, 3]);
  assert.deepEqual(reached, ["u1"]);
});

test("unit 1 finished: unit 2 opens and is current, and both are reached", () => {
  const units = ["u1", "u2", "u3"].map(unit);
  const { rows, reached } = pathRows(courseOf(["u1", "u2", "u3"]), units, finished(["u1"]), []);
  assert.deepEqual(rows.map((r) => r.state), ["finished", "open", "locked"]);
  assert.equal(rowOf(rows, "u2").current, true);
  assert.deepEqual(reached, ["u1", "u2"]);
});

test("a draft unit is left out of the rows, and numbering skips it", () => {
  const units = ["u1", "u2", "u3"].map(unit);
  const { rows } = pathRows(courseOf(["u1", "u2", "u3"], { drafts: ["u2"] }), units, finished(["u1"]), []);
  assert.deepEqual(rows.map((r) => r.id), ["u1", "u3"]);
  assert.deepEqual(rows.map((r) => r.number), [1, 2]);
  assert.equal(rowOf(rows, "u3").state, "open");
});

test("a unit on the path whose deck no longer exists is ignored", () => {
  const units = ["u1", "u3"].map(unit);
  const { rows } = pathRows(courseOf(["u1", "gone", "u3"]), units, finished([]), []);
  assert.deepEqual(rows.map((r) => r.id), ["u1", "u3"]);
});

test("nobody is sent back: a reached unit stays open when an earlier one slips", () => {
  const units = ["u1", "u2", "u3", "u4"].map(unit);
  const { rows, reached } = pathRows(courseOf(["u1", "u2", "u3", "u4"]), units, finished([]), ["u1", "u2", "u3"]);
  assert.deepEqual(rows.map((r) => r.state), ["open", "open", "open", "locked"]);
  assert.deepEqual(reached, ["u1", "u2", "u3"]);
});

test("a unit inserted before the learner's place opens once the units before it are finished", () => {
  const units = ["u1", "new", "u2", "u3", "u4"].map(unit);
  const c = courseOf(["u1", "new", "u2", "u3", "u4"]);
  const before = pathRows(c, units, finished([]), ["u1", "u2", "u3"]);
  assert.equal(rowOf(before.rows, "new").state, "locked");
  assert.equal(rowOf(before.rows, "u2").state, "open");
  const after = pathRows(c, units, finished(["u1"]), ["u1", "u2", "u3"]);
  assert.equal(rowOf(after.rows, "new").state, "open");
  assert.equal(rowOf(after.rows, "u2").state, "open");
  assert.equal(rowOf(after.rows, "u3").state, "open");
  assert.equal(rowOf(after.rows, "u4").state, "locked");
  assert.ok(after.reached.includes("new"));
});

test("a locked unit opened by the teacher says so; an open or finished one does not", () => {
  const units = ["u1", "u2", "u3"].map(unit);
  const c = courseOf(["u1", "u2", "u3"], { opened: ["u1", "u2", "u3"] });
  const { rows } = pathRows(c, units, finished(["u1"]), []);
  assert.equal(rowOf(rows, "u1").openedEarly, false);
  assert.equal(rowOf(rows, "u2").openedEarly, false);
  assert.equal(rowOf(rows, "u3").openedEarly, true);
  assert.equal(rowOf(rows, "u3").state, "locked");
});

test("drawsFrom: this unit and the published ones before it", () => {
  const units = ["u1", "u2", "u3", "u4"].map(unit);
  assert.deepEqual([...drawsFrom(courseOf(["u1", "u2", "u3", "u4"]), units, "u3")].sort(), ["u1", "u2", "u3"]);
  assert.deepEqual(
    [...drawsFrom(courseOf(["u1", "u2", "u3", "u4"], { drafts: ["u2"] }), units, "u3")].sort(),
    ["u1", "u3"],
  );
  /* A draft unit still draws from itself. */
  assert.deepEqual([...drawsFrom(courseOf(["u1", "u2"], { drafts: ["u2"] }), units, "u2")].sort(), ["u1", "u2"]);
  assert.equal(drawsFrom(courseOf(["u1"]), units, "u4").size, 0);
});

test("the same unit in two courses can be open in one and locked in the other", () => {
  const units = ["u1", "u2", "shared"].map(unit);
  const a = courseOf(["shared", "u1"], { id: "a" });
  const b = courseOf(["u2", "shared"], { id: "b" });
  assert.equal(rowOf(pathRows(a, units, finished([]), []).rows, "shared").state, "open");
  assert.equal(rowOf(pathRows(b, units, finished([]), []).rows, "shared").state, "locked");
});

test("reached never loses an id, whatever the input", () => {
  const units = ["u1", "u2"].map(unit);
  const { reached } = pathRows(courseOf(["u1", "u2"]), units, finished([]), ["elsewhere", "u2", "u2"]);
  assert.ok(reached.includes("elsewhere"));
  assert.ok(reached.includes("u2"));
  assert.ok(reached.includes("u1"));
  assert.equal(new Set(reached).size, reached.length);
  /* And with nothing on the path at all. */
  assert.deepEqual(pathRows({ id: "c" }, [], finished([]), ["x"]).reached, ["x"]);
});

test("mergeReached is a union, in either order", () => {
  const long = { A: ["1", "2", "3"] };
  const short = { A: ["1"] };
  assert.deepEqual(mergeReached(long, short), { A: ["1", "2", "3"] });
  assert.deepEqual(mergeReached(short, long), { A: ["1", "2", "3"] });
  assert.deepEqual(mergeReached({ A: ["1"] }, { B: ["5"] }), { A: ["1"], B: ["5"] });
  assert.deepEqual(mergeReached(undefined, undefined), {});
  const a = { A: ["1", "2"] };
  const b = { A: ["2", "1", "4"] };
  const merged = mergeReached(a, b);
  assert.deepEqual(merged, { A: ["1", "2", "4"] });
  assert.deepEqual(a, { A: ["1", "2"] });
  assert.deepEqual(b, { A: ["2", "1", "4"] });
  for (const ids of Object.values(merged)) assert.equal(new Set(ids).size, ids.length);
});

test("cardHeld: held only while every place it lives is a unit not reached", () => {
  const units = new Set(["locked", "open"]);
  const isUnit = (/** @type {string} */ d) => units.has(d);
  const open = new Set(["open"]);
  assert.equal(cardHeld(["locked"], isUnit, open), true);
  assert.equal(cardHeld(["locked", "deck"], isUnit, open), false);
  assert.equal(cardHeld(["locked", "open"], isUnit, open), false);
  assert.equal(cardHeld([], isUnit, open), false);
});

test("neverAskedAlone: practice switched off, or a name kind", () => {
  assert.equal(neverAskedAlone({ drill: false, category: "noun" }), true);
  for (const kind of NAME_KINDS) assert.equal(neverAskedAlone({ category: kind }), true);
  assert.equal(neverAskedAlone({ category: "noun" }), false);
  assert.equal(neverAskedAlone({}), false);
});

/* ---- phase 2: the checklist a unit must clear to be published ---- */

import { countingCards, heldFillers, MIN_FILLERS, MIN_SENTENCES, unitProblems } from "../src/path.ts";
import { sentencesOf, holedParts } from "../src/review.ts";
import { LANGUAGES } from "../src/languages.ts";

const vi = LANGUAGES["vi"];

/** A word that fills `{{food}}`. @param {string} id @param {string} word @param {Record<string, any>} [over] */
const food = (id, word, over = {}) => ({
  id, lang: "vi", category: "noun", fills: ["food"],
  forms: [{ id, ar: word, en: `${word} (en)`, lat: "" }], ...over,
});
/** A sentence with one blank. @param {string} id @param {string} verb */
const frame = (id, verb) => ({
  id, lang: "vi", forms: [{ id, ar: `tôi ${verb} {{food}}`, en: `I ${verb} {{food}}`, lat: "" }],
});
/** A sentence with no blank. @param {string} id */
const plain = (id) => ({ id, lang: "vi", forms: [{ id, ar: `xin chào ${id}`, en: `hello ${id}`, lat: "" }] });

/**
 * The card with its review approving exactly the sentences whose blank is
 * filled by one of `ids`, out of `pool`.
 * @param {any} card @param {any[]} pool @param {string[]} ids
 */
const approving = (card, pool, ids) => {
  const ok = holedParts(card).flatMap((part) =>
    sentencesOf(card, part, pool, vi).list.filter((s) => ids.includes(s.took.food.card)).map((s) => s.key));
  return { ...card, review: { ok, no: [] } };
};

const five = ["pho", "com", "banh", "bun", "che"].map((id) => food(id, id));
/** Five frames approving every food in `pool`. @param {any[]} pool */
const fiveFrames = (pool, ids = pool.filter((c) => c.fills).map((c) => c.id)) =>
  ["an", "nau", "mua", "thich", "ghet"].map((v, i) => approving(frame(`s${i}`, v), pool, ids));

test("the checklist's thresholds are the owner's five and five", () => {
  assert.equal(MIN_SENTENCES, 5);
  assert.equal(MIN_FILLERS, 5);
});

test("a unit that satisfies everything has nothing to fix", () => {
  const frames = fiveFrames(five);
  const cards = [...five, ...frames];
  assert.deepEqual(unitProblems({ cards, counting: cards, lang: vi }), []);
});

test("four sentences with a blank: one more is wanted", () => {
  const frames = fiveFrames(five).slice(0, 4);
  const cards = [...five, ...frames];
  const p = unitProblems({ cards, counting: cards, lang: vi });
  assert.deepEqual(p.filter((x) => x.kind === "few-sentences"), [{ kind: "few-sentences", have: 4, need: 5 }]);
});

test("a sentence with no blank does not count toward the five", () => {
  const frames = fiveFrames(five).slice(0, 4);
  const cards = [...five, ...frames, plain("hi")];
  const p = unitProblems({ cards, counting: cards, lang: vi });
  assert.ok(p.some((x) => x.kind === "few-sentences" && x.have === 4));
});

test("a blank with five fitting cards but three approved is short", () => {
  const frames = fiveFrames(five);
  frames[0] = approving(frame("s0", "an"), five, ["pho", "com", "banh"]);
  const cards = [...five, ...frames];
  const p = unitProblems({ cards, counting: cards, lang: vi });
  assert.deepEqual(p, [{ kind: "blank-short", cardId: "s0", partId: "s0", slot: "food", have: 3, need: 5 }]);
});

test("a blank's five may come from an earlier unit, or from names kept anywhere", () => {
  const mine = five.slice(0, 3);
  const earlier = five.slice(3);
  const pool = [...mine, ...earlier];
  const frames = fiveFrames(pool);
  assert.deepEqual(unitProblems({ cards: [...mine, ...frames], counting: [...pool, ...frames], lang: vi }), []);

  const names = [food("an-name", "Lan", { category: "name", drill: false }), food("minh", "Minh", { category: "person" })];
  const withNames = [...mine, ...names];
  const framesN = fiveFrames(withNames);
  const course = { id: "c", decks: ["u1"], path: ["u1"], pathLive: {} };
  const counting = countingCards({
    course, decks: [unit("u1")], unitId: "u1",
    cards: [...mine.map((c) => ({ ...c, decks: ["u1"] })), ...names.map((c) => ({ ...c, decks: [] })), ...framesN.map((c) => ({ ...c, decks: ["u1"] }))],
    deckIdsOf: (c) => c.decks,
  });
  assert.deepEqual(unitProblems({ cards: [...mine, ...framesN], counting, lang: vi }), [],
    "two names in no deck make up the five");
});

test("a word only in a later unit is not counted, even in an approved sentence", () => {
  const units = ["u1", "u2", "u3"].map(unit);
  const course = { id: "c", decks: ["u1", "u2", "u3"], path: ["u1", "u2", "u3"], pathLive: { u1: 1, u2: 1, u3: 1 } };
  const inUnit = (/** @type {any} */ c, /** @type {string} */ u) => ({ ...c, decks: [u] });
  const all = [...five.slice(0, 4).map((c) => inUnit(c, "u2")), inUnit(five[4], "u3")];
  const frames = fiveFrames(all).map((c) => inUnit(c, "u2"));
  const counting = countingCards({ course, decks: units, unitId: "u2", cards: [...all, ...frames], deckIdsOf: (c) => c.decks });
  assert.ok(!counting.some((c) => c.id === five[4].id), "the later unit's word is not among what counts");
  const p = unitProblems({ cards: [...all.slice(0, 4), ...frames], counting, lang: vi });
  assert.equal(p.filter((x) => x.kind === "blank-short").length, 5);
  assert.ok(p.every((x) => x.kind !== "blank-short" || x.have === 4));
});

test("a sentence card with no review has nothing approved", () => {
  const frames = fiveFrames(five);
  const { review: _r, ...bare } = frames[0];
  frames[0] = bare;
  const cards = [...five, ...frames];
  const p = unitProblems({ cards, counting: cards, lang: vi });
  assert.deepEqual(p.map((x) => x.kind), ["blank-short"]);
  assert.equal(/** @type {any} */ (p[0]).have, 0);
});

test("a word that fills no approved sentence of its own unit is unused; a name never is", () => {
  const extra = food("lau", "lau", { fills: ["soup"] });
  const name = food("hoa", "Hoa", { category: "name", fills: ["who"] });
  const frames = fiveFrames(five);
  const cards = [...five, ...frames, extra, name];
  const p = unitProblems({ cards, counting: cards, lang: vi });
  assert.deepEqual(p, [{ kind: "word-unused", cardId: "lau" }]);
});

test("two texts in one unit are one too many", () => {
  const text = (/** @type {string} */ id) => ({
    id, lang: "vi", sceneKind: "text", speakers: [], ar: "", en: id,
    lines: [{ id: `${id}-1`, ar: "tôi ăn phở", en: "I eat pho" }],
  });
  const frames = fiveFrames(five);
  const cards = [...five, ...frames, text("t1"), text("t2")];
  const p = unitProblems({ cards, counting: cards, lang: vi });
  assert.deepEqual(p, [{ kind: "two-finals", have: 2 }]);
});

test("numbers count toward a blank when a unit up to this one holds their part", () => {
  const num = (/** @type {number} */ n) => ({
    id: `num-${n}`, lang: "vi", kind: "phrase", fills: ["count"], drill: false, tags: [],
    forms: [{ id: `num-${n}-f0`, ar: `số ${n}`, en: String(n), lat: "" }],
    source: { systemId: "sys", slot: "fill:numbers:0-9" },
  });
  const fillers = [1, 2, 3, 4, 5].map(num);
  const counter = (/** @type {string} */ id, /** @type {string} */ v) => ({
    id, lang: "vi", forms: [{ id, ar: `tôi ${v} {{count}}`, en: `I ${v} {{count}}`, lat: "" }],
  });
  const approve = (/** @type {any} */ c) => {
    const ok = holedParts(c).flatMap((part) => sentencesOf(c, part, fillers, vi).list.map((s) => s.key));
    return { ...c, review: { ok, no: [] }, decks: ["u2"] };
  };
  const frames = ["dem", "co", "mua", "ban", "lay"].map((v, i) => approve(counter(`n${i}`, v)));
  const course = { id: "c", decks: ["u1", "u2"], path: ["u1", "u2"], pathLive: { u1: 1 } };
  const build = (/** @type {string[]} */ parts) => countingCards({
    course, decks: [{ ...unit("u1"), parts }, unit("u2")], unitId: "u2",
    cards: frames, deckIdsOf: (c) => c.decks || [], fillers,
  });
  const held = build(["numbers:0-9"]);
  assert.deepEqual(unitProblems({ cards: frames, counting: held, lang: vi }), []);
  const none = build([]);
  assert.equal(heldFillers(fillers, new Set()).length, 0);
  const p = unitProblems({ cards: frames, counting: none, lang: vi });
  assert.equal(p.length, 5);
  assert.ok(p.every((x) => x.kind === "blank-short" && x.have === 0));
});

/* ---- phase 4: the teacher's screens ---- */

import { problemLine, draftsLine, deleteUnitLine, sameFormBlanks, blankFills } from "../src/path.ts";
import { cardSentences } from "../src/review.ts";

test("what counts toward unit 2: unit 1's words and names anywhere, not unit 3's", () => {
  const course = { id: "c", decks: ["u1", "u2", "u3"], path: ["u1", "u2", "u3"], pathLive: { u1: 1, u2: 1, u3: 1 } };
  const units = ["u1", "u2", "u3"].map(unit);
  const cards = [
    food("early", "early", { decks: ["u1"] }),
    food("mine", "mine", { decks: ["u2"] }),
    food("later", "later", { decks: ["u3"] }),
    food("lan", "Lan", { decks: [], category: "name" }),
    food("loose", "loose", { decks: [] }),
  ];
  const ids = countingCards({ course, decks: units, unitId: "u2", cards, deckIdsOf: (/** @type {any} */ c) => c.decks, fillers: cards })
    .map((c) => c.id).sort();
  assert.deepEqual(ids, ["early", "lan", "mine"]);
});

test("the same unit in two courses can be clear in one and short in the other", () => {
  const units = ["u1", "u2"].map(unit);
  const inU = (/** @type {any} */ c, /** @type {string} */ u) => ({ ...c, decks: [u] });
  const words = [...five.slice(0, 3).map((c) => inU(c, "u2")), ...five.slice(3).map((c) => inU(c, "u1"))];
  const frames = fiveFrames(words).map((c) => inU(c, "u2"));
  const all = [...words, ...frames];
  const own = all.filter((c) => c.decks.includes("u2"));
  /* In A, unit 1 is published before it; in B it is a draft there. */
  const a = { id: "a", decks: ["u1", "u2"], path: ["u1", "u2"], pathLive: { u1: 1 } };
  const b = { id: "b", decks: ["u1", "u2"], path: ["u1", "u2"], pathLive: {} };
  const judge = (/** @type {any} */ course) => unitProblems({
    cards: own, lang: vi,
    counting: countingCards({ course, decks: units, unitId: "u2", cards: all, deckIdsOf: (c) => c.decks }),
  });
  assert.deepEqual(judge(a), []);
  assert.ok(judge(b).some((p) => p.kind === "blank-short"));
});

test("the checklist is said in the owner's words", () => {
  const text = (/** @type {string} */ id) => ({ s1: "tôi ăn {{food}}", w1: "phở" })[id] || id;
  assert.equal(problemLine({ kind: "few-sentences", have: 4, need: 5 }, text), "Add 1 more sentence with a blank (4 of 5)");
  assert.equal(problemLine({ kind: "few-sentences", have: 2, need: 5 }, text), "Add 3 more sentences with a blank (2 of 5)");
  assert.equal(problemLine({ kind: "blank-short", cardId: "s1", partId: "s1", slot: "food", have: 3, need: 5 }, text),
    '"tôi ăn {{food}}": the blank food has 3 of 5 approved cards from this unit or earlier ones');
  assert.equal(problemLine({ kind: "word-unused", cardId: "w1" }, text), '"phở" is not used in any sentence of this unit');
  assert.equal(problemLine({ kind: "two-finals", have: 2 }, text), "A unit can have only one text or conversation");
  assert.equal(draftsLine(1), "1 card is still a draft and is not counted");
  assert.equal(draftsLine(3), "3 cards are still drafts and are not counted");
  assert.equal(deleteUnitLine(1), "This unit is also in 1 other course. Deleting it removes it from both.");
  assert.equal(deleteUnitLine(2), "This unit is also in 2 other courses. Deleting it removes it from all of them.");
});

test("the review screen's sentences are not narrowed by the path", () => {
  /* A sentence in unit 1 and a word only in a later unit: the teacher's
     review list still offers it, exactly as before units existed. */
  const later = food("later", "later");
  const s = frame("s", "an");
  const listed = cardSentences(s, [...five, later], vi).flatMap((p) => p.list.map((x) => x.took.food.card));
  assert.ok(listed.includes("later"));
});

test("advice on forms lists a blank whose approved cards all share one form", () => {
  const ar = LANGUAGES["ar-PS"];
  const noun = (/** @type {string} */ id, /** @type {string} */ gender) => ({ id, forms: [{ id, ar: id, gender, number: "singular" }] });
  /** @type {Map<string, any>} */
  const byId = new Map([["a", noun("a", "m")], ["b", noun("b", "m")], ["c", noun("c", "f")]]);
  const fills = [
    { cardId: "s1", partId: "s1", slot: "x", cards: ["a", "b"] },
    { cardId: "s2", partId: "s2", slot: "y", cards: ["a", "c"] },
  ];
  const fields = (ar.grammar || []);
  assert.deepEqual(sameFormBlanks(fills, (id) => byId.get(id), fields).map((b) => b.cardId), ["s1"]);
  assert.deepEqual(sameFormBlanks(fills, (id) => byId.get(id), []), [], "a language with no grammar says nothing");
  assert.ok(Array.isArray(blankFills([], [], vi)));
});
