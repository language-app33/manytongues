// @ts-check
/*
 * Guards on what a learner's document may hold (0.626).
 *
 * Every device in the field drops what it does not know in a few places,
 * so anything new stored there is erased by the next sync from a device
 * that has not updated. These fail when a change adds to one of them; the
 * answer is to store the new thing somewhere older devices already carry
 * (a progress record under its own key, or the course record), not to
 * widen the list here without thinking about the devices still on it.
 *
 *   D2  no new top-level field on the document;
 *   D3  no new learner setting, and the retired names stay stripped;
 *   D4  a course refresh keeps only these of the learner's on a card;
 *   D5  every write to a progress record stamps `updated`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { buildOnce } from "./helpers.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, "..");
const built = await buildOnce(["ArabicTrainer.tsx"]);
const T = await import(path.join(built, "ArabicTrainer.js"));
const sharedDir = await buildOnce(["shared.tsx"]);
const { foldCourses } = await import(path.join(sharedDir, "shared.js"));
const { markedState } = await import(path.join(root, "src", "grade.ts"));
const { liftLevel, liftPass, reschedule, freshState } = await import(path.join(root, "src", "scheduler.ts"));

/** Every source file under a folder. */
function sources(/** @type {string} */ dir) {
  /** @type {string[]} */
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

/** The property names declared at the top level of a type in types.ts. */
function declared(/** @type {string} */ head) {
  const src = readFileSync(path.join(root, "src", "types.ts"), "utf8");
  const at = src.indexOf(head);
  assert.ok(at >= 0, `${head} is in types.ts`);
  let depth = 0;
  const names = [];
  for (const line of src.slice(at).split("\n")) {
    if (depth === 1) {
      const m = /^\s*(?:readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)\??\s*:/.exec(line);
      if (m && !/^\s*(\*|\/\/)/.test(line)) names.push(m[1]);
    }
    for (const ch of line.replace(/\/\*.*?\*\/|\/\/.*$/g, "")) {
      if (ch === "{") depth += 1;
      if (ch === "}") depth -= 1;
    }
    if (depth === 0 && names.length) break;
  }
  return names.sort();
}

test("D2: the document has the fields it had", () => {
  assert.deepEqual(declared("export interface Doc {"), [
    "items", "log", "moves", "parked", "prepLog", "settings", "settingsUpdated", "tombstones", "version",
  ]);
  assert.deepEqual(Object.keys(T.merge({})).sort(), ["items", "log", "parked", "settings", "settingsUpdated", "tombstones", "version"]);
});

test("D3: the learner's settings are read by the names they were, and the retired ones are stripped", () => {
  /* Settings are an open record, so the guard is on what the app reads
     from them: a new name here is a new setting, which syncs last writer
     wins as a whole and is erased by older devices' own saves. */
  const names = new Set();
  for (const file of sources(path.join(root, "src"))) {
    for (const m of readFileSync(file, "utf8").matchAll(/\bsettings\??\.([a-zA-Z_]+)/g)) names.add(m[1]);
  }
  assert.deepEqual([...names].sort(), [
    "foldFinals", "ignoreHamza", "keyboard", "kinds", "langsOff", "language", "niqqud", "pathReached",
    "savedSessions", "sounds", "tashkeel", "teachLangsOff", "theme", "tones",
  ]);
  const got = T.merge({ settings: { types: { x: 1 }, kinds: ["word"], skills: { a: 1 }, language: "ar-PS" } }).settings;
  for (const gone of ["types", "kinds", "skills"]) assert.equal(gone in got, false, `${gone} is stripped`);
});

test("D4: a course refresh keeps only these of the learner's on a card and its forms", () => {
  const mark = (/** @type {string} */ k) => `learner:${k}`;
  const existing = {
    id: "srvk1", source: { cardId: "k1" }, kind: "word", tags: [], created: 1, updated: 1,
    priority: true, priorityAt: 5, reset: 4, zzLearner: mark("card"),
    forms: [{ id: "srvk1", ar: "a", en: "a", s: { ar2en: { phase: "review", reps: 1, updated: 9 } }, met: { x: 1 }, zzLearner: mark("form") }],
  };
  const fresh = { id: "srvk1", source: { cardId: "k1" }, kind: "word", tags: [], created: 2, updated: 2, forms: [{ id: "srvk1", ar: "b", en: "b", s: {} }] };
  const out = foldCourses([existing], [fresh], {}).items[0];
  const fromLearner = Object.keys(out).filter((k) => !(k in fresh)).sort();
  assert.deepEqual(fromLearner, ["priority", "priorityAt", "reset"]);
  const formFromLearner = Object.keys(out.forms[0]).filter((k) => !(k in fresh.forms[0]) || k === "s").sort();
  assert.deepEqual(formFromLearner, ["met", "s"]);
  assert.equal(out.forms[0].s.ar2en.reps, 1);
});

test("D5: every write to a progress record stamps it", () => {
  const clock = { now: () => 1_000_000 };
  const before = freshState();
  for (const rating of ["again", "hard", "good", "easy"]) {
    for (const correct of [true, false]) {
      for (const advance of [true, false]) {
        const s = markedState(before, { rating, correct, advance }, {}, /** @type {any} */ (clock));
        assert.ok(s.updated > 0, `marked ${rating}/${correct}/${advance}`);
      }
    }
  }
  assert.ok(reschedule(before, "good").updated !== undefined, "reschedule carries the field");
  const keys = ["ar2pick", "ar2en", "en2pick", "en2ar"];
  for (const s of Object.values(liftLevel(keys, () => null, "ar2pick", /** @type {any} */ (clock)))) assert.ok(/** @type {any} */ (s).updated > 0);
  const solid = { ...freshState(), phase: "review", reps: 2, hist: [1, 1], right: 2 };
  for (const s of Object.values(liftPass(keys, () => solid, /** @type {any} */ (clock)))) assert.ok(/** @type {any} */ (s).updated > 0);
});
