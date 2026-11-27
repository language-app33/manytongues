/*
 * Nothing in the app is written in a way an older iPhone cannot read.
 *
 * A pattern with a look-behind in it is a syntax error to Safari before
 * 16.4, and the build cannot rewrite one: it hands it over as it is. One
 * such pattern anywhere in the bundle and the app does not start there at
 * all — a blank page, with no message, which is what every iPhone on iOS
 * 16.3 or older got until 0.730 (docs/AUDIT-safari-ios.md). The build
 * rewrites newer syntax for older browsers but not this, so it is checked
 * here, in the source.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const src = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "src");

/** @param {string} dir @returns {string[]} */
const filesIn = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesIn(path.join(dir, e.name)) : /\.(ts|tsx|js)$/.test(e.name) ? [path.join(dir, e.name)] : [],
  );

test("no pattern in the app looks behind", () => {
  /** @type {string[]} */
  const found = [];
  for (const file of filesIn(src)) {
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (/\(\?<[=!]/.test(line)) found.push(`${path.relative(src, file)}:${i + 1}`);
    });
  }
  assert.deepEqual(found, [], "a look-behind stops the app starting on Safari before 16.4: match what comes before and step over it instead");
});
