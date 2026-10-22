/*
 * The table of gaps in the README, replayed against the scheduler.
 *
 * The README says how long a card waits after each right answer, from the
 * first time it is asked to the year it settles at. Those numbers are not
 * stored anywhere — they fall out of the learning steps, the starting ease
 * and the 5% spread — so this walks one question through `reschedule`,
 * answering right on the minute it falls due, and checks every row.
 *
 * Twice: with the spread at its lowest and at its highest. Each gap only
 * grows with the one before it and with the spread, so those two walks are
 * the ends of every row's range.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DAY, MIN, freshState, reschedule } from "../src/scheduler.ts";
import { must } from "./helpers.mjs";

const README = readFileSync(new URL("../README.md", import.meta.url), "utf8");

/** The second column of the table between the markers, row by row. */
function tableGaps() {
  const block = must(/<!-- gaps:start -->([\s\S]*?)<!-- gaps:end -->/.exec(README), "the gaps table")[1];
  return block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && !l.startsWith("|---"))
    .slice(1)
    .map((l) => l.split("|")[2].trim());
}

/**
 * The gap after each of `n` right answers, each given the moment the
 * question is due.
 * @param {number} random
 * @param {number} n
 */
function walk(random, n) {
  let t = Date.UTC(2026, 8, 8, 12, 0, 0);
  let s = freshState();
  const gaps = [];
  for (let i = 0; i < n; i++) {
    s = reschedule(s, "good", { now: () => t, random: () => random });
    gaps.push(s.due - t);
    t = s.due;
  }
  return gaps;
}

/** @param {number} lo @param {number} hi */
function said(lo, hi) {
  if (lo < DAY) {
    assert.equal(lo, hi, "a learning step has no spread");
    return `${lo / MIN} minutes`;
  }
  const [a, b] = [lo / DAY, hi / DAY];
  const unit = b === 1 ? "day" : "days";
  return a === b ? `${a} ${unit}` : `${a}–${b} ${unit}`;
}

test("the README's gaps are the scheduler's", () => {
  const rows = tableGaps();
  assert.ok(rows.length >= 3, "the table has rows");
  const low = walk(0, rows.length);
  const high = walk(0.999999, rows.length);
  assert.deepEqual(
    rows,
    low.map((g, i) => said(g, high[i])),
  );
});

test("the table's last row is where the gaps stop growing", () => {
  const rows = tableGaps();
  const low = walk(0, rows.length + 3);
  assert.deepEqual(low.slice(rows.length - 1), Array(4).fill(low[rows.length - 1]));
});
