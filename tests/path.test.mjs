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

