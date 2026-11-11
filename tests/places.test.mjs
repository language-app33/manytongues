/*
 * Where you are (0.574): the places at the top of the You menu, which of
 * them is current, and the modes in the toggle at its foot.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { placeRows } from "../src/places.ts";

const A = { id: "a", slug: "alpha", name: "Alpha" };
const B = { id: "b", slug: "beta", name: "Beta" };
const C = { id: "c", slug: "gamma", name: "Gamma" };
const base = { admin: false, orgAdmin: false, teaches: false, trying: false, space: "learn", mine: [A], opened: null, hereId: "a" };
const ids = (/** @type {{ id: string }[]} */ rows) => rows.map((r) => r.id);

test("a learner in one space has no places to choose and Learning alone", () => {
  const r = placeRows(base);
  assert.deepEqual(r.places, []);
  assert.deepEqual(r.modes, ["learn"]);
  assert.equal(r.placeNow, "a");
});

test("a learner in two spaces chooses between them, with no Super admin", () => {
  const r = placeRows({ ...base, mine: [A, B] });
  assert.deepEqual(ids(r.places), ["a", "b"]);
  assert.deepEqual(r.modes, ["learn"]);
});

test("a teacher has Learning and Teaching", () => {
  assert.deepEqual(placeRows({ ...base, teaches: true, space: "teach" }).modes, ["learn", "teach"]);
});

test("a space admin has Learning, Teaching and Admin, and no Super admin", () => {
  const r = placeRows({ ...base, orgAdmin: true });
  assert.deepEqual(r.modes, ["learn", "teach", "admin"]);
  assert.deepEqual(r.places, []);
});

test("the App admin at home in one space: Super admin, then their space", () => {
  const r = placeRows({ ...base, admin: true });
  assert.deepEqual(ids(r.places), ["super", "a"]);
  assert.equal(r.places[0].label, "Super admin");
  assert.equal(r.placeNow, "a");
  assert.deepEqual(r.modes, ["learn", "teach", "admin"]);
});

test("the App admin at home in two spaces lists both", () => {
  const r = placeRows({ ...base, admin: true, mine: [A, B], hereId: "b" });
  assert.deepEqual(ids(r.places), ["super", "a", "b"]);
  assert.equal(r.placeNow, "b");
});

test("the App admin at Super admin has no toggle", () => {
  const r = placeRows({ ...base, admin: true, space: "super" });
  assert.equal(r.placeNow, "super");
  assert.deepEqual(r.modes, []);
  assert.deepEqual(ids(r.places), ["super", "a"]);
});

test("the App admin in an opened space: three places, three modes, the opened one current", () => {
  const r = placeRows({ ...base, admin: true, trying: true, opened: C, hereId: "c", space: "admin" });
  assert.deepEqual(ids(r.places), ["super", "a", "c"]);
  assert.equal(r.places[2].slug, "gamma");
  assert.equal(r.placeNow, "c");
  assert.deepEqual(r.modes, ["learn", "teach", "admin"]);
});

/* ---- the line and the sheet (0.601) ---- */
import { whereRows, langsSummary } from "../src/places.ts";
const w = (/** @type {any} */ over) => whereRows({ ...base, filter: "", langs: 1, ...over });

test("someone in one space who only learns, in one language, has no line", () => {
  const r = w({});
  assert.equal(r.shown, false);
  assert.deepEqual(ids(r.rows), ["a"]);
});

test("one language more is enough for a line, naming the mode", () => {
  const r = w({ langs: 2 });
  assert.equal(r.shown, true);
  assert.equal(r.label, "Learning");
});

test("a learner in two spaces: all of them, then each, and the line says which", () => {
  const r = w({ mine: [A, B] });
  assert.deepEqual(ids(r.rows), ["all", "a", "b"]);
  assert.equal(r.now, "all");
  assert.equal(r.label, "All your spaces · Learning");
  assert.equal(w({ mine: [A, B], filter: "b" }).label, "Beta · Learning");
  assert.equal(w({ mine: [A, B], filter: "gone" }).now, "all");
});

test("every space offers what you can do there, beside its name (0.610)", () => {
  const r = w({ mine: [A, B], teaches: true, space: "teach" });
  assert.deepEqual(r.rows.find((x) => x.id === "a")?.modes, ["learn", "teach"]);
  /* Only learning in Beta: its name is the way to learn there, no buttons. */
  assert.deepEqual(r.rows.find((x) => x.id === "b")?.modes, []);
  assert.equal(r.now, "a");
  assert.equal(r.label, "Alpha · Teaching");
  assert.equal("what" in (r.rows[0] || {}), false);
  const t = w({ mine: [A, { ...B, teaches: true }] });
  assert.deepEqual(t.rows.find((x) => x.id === "b")?.modes, ["learn", "teach"]);
  const ru = w({ mine: [A, { ...B, runs: true }] });
  assert.deepEqual(ru.rows.find((x) => x.id === "b")?.modes, ["learn", "teach", "admin"]);
});

test("the super admin is offered every mode in each of their spaces", () => {
  const r = w({ admin: true, mine: [A, B], space: "super" });
  assert.deepEqual(r.rows.find((x) => x.id === "b")?.modes, ["learn", "teach", "admin"]);
});

test("a space admin in one space: the space, its three modes, no place name", () => {
  const r = w({ orgAdmin: true, space: "admin" });
  assert.deepEqual(ids(r.rows), ["a"]);
  assert.deepEqual(r.rows[0].modes, ["learn", "teach", "admin"]);
  assert.equal(r.label, "Admin");
  assert.equal(r.shown, true);
});

test("the super admin: Super admin first, and their space keeps its modes from there", () => {
  const r = w({ admin: true, space: "super" });
  assert.deepEqual(ids(r.rows), ["super", "a"]);
  assert.equal(r.now, "super");
  assert.equal(r.label, "Super admin");
  assert.deepEqual(r.rows[1].modes, ["learn", "teach", "admin"]);
});

test("an opened space is marked and current, with every mode", () => {
  const r = w({ admin: true, trying: true, opened: C, hereId: "c", space: "admin" });
  assert.deepEqual(ids(r.rows), ["super", "a", "c"]);
  const c = r.rows.find((x) => x.id === "c");
  assert.equal(c?.opened, true);
  assert.deepEqual(c?.modes, ["learn", "teach", "admin"]);
  assert.equal(r.label, "Gamma · Admin");
  assert.equal(r.multi, false);
});

test("the languages part of the line", () => {
  assert.equal(langsSummary(["Arabic"], 1), "");
  assert.equal(langsSummary(["Arabic", "Hebrew"], 2), "");
  assert.equal(langsSummary(["Arabic"], 2), "Arabic only");
  assert.equal(langsSummary(["Arabic", "Hebrew"], 3), "2 of 3 languages");
});

test("an account with no space named yet still has its modes, under Your space", () => {
  const r = w({ mine: [], hereId: "", teaches: true });
  assert.deepEqual(r.rows.map((x) => x.label), ["Your space"]);
  assert.deepEqual(r.rows[0].modes, ["learn", "teach"]);
  assert.equal(r.label, "Learning");
});

test("the line in two parts, so a long place gives way and the mode stays", () => {
  assert.deepEqual(w({ mine: [A, B], teaches: true, space: "teach" }).parts, { place: "Alpha", mode: "Teaching" });
  assert.deepEqual(w({ orgAdmin: true }).parts, { place: "", mode: "Learning" });
  assert.deepEqual(w({ admin: true, space: "super" }).parts, { place: "Super admin", mode: "" });
});
