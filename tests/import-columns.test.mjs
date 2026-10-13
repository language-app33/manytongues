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
import { build } from "esbuild";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".import-columns-build");

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
const { parseLines } = await import(path.join(out, "trainer.js"));
const { splitAlternatives } = await import(path.join(here, "..", "src", "answers.ts"));

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
