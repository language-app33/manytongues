// @ts-check
/*
 * A form or a line the teacher removes keeps its students' progress
 * (0.624), and a form put where a removed one was does not inherit it
 * (0.625).
 *
 * A course refresh takes the teacher's card and folds the learner's
 * schedules into it form by form. A form the fresh copy no longer had was
 * simply not carried, and the loss spread through sync to every device;
 * and a fresh form that matched nothing by name was handed the schedule of
 * whatever form had stood in its place. Both now go through the drawer the
 * whole card's progress already goes into when a card leaves a course.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { buildOnce, must } from "./helpers.mjs";

const dir = await buildOnce(["shared.tsx"]);
const { foldCourses } = await import(path.join(dir, "shared.js"));
const syncDir = await buildOnce(["sync.ts"]);
const { mergeData } = await import(path.join(syncDir, "sync.js"));

/** @param {number} reps @param {number} [updated] */
const answered = (reps, updated = 1000) => ({ phase: "review", reps, right: reps, wrong: 0, updated, hist: [] });
/** @param {string} id @param {Record<string, any>} [s] */
const form = (id, s = {}) => ({ id, ar: id, en: id, lat: id, s });
/** @param {string} id @param {any[]} forms @param {any[]} [lines] */
const card = (id, forms, lines) => ({
  id, kind: "word", tags: ["Lesson"], source: { cardId: id.slice(3) }, created: 0, updated: 0, forms,
  ...(lines ? { lines } : null),
});
/** @param {any} item @param {string} id */
const formOf = (item, id) => must(item.forms.find((/** @type {any} */ f) => f.id === id), `form ${id}`);

test("a form the teacher removes has its progress set aside, not lost", () => {
  const had = [card("srvk1", [form("srvk1", { ar2en: answered(2) }), form("srvk1-f~pl", { ar2en: answered(5) })])];
  const fresh = [card("srvk1", [form("srvk1")])];
  const out = foldCourses(had, fresh, {});
  assert.deepEqual(out.items[0].forms.map((/** @type {any} */ f) => f.id), ["srvk1"], "the form is gone from the card");
  const aside = must(out.parked.srvk1, "the card's drawer");
  assert.equal(aside.forms["srvk1-f~pl"].s.ar2en.reps, 5, "and what was earned on it is in the drawer");
  assert.equal(aside.forms.srvk1, undefined, "the forms still on the card are not set aside");
});

test("a form that comes back has its progress given back, and the drawer forgets it", () => {
  const had = [card("srvk1", [form("srvk1", { ar2en: answered(2) }), form("srvk1-f~pl", { ar2en: answered(5) })])];
  const away = foldCourses(had, [card("srvk1", [form("srvk1")])], {});
  const back = foldCourses(away.items, [card("srvk1", [form("srvk1"), form("srvk1-f~pl")])], away.parked);
  assert.equal(formOf(back.items[0], "srvk1-f~pl").s.ar2en.reps, 5, "the plural is where it stood");
  assert.equal(formOf(back.items[0], "srvk1").s.ar2en.reps, 2, "and the card's own word kept its own");
  assert.equal(back.parked.srvk1, undefined, "nothing is left in the drawer for this card");
});

test("a form with nothing answered on it leaves nothing in the drawer", () => {
  const had = [card("srvk1", [form("srvk1", { ar2en: answered(2) }), form("srvk1-f~pl", {})])];
  const out = foldCourses(had, [card("srvk1", [form("srvk1")])], {});
  assert.equal(out.parked.srvk1, undefined);
});

test("a form that comes back with progress of its own keeps its own", () => {
  const parked = { srvk1: { at: 5, forms: { "srvk1-f~pl": { s: { ar2en: answered(5) } } } } };
  const had = [card("srvk1", [form("srvk1"), form("srvk1-f~pl", { en2ar: answered(1, 2000) })])];
  const out = foldCourses(had, [card("srvk1", [form("srvk1"), form("srvk1-f~pl")])], parked);
  const pl = formOf(out.items[0], "srvk1-f~pl");
  assert.equal(pl.s.en2ar.reps, 1, "its own work is kept");
  assert.equal(pl.s.ar2en, undefined, "and the drawer is not poured over it");
});

test("a conversation line the teacher removes is set aside and comes back", () => {
  const lines = [form("srvk2-l~a", { line: answered(3) }), form("srvk2-l~b", { line: answered(4) })];
  const had = [card("srvk2", [form("srvk2")], lines)];
  const away = foldCourses(had, [card("srvk2", [form("srvk2")], [form("srvk2-l~a")])], {});
  assert.equal(away.items[0].lines.length, 1);
  assert.equal(away.parked.srvk2.lines["srvk2-l~b"].s.line.reps, 4, "the removed line's work is in the drawer");
  const back = foldCourses(away.items, [card("srvk2", [form("srvk2")], [form("srvk2-l~a"), form("srvk2-l~b")])], away.parked);
  assert.equal(must(back.items[0].lines[1], "line b").s.line.reps, 4, "and comes back with the line");
  assert.equal(back.items[0].lines[0].s.line.reps, 3);
});

test("the set-aside work reaches the learner's other devices and comes back there too", () => {
  const had = [card("srvk1", [form("srvk1"), form("srvk1-f~pl", { ar2en: answered(5) })])];
  const away = foldCourses(had, [card("srvk1", [form("srvk1")])], {});
  const docA = { version: 1, items: away.items, tombstones: {}, parked: away.parked, log: {}, settings: {} };
  /* A device that never held the plural: the card as it is now. */
  const docB = { version: 1, items: [card("srvk1", [form("srvk1")])], tombstones: {}, parked: {}, log: {}, settings: {} };
  const merged = mergeData(docB, /** @type {any} */ (docA), 10_000);
  assert.ok(merged.parked && merged.parked.srvk1, "the drawer travels");
  const back = foldCourses(merged.items, [card("srvk1", [form("srvk1"), form("srvk1-f~pl")])], merged.parked);
  assert.equal(formOf(back.items[0], "srvk1-f~pl").s.ar2en.reps, 5, "the device that never saw it gets it back");
});

test("a device that never saw the form is unaffected by the drawer", () => {
  const parked = { srvk1: { at: 5, forms: { "srvk1-f~pl": { s: { ar2en: answered(5) } } } } };
  const had = [card("srvk1", [form("srvk1", { ar2en: answered(1) })])];
  const out = foldCourses(had, [card("srvk1", [form("srvk1")])], parked);
  assert.deepEqual(out.items[0].forms.map((/** @type {any} */ f) => f.id), ["srvk1"]);
  assert.equal(out.items[0].forms[0].s.ar2en.reps, 1);
  assert.equal(out.parked.srvk1.forms["srvk1-f~pl"].s.ar2en.reps, 5, "and the drawer keeps it for when it comes back");
});

test("a whole card leaving and coming back behaves as before", () => {
  const had = [card("srvk3", [form("srvk3", { ar2en: answered(2) }), form("srvk3-f~pl", { ar2en: answered(6) })])];
  const away = foldCourses(had, [], {});
  assert.deepEqual(away.goneIds, ["srvk3"]);
  assert.equal(away.parked.srvk3.forms["srvk3-f~pl"].s.ar2en.reps, 6);
  assert.equal(away.parked.srvk3.forms.srvk3.s.ar2en.reps, 2);
  const back = foldCourses(away.items, [card("srvk3", [form("srvk3"), form("srvk3-f~pl")])], away.parked);
  assert.equal(formOf(back.items[0], "srvk3").s.ar2en.reps, 2);
  assert.equal(formOf(back.items[0], "srvk3-f~pl").s.ar2en.reps, 6);
  assert.equal(back.parked.srvk3, undefined, "the drawer is emptied for it");
});

test("a card that leaves keeps a form set aside before it left", () => {
  const had = [card("srvk3", [form("srvk3", { ar2en: answered(2) }), form("srvk3-f~pl", { ar2en: answered(6) })])];
  const lessOne = foldCourses(had, [card("srvk3", [form("srvk3")])], {});
  const away = foldCourses(lessOne.items, [], lessOne.parked);
  assert.equal(away.parked.srvk3.forms["srvk3-f~pl"].s.ar2en.reps, 6, "the plural set aside earlier is still there");
  assert.equal(away.parked.srvk3.forms.srvk3.s.ar2en.reps, 2, "beside the card's own word");
});

test("a form brought back after the card was sent to the beginning gets nothing from before the reset", () => {
  const parked = { srvk1: { at: 5, forms: { "srvk1-f~pl": { s: { ar2en: answered(5, 1000) } } } } };
  const had = [{ ...card("srvk1", [form("srvk1")]), reset: 2000 }];
  const out = foldCourses(had, [card("srvk1", [form("srvk1"), form("srvk1-f~pl")])], parked);
  assert.equal(formOf(out.items[0], "srvk1-f~pl").s.ar2en, undefined);
});
