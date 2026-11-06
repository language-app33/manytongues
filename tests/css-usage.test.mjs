/*
 * Every class the stylesheets style is used somewhere (0.580, audit
 * finding 20).
 *
 * docs/UI-COMPONENTS.md said every `at-` class was referenced; the audit
 * found thirty that were not, left behind by markup that had gone. This is
 * what keeps the note true: each `.at-…` and `.ob-…` class named in a
 * selector in src/*.css must appear in some file under src/ (other than the
 * stylesheets) or in index.html.
 *
 * A class put together in code — `side${n}`, a tone from a table — never
 * appears whole, so those few are listed below, each with where it is made.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = path.join(root, "src");

/** Every file under a directory. @param {string} dir @returns {string[]} */
const filesIn = (dir) => readdirSync(dir).flatMap((n) => {
  const full = path.join(dir, n);
  return statSync(full).isDirectory() ? filesIn(full) : [full];
});

const sheets = filesIn(src).filter((f) => f.endsWith(".css"));
const code = filesIn(src).filter((f) => !f.endsWith(".css")).map((f) => readFileSync(f, "utf8"))
  .concat([readFileSync(path.join(root, "index.html"), "utf8")])
  .join("\n");

/* Made in code rather than written whole. */
const BUILT = new Set([
  /* CardTable's cells: at-cardtable-${column key} — shared.tsx, with the
     keys from the card columns in spaces.tsx. */
  "at-cardtable-meaning",
  "at-cardtable-status",
  "at-cardtable-word",
]);

/** The classes a stylesheet's selectors name. @param {string} css */
function classesIn(css) {
  const out = new Set();
  /* Selectors only: what is before each "{", comments taken out. */
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of bare.matchAll(/([^{}]+)\{/g)) {
    const sel = m[1];
    if (/^\s*@/.test(sel)) continue;
    for (const c of sel.matchAll(/\.((?:at|ob)-[A-Za-z0-9_-]+)/g)) out.add(c[1]);
  }
  return out;
}

/** Whether `name` appears in the code as a whole class name. @param {string} name */
const used = (name) => new RegExp(`(^|[^A-Za-z0-9_-])${name.replace(/[-]/g, "\\-")}($|[^A-Za-z0-9_-])`).test(code);

for (const sheet of sheets) {
  test(`every class ${path.basename(sheet)} styles is used`, () => {
    const dead = [...classesIn(readFileSync(sheet, "utf8"))].filter((c) => !BUILT.has(c) && !used(c)).sort();
    assert.deepEqual(dead, [], `styled but used nowhere: ${dead.join(", ")}`);
  });
}

export { classesIn, used };

/*
 * And the teaching screens' own sheet holds nothing a learner's screen
 * uses (0.580): it arrives only with the teaching code, so a class here
 * that a learner's screen also wore would be drawn unstyled until somebody
 * opened Teaching.
 */
test("no class in teaching.css is used by a learner's screen", () => {
  const LAZY = ["spaces.tsx", "card-editor.tsx", "number-system-editor.tsx", "gallery.tsx", "review-sheet.tsx", "pronouns-editor.tsx"];
  const learner = filesIn(src)
    .filter((f) => !f.endsWith(".css") && !LAZY.includes(path.basename(f)))
    .map((f) => readFileSync(f, "utf8"))
    .concat([readFileSync(path.join(root, "index.html"), "utf8")])
    .join("\n");
  const inLearner = (/** @type {string} */ name) =>
    new RegExp(`(^|[^A-Za-z0-9_-])${name.replace(/[-]/g, "\\-")}($|[^A-Za-z0-9_-])`).test(learner);
  const sheet = path.join(src, "teaching.css");
  const leaked = [...classesIn(readFileSync(sheet, "utf8"))].filter(inLearner).sort();
  assert.deepEqual(leaked, [], `learner screens use these, which only teaching.css styles: ${leaked.join(", ")}`);
});
