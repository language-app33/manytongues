// @ts-check
/*
 * Ten thousand in Hebrew (0.742).
 *
 * Ten in front of thousands takes the bound form and the plural, like three
 * to nine: עשרת אלפים. But only once the teacher has written ten's box for
 * "before thousands". A system without it keeps saying what it always said,
 * עשרה אלף, and reports the gap; it must never borrow the masculine for the
 * bound form and come out with עשרה אלפים, which is wrong both ways.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { renderHe, HE_SLOTS } from "../src/numbers/he-IL.ts";

const GOLDEN = JSON.parse(
  readFileSync(new URL("./golden/he-IL.numbers.json", import.meta.url), "utf8"),
);

/** The golden system, with or without ten's bound form. */
const systemWith = (/** @type {boolean} */ bound) => {
  const sys = structuredClone(GOLDEN.system);
  if (!bound) delete sys.lexemes["unit.10"].forms["construct.m"];
  return sys;
};

const tenGap = (/** @type {any[]} */ warnings) =>
  warnings.some((w) => w.code === "missing-form" && w.slot === "unit.10" && w.formKey === "construct.m");

test("ten has a box for before thousands, and one still has none", () => {
  const ten = HE_SLOTS.find((s) => s.slot === "unit.10");
  const one = HE_SLOTS.find((s) => s.slot === "unit.1");
  assert.deepEqual(ten?.formKeys, ["standalone", "m", "f", "construct.m"]);
  assert.deepEqual(one?.formKeys, ["standalone", "m", "f"]);
  assert.match(String(ten?.hint), /bound form used before thousands/);
});

test("without the bound ten, ten thousand is said as before and the gap is reported", () => {
  const got = renderHe(10000, systemWith(false));
  assert.equal(got.text, "עשרה אלף");
  assert.ok(tenGap(got.warnings), JSON.stringify(got.warnings));
});

test("with the bound ten, ten thousand takes it and the plural, and nothing is missing", () => {
  const got = renderHe(10000, systemWith(true));
  assert.equal(got.text, "עשרת אלפים");
  assert.ok(!tenGap(got.warnings), JSON.stringify(got.warnings));
});

test("the numbers around ten thousand are unchanged either way", () => {
  const same = {
    3000: "שלושת אלפים",
    11000: "אחד עשר אלף",
    12000: "שנים עשר אלף",
    20000: "עשרים אלף",
    110000: "מאה ועשרה אלף",
    10000000: "עשרה מיליון",
  };
  for (const bound of [false, true]) {
    for (const [n, text] of Object.entries(same)) {
      const got = renderHe(Number(n), systemWith(bound));
      assert.equal(got.text, text, `${n} (bound ten ${bound ? "written" : "empty"})`);
      assert.ok(!tenGap(got.warnings), `${n} reported ten's gap`);
    }
  }
});
