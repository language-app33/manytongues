/*
 * A pasted table, one answer to a cell.
 *
 * Since 0.439 nothing written inside an answer splits it — not a slash, a
 * semicolon or a comma — so a second accepted answer has a column of its
 * own: "English 2", "Arabic 2", "Transliteration 2", numbered from the
 * column that has no number.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
/* Read straight from the module it lives in (0.580): it used to be built
   out of the whole trainer for the sake of this one function. */
import { parseLines } from "../src/imports.ts";
import { splitAlternatives } from "../src/answers.ts";

test("numbered columns are further accepted answers", () => {
  const [row] = parseLines([
    "| English | English 2 | Arabic | Arabic 2 | Transliteration 2 |",
    "| --- | --- | --- | --- | --- |",
    "| office | desk | مكتب | طاولة | taawle |",
  ].join("\n"));
  assert.deepEqual(splitAlternatives(row.en), ["office", "desk"]);
  assert.deepEqual(splitAlternatives(row.ar), ["مكتب", "طاولة"]);
  assert.deepEqual(splitAlternatives(row.lat), ["", "taawle"], "the transliteration stays beside its own word");
});

test("a slash, a semicolon or a comma in a cell is part of the answer", () => {
  const [row] = parseLines([
    "| English | Arabic |",
    "| --- | --- |",
    "| If it were possible / you could; a, b | لو بينفع/ ممكن |",
  ].join("\n"));
  assert.deepEqual(splitAlternatives(row.en), ["If it were possible / you could; a, b"]);
  assert.deepEqual(splitAlternatives(row.ar), ["لو بينفع/ ممكن"]);
});

test("a numbered field can be named in the cell too", () => {
  const [row] = parseLines("en: office\ten2: desk\tar: مكتب");
  assert.deepEqual(splitAlternatives(row.en), ["office", "desk"]);
});
