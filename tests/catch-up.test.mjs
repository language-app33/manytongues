// @ts-check
/*
 * Catch up: a custom session of what is due and nothing else (0.587).
 *
 * The owner's four answers, each held here:
 *
 * - **Reviews only** — Cleared and Learnt cards whose review has come
 *   round (0.603; until then cards in learning came too, and their newly
 *   opened questions kept the home screen's count from ever going down).
 *   No card still climbing, and no new card, ever.
 * - **Only the questions due** on each card, none brought forward.
 * - **A length, or everything due.** A length cuts it; "everything due"
 *   (no count, no minutes) asks it all. Neither pads a short session with
 *   questions not yet due.
 * - **Longest waiting first** when more is due than fits.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOnce } from "./helpers.mjs";
import path from "node:path";

let rolling = 20261108 >>> 0;
Math.random = () => {
  rolling = (Math.imul(rolling, 1664525) + 1013904223) >>> 0;
  return rolling / 4294967296;
};

const here = path.dirname(new URL(import.meta.url).pathname);
const built = await buildOnce(["ArabicTrainer.tsx"]);
const { buildManualSession, installIndexes, dueForReview } = await import(path.join(built, "ArabicTrainer.js"));
const { TYPES } = await import(path.join(here, "..", "src", "languages.ts"));
const { freshState } = await import(path.join(here, "..", "src", "scheduler.ts"));

const settings = { language: "ar-PS" };
const DAY = 86400000;
const NOW = Date.now();

/** @param {Record<string, any>} over */
const state = (over) => ({ ...freshState(), ...over });
/** A review come round, `days` days ago. @param {number} days */
const reviewDue = (days) => state({ phase: "review", interval: 4, due: NOW - days * DAY, reps: 2, right: 2, hist: [1, 1], updated: NOW - (days + 4) * DAY });
const reviewLater = () => state({ phase: "review", interval: 20, due: NOW + 10 * DAY, reps: 4, right: 4, hist: [1, 1], updated: NOW - DAY });
/** The same, with its two passes made: Learnt rather than Cleared. @param {number} days */
const learntDue = (days) => ({ ...reviewDue(days), passes: 2 });
const learningDue = () => state({ phase: "learning", interval: 0, due: NOW - 60000, reps: 1, right: 1, hist: [1], updated: NOW - DAY });

/** A word whose every question is in the state `s` makes, or new.
    @param {number} i @param {(() => any) | null} s */
const word = (i, s) => ({
  id: `w${i}`, tags: ["Deck"], created: i, lang: "ar-PS", kind: "word",
  forms: [{ id: `w${i}`, ar: `كلمة${i}`, en: `word ${i}`, lat: `kalima${i}`, lang: "ar-PS",
    s: s ? Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, s()])) : {} }],
});

/** @param {any[]} items @param {Record<string, any>} o */
const catchUp = (items, o = {}) => {
  installIndexes(items, settings);
  return buildManualSession({ items, settings, ids: items.map((i) => i.id), mode: "catchup", ...o });
};

test("Catch up asks Cleared and Learnt cards that are due, and nothing still climbing or new", () => {
  const items = [
    ...[1, 2].map((i) => word(i, () => reviewDue(2))),
    word(3, () => learntDue(2)),
    ...[4, 5].map((i) => word(i, learningDue)),
    ...[6, 7, 8].map((i) => word(i, null)),
    ...[9, 10].map((i) => word(i, reviewLater)),
  ];
  const got = catchUp(items, { count: 999 });
  const ids = new Set(got.exercises.map((/** @type {any} */ e) => e.id));
  for (const id of ["w1", "w2", "w3"]) assert.ok(ids.has(id), `${id} is due for review and was left out`);
  for (const id of ["w4", "w5"]) assert.ok(!ids.has(id), `${id} is still being learnt and was brought in`);
  for (const id of ["w6", "w7", "w8"]) assert.ok(!ids.has(id), `${id} is new and was brought in`);
  for (const id of ["w9", "w10"]) assert.ok(!ids.has(id), `${id} is not due and was brought forward`);
});

test("the home screen's review count is exactly what Catch up asks", () => {
  /* A card climbing with a level just opened above what it has passed:
     the case that kept the count up however much was caught up on. */
  const climbing = word(11, () => reviewDue(2));
  const f = climbing.forms[0];
  const writing = TYPES.filter((/** @type {string} */ t) => /^en2ar/.test(t));
  for (const t of writing) f.s[t] = freshState();
  const items = [
    word(1, () => reviewDue(2)),
    word(2, () => learntDue(3)),
    word(3, learningDue),
    word(4, null),
    word(5, reviewLater),
    climbing,
  ];
  const got = catchUp(items, { count: 999 });
  const asked = new Set(got.exercises.map((/** @type {any} */ e) => e.id));
  const counted = new Set(items.filter((it) => dueForReview(it, settings, items)).map((it) => it.id));
  assert.deepEqual([...counted].sort(), ["w1", "w2"]);
  assert.deepEqual([...asked].sort(), [...counted].sort(), "the count and the session disagree");
});

test("only the questions due on a card are asked", () => {
  /* One word with one question due and the rest not. */
  const half = word(1, null);
  const f = half.forms[0];
  f.s = Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, reviewLater()]));
  const dueType = "en2ar";
  f.s[dueType] = reviewDue(1);
  const items = [half, ...[2, 3].map((i) => word(i, reviewLater))];
  const got = catchUp(items, { count: 999 });
  const asked = got.exercises.filter((/** @type {any} */ e) => e.id === "w1");
  assert.ok(asked.length > 0, "the due question was not asked");
  for (const e of asked) assert.equal(e.type.split("@")[0], dueType.split("@")[0], `asked ${e.type}, which is not due`);
});

test("nothing due says so rather than starting", () => {
  const items = [...[1, 2].map((i) => word(i, reviewLater)), word(3, null)];
  const got = catchUp(items, { count: 20 });
  assert.equal(got.exercises.length, 0);
  assert.equal(got.reason, "caught-up");
});

test("a length cuts it, longest waiting first, and is never padded", () => {
  /* Thirty words due, w1 the longest waiting. */
  const items = Array.from({ length: 30 }, (_, k) => word(k + 1, () => reviewDue(30 - k)));
  const short = catchUp(items, { count: 10 });
  assert.ok(short.exercises.length >= 10 && short.exercises.length <= 14, `${short.exercises.length} questions for a length of 10`);
  const ids = new Set(short.exercises.map((/** @type {any} */ e) => e.id));
  assert.ok(ids.has("w1"), "the longest waiting was left out");
  assert.ok(!ids.has("w30"), "the most recently due came in ahead of older ones");

  const all = catchUp(items, { count: 999 });
  assert.equal(new Set(all.exercises.map((/** @type {any} */ e) => e.id)).size, 30, "everything due is every card due");

  /* A few due and a long length: what is due, and no more. */
  const few = [word(1, () => reviewDue(1)), ...[2, 3, 4, 5].map((i) => word(i, reviewLater))];
  const got = catchUp(few, { count: 50 });
  assert.ok(got.exercises.length > 0);
  assert.ok(got.exercises.every((/** @type {any} */ e) => e.id === "w1"), "padded with cards not due");
});
