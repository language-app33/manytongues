// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  forgetter,
  live,
  mixedCourseOf,
} from "./pace-sim.mjs";

/* ------------------------------------------------------------------
   A learner who forgets, on a course shaped like a teacher's

   Every figure above is a learner who never gets anything wrong, on a
   course of identical words. That can show what letting more words in
   gains and never what it costs, so every limit in the app was set
   without seeing its cost. These are the same lives with a learner who
   forgets (see `forgetter`) on a mixed course (see `mixedCourseOf`), and
   what they report is the outcome that matters: how many words the
   learner would actually get right, the morning after and a month later.
   ------------------------------------------------------------------ */

/** @type {Map<string, ReturnType<typeof live>>} */
const lived = new Map();
/* Each life is lived once and read by whichever test asks, because the
   keen one takes minutes. */
const honestLife = (/** @type {{ sessionsPerDay: number, memory?: number }} */ how) => {
  const key = `${how.sessionsPerDay}/${how.memory ?? 1}`;
  if (!lived.has(key)) {
    lived.set(key, live({
      /* Two hundred cards, and forty-five days for the keenest learner
         (0.580): every claim below compares one life with another, so a
         smaller course says the same thing in a quarter of the time. */
      cards: mixedCourseOf(200),
      days: how.sessionsPerDay >= 15 ? 45 : 90,
      sessionsPerDay: how.sessionsPerDay,
      learner: forgetter({ memory: how.memory ?? 1, seed: 7 }),
    }));
  }
  return /** @type {ReturnType<typeof live>} */ (lived.get(key));
};

const report = (/** @type {string} */ who, /** @type {ReturnType<typeof live>} */ got) =>
  console.log(
    `    ${who}: met ${got.met}, cleared ${got.cleared}, learnt ${got.learnt}; ` +
      `${Math.round(got.accuracy * 100)}% of answers right; ` +
      `would know ${Math.round(got.knownNow ?? 0)} the next morning, ${Math.round(got.knownInAMonth ?? 0)} a month on`,
  );

test("a learner who forgets: what their weeks of practice leave them knowing", () => {
  for (const sittings of [1, 3, 15]) {
    const got = honestLife({ sessionsPerDay: sittings });
    report(`${sittings} a day, typical memory`, got);
    assert.ok(got.met > 0 && (got.knownNow ?? 0) > 0, `${sittings} a day learnt nothing`);
  }
});

test("a learner who struggles is given fewer new words, not more to forget", () => {
  /* The claim the caps rest on and nothing had measured: somebody who
     keeps forgetting has words that never settle, those words hold their
     places, and new ones slow down on their own. */
  const typical = honestLife({ sessionsPerDay: 3 });
  const weak = honestLife({ sessionsPerDay: 3, memory: 0.5 });
  report("3 a day, typical memory", typical);
  report("3 a day, struggling", weak);
  assert.ok(weak.met <= typical.met, `the struggling learner met ${weak.met} against ${typical.met}`);
});

