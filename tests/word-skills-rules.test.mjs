// @ts-check
/*
 * Practice by skill: the rules (stage D), one sentence a test. Run with
 * the rules switched on here whatever the app's switch says.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { buildOnce } from "./helpers.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const built = await buildOnce(["ArabicTrainer.tsx"]);
const T = await import(path.join(built, "ArabicTrainer.js"));
const { standing } = await import(path.join(here, "..", "src", "scheduler.ts"));
const { typeOf } = await import(path.join(here, "..", "src", "languages.ts"));

const settings = { language: "ar-PS" };
T.setOfflineNow(false);
T.setAudibleClips(null);
const was = T.wordSkillsOn();
after(() => T.setWordSkills(was));

const NOW = Date.UTC(2026, 10, 15, 9);
/** @param {number[]} hist @param {number} [passes] */
const st = (hist, passes = 0) => ({
  phase: hist.length ? "review" : "new", step: 0, ease: 2.5, interval: 10, due: NOW - 1000, reps: hist.length,
  lapses: 0, right: hist.filter(Boolean).length, wrong: hist.filter((x) => !x).length, skips: 0, near: 0, hints: 0,
  hist, passes, updated: NOW - 86400000,
});
const RIGHT2 = [1, 1];
/** @param {string} k @param {Record<string, any>} [extra] @param {Record<string, any>} [s] */
const word = (k, extra = {}, s = {}) => ({
  id: k, kind: "word", tags: ["Deck"], created: 1, updated: 1, lang: "ar-PS",
  forms: [{ id: k, ar: `كلمة${k}`, en: `word ${k}`, lat: `kalima${k}`, lang: "ar-PS", recs: [], s, ...extra }],
});
const rec = (/** @type {string} */ id) => [{ id, label: "", speed: "", mime: "", size: 0, dur: 0 }];
const company = Array.from({ length: 8 }, (_, i) => word(`m${i}`, { recs: rec(`c${i}`) }));

/** Installs these cards and gives what the first form is dealt and climbs with. */
function at(/** @type {any} */ it, on = true) {
  T.setWordSkills(on);
  T.installIndexes([it, ...company], settings);
  const f = it.forms[0];
  const types = (/** @type {string[]} */ ks) => [...new Set(ks.map(typeOf))].sort();
  const row = standing(T.cardStandings(it, settings));
  return { dealt: types(T.dealtNow(f, settings)), ladder: types(T.laddered(f, settings)), status: row ? row.status : "none", on: T.onSkillRules(f) };
}
const withS = (/** @type {any} */ it, /** @type {Record<string, any>} */ s) => ({ ...it, forms: [{ ...it.forms[0], s }] });

const plain = word("w1");
const heard = word("w2", { recs: rec("clip-w2") });

test("a plain word is on the skill rules, and a form with an unmapped type is not", () => {
  assert.equal(at(plain).on, true);
  const cell = { ...plain, forms: [{ ...plain.forms[0], row: "attached", col: "me" }] };
  assert.equal(at(cell).on, false, "a cell of a table stays on the levels");
  assert.equal(at(plain, false).on, false, "and nothing is, with the rules off");
});

test("R1, R2: a new word is asked what it means first, and nothing to write yet", () => {
  const { dealt } = at(plain);
  assert.ok(dealt.includes("ar2pick") || dealt.includes("match"), `dealt ${dealt}`);
  for (const t of ["en2ar", "tr2ar", "en2pick", "ar2en"]) assert.equal(dealt.includes(t), false, `${t} waits`);
});

test("R2: writing what you hear opens once anything has been answered", () => {
  const { dealt } = at(withS(plain, { ar2pick: st([1]) }));
  assert.ok(dealt.includes("tr2ar"), `dealt ${dealt}`);
});

test("R3: one recognise exercise right twice running passes the step, and the proof comes next", () => {
  const { dealt } = at(withS(plain, { ar2pick: st(RIGHT2) }));
  assert.ok(dealt.includes("ar2en"), `dealt ${dealt}`);
  assert.equal(dealt.includes("match"), false, "the other recognise exercise is not needed");
});

test("R2: writing from the meaning opens once understanding it is proven", () => {
  const before = at(withS(plain, { ar2pick: st(RIGHT2) })).dealt;
  assert.equal(before.includes("en2pick"), false);
  const after_ = at(withS(plain, { ar2pick: st(RIGHT2), ar2en: st(RIGHT2) })).dealt;
  assert.ok(after_.includes("en2pick"), `dealt ${after_}`);
  assert.equal(after_.includes("ar2pick") || after_.includes("ar2en"), false, "a proven skill's exercises are retired");
});

test("R4: with a recording, writing what is heard goes recognise, then the transliteration, then the proof", () => {
  const s = { ar2pick: st([1]) };
  const first = at(withS(heard, s)).dealt;
  assert.ok(first.includes("recmatch") && !first.includes("tr2ar") && !first.includes("rec2ar"), `dealt ${first}`);
  const stone = at(withS(heard, { ...s, recmatch: st(RIGHT2) })).dealt;
  assert.ok(stone.includes("tr2ar") && !stone.includes("rec2ar"), `dealt ${stone}`);
  const next = at(withS(heard, { ...s, tr2ar: st(RIGHT2), recmatch: st(RIGHT2) })).dealt;
  assert.ok(next.includes("rec2ar") && !next.includes("tr2ar"), `dealt ${next}`);
});

test("R5: a proof whose last answer was right is asked again to finish its run", () => {
  const s = { ar2pick: st(RIGHT2), ar2en: st([1]) };
  assert.ok(at(withS(plain, s)).dealt.includes("ar2en"));
});

const clearedStates = () => ({
  ar2pick: st(RIGHT2), ar2en: st(RIGHT2), en2pick: st(RIGHT2), en2ar: st(RIGHT2), tr2ar: st(RIGHT2),
});

test("R7: every skill proven is Cleared — without every recognise exercise", () => {
  assert.equal(at(withS(plain, clearedStates())).status, "cleared");
  assert.notEqual(at(withS(plain, clearedStates()), false).status, "cleared", "the levels wanted match too");
});

test("R8: two passes on writing it from its meaning is Learnt", () => {
  assert.equal(at(withS(plain, { ...clearedStates(), en2ar: st(RIGHT2, 2) })).status, "done");
});

test("R9: a cleared word is asked only writing it from its meaning", () => {
  assert.deepEqual(at(withS(plain, clearedStates())).dealt, ["en2ar"]);
});

test("R10: two misses on the proof make it Learning, and the easier exercises do not come back", () => {
  const s = { ...clearedStates(), en2ar: st([1, 1, 0, 0], 0) };
  const got = at(withS(plain, s));
  assert.equal(got.status === "cleared" || got.status === "done", false);
  assert.deepEqual(got.dealt, ["en2ar"]);
  assert.notEqual(at(withS(plain, { ...clearedStates(), en2ar: st([1, 1, 0]) })).status, "learning", "one miss changes nothing");
});

test("R13: a sentence's word counts as known once understanding it is proven", () => {
  T.setWordSkills(true);
  const it = withS(plain, { ar2pick: st(RIGHT2), ar2en: st(RIGHT2) });
  T.installIndexes([it, ...company], settings);
  assert.equal(T.gateReached(it.forms[0], settings), true);
  const not = withS(plain, { ar2pick: st(RIGHT2) });
  T.installIndexes([not, ...company], settings);
  assert.equal(T.gateReached(not.forms[0], settings), false);
});

test("D6, R14: a learnt word that gains a recording stays learnt, and the new skill joins its reviews", () => {
  const s = { ...clearedStates(), en2ar: st(RIGHT2, 2) };
  const got = at(withS(heard, s));
  assert.equal(got.status, "done");
  assert.ok(got.dealt.includes("en2ar"));
  assert.ok(got.dealt.some((t) => ["rec2img", "recmatch", "rec2en", "rec2ar", "tr2ar"].includes(t)), `dealt ${got.dealt}`);
});

test("R14: every form cleared or learnt on the levels is so on the skill rules", () => {
  /* Generated: every key the form has on the levels, each in one of a few
     states, over many combinations. */
  const pool = [st([]), st([1]), st(RIGHT2), st([1, 1, 0]), st([0, 0]), st(RIGHT2, 1), st(RIGHT2, 2)];
  let seed = 7;
  const roll = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let checked = 0;
  for (const base of [plain, heard]) {
    T.setWordSkills(false);
    T.installIndexes([base, ...company], settings);
    const keys = T.laddered(base.forms[0], settings);
    for (let n = 0; n < 300; n++) {
      const s = Object.fromEntries(keys.map((/** @type {string} */ k) => [k, pool[Math.floor(roll() * pool.length)]]));
      const it = withS(base, s);
      const levels = at(it, false).status;
      if (levels !== "cleared" && levels !== "done") continue;
      checked++;
      const skills = at(it, true).status;
      assert.ok(skills === "cleared" || skills === "done", `${JSON.stringify(s)} was ${levels}, now ${skills}`);
      if (levels === "done") assert.equal(skills, "done", `${JSON.stringify(s)} was learnt`);
    }
  }
  assert.ok(checked > 5, `only ${checked} cleared cases generated`);
});
