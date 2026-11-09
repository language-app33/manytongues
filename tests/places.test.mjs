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
