// @ts-check
/*
 * Practice by skill: the map (stage C). Every exercise type is either in
 * the map, with its skill, step and where its meaning is, or named as not a
 * word skill — so a new type cannot be forgotten.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const { TYPES, EX } = await import(path.join(here, "..", "src", "languages.ts"));
const W = await import(path.join(here, "..", "src", "word-skills.ts"));

test("every exercise type is in the map or named as not a word skill", () => {
  const loose = TYPES.filter((/** @type {string} */ t) => !W.WORD_SKILL_MAP[t] && !W.NOT_A_WORD_SKILL.includes(t));
  assert.deepEqual(loose, []);
  const both = TYPES.filter((/** @type {string} */ t) => W.WORD_SKILL_MAP[t] && W.NOT_A_WORD_SKILL.includes(t));
  assert.deepEqual(both, []);
});

test("the map is the plan's table", () => {
  const row = (/** @type {string} */ t) => {
    const s = W.skillOf(t);
    return s ? `${s.skill} ${s.step} ${s.meaning}` : "";
  };
  assert.equal(row("ar2en"), "US produce english");
  assert.equal(row("rec2img"), "UH recognise picture");
  assert.equal(row("rec2en"), "UH produce english");
  assert.equal(row("tr2ar"), "WH produce none");
  assert.equal(row("en2pick"), "WM recognise english");
  assert.equal(row("img2ar"), "WM produce picture");
  assert.equal(row("ctx2ar"), "WM produce language");
  assert.equal(row("own2ar"), "WM produce figures");
  assert.equal(W.counts("sort"), false, "sorting into two baskets is practice only");
  assert.equal(W.counts("ar2pick"), true);
});

test("every mapped type that exists today has a level", () => {
  for (const t of Object.keys(W.WORD_SKILL_MAP)) {
    if (!EX[t]) continue;
    assert.ok(EX[t].level >= 1 && EX[t].level <= 4, t);
  }
});
