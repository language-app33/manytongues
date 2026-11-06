// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MASTERED_DAYS,
  MAX_IN_LEARNING,
  NEW_PER_DAY,
  PASSES_TO_LEARN,
  courseOf,
  live,
  liveKeeping,
} from "./pace-sim.mjs";

test("a diligent learner's first ninety days, as the app stands", () => {
  /* One short session a day, every day, every answer right. Printed rather
     than asserted tightly: this is the baseline any change is read
     against, and pinning it to the exact number would make it a test of
     arithmetic rather than of pace. */
  const got = live({ cards: courseOf(300), days: 90 });
  console.log(
    `    90 days, one session a day: met ${got.met}, mastered ${got.mastered}, ` +
      `${got.asked} questions, median ${got.medianDaysToMaster} days to master`,
  );
  assert.ok(got.met > 0, "nothing was ever met");
  assert.ok(got.met < 300, "the whole course arrived at once");
});

/*
 * What "practising more must not buy more new words" actually means.
 *
 * Not that the two learners meet the same number — under a design where
 * new words are released by old ones graduating, reviewing more *does*
 * graduate more, and so meets more. That is the rule working, not leaking.
 *
 * What must not exist is a quota counted in sessions. The old rule was
 * three a session, so ten short sittings in an evening were thirty new
 * words while one long sitting was three: the same effort, a tenfold
 * difference, decided by how the learner happened to break up their time.
 * What is asserted is that the standing pools bound intake, and nothing
 * about the shape of a sitting does.
 */

test("no quota is counted in sessions: one sitting can open a session's worth", () => {
  /* Under the old rule this was three, whatever the learner's state. */
  const day = live({ cards: courseOf(300), days: 1, sessionsPerDay: 1, budget: 20 });
  console.log(`    one twenty-question sitting met ${day.met} words`);
  assert.ok(day.met > 3, `still rationed per session: ${day.met}`);
});

test("and twenty in learning bounds a day however many sittings it holds", () => {
  /* Ten sittings in an evening is the case that started this. Coming back
     within three hours does bring new cards in — that is how somebody who
     practises often has more on the go — but never past twenty in learning,
     plus whatever was cleared that day and so left room behind it. */
  const once = live({ cards: courseOf(300), days: 1, sessionsPerDay: 1 });
  const often = live({ cards: courseOf(300), days: 1, sessionsPerDay: 10 });
  console.log(`    in one day: one sitting met ${once.met}, ten sittings met ${often.met}`);
  assert.ok(
    often.met <= MAX_IN_LEARNING + often.cleared,
    `ten sittings met ${often.met} words, past ${MAX_IN_LEARNING} in learning and the ${often.cleared} cleared`,
  );
});

test("twenty in learning is never exceeded, however hard the learner goes", () => {
  for (const sessionsPerDay of [1, 3, 30]) {
    const lived = liveKeeping({ cards: courseOf(300), days: sessionsPerDay === 30 ? 10 : 60, sessionsPerDay });
    assert.ok(lived.peakLearning <= MAX_IN_LEARNING,
      `${sessionsPerDay} a day: ${lived.peakLearning} in learning, past ${MAX_IN_LEARNING}`);
  }
});

test("a course arrives gradually rather than all at once", () => {
  const first = live({ cards: courseOf(300), days: 1, sessionsPerDay: 10, budget: 20 });
  /* A cleared word lets the next in the same day; see the test above. */
  assert.ok(first.met <= MAX_IN_LEARNING + first.cleared,
    `${first.met} words on the first day, ${first.cleared} of them cleared`);
  assert.ok(first.met >= 5, `only ${first.met} words on a whole first day`);
});

test("a word reaches the top of its ladder in a knowable time", () => {
  /* MASTERED_DAYS is the bar each rung is held to, so a word cannot be
     mastered faster than that however well it is answered. */
  const got = live({ cards: courseOf(60), days: 120 });
  assert.ok(got.mastered > 0, "nothing was mastered in a hundred and twenty days");
  assert.ok(
    (got.medianDaysToMaster ?? 0) >= MASTERED_DAYS,
    `mastered in ${got.medianDaysToMaster} days, faster than the bar`,
  );
});

/*
 * The learner who does far too much.
 *
 * Every case above sits down once or twice a day, which is why this file
 * reported healthy numbers through several releases in which somebody
 * practising hard learnt nothing at all. An early answer used to re-date
 * the card it was about, so a learner who came back every twenty minutes
 * pushed every card ahead of themselves all day and none ever fell due;
 * the gap each one was allowed to grow from was therefore always about
 * nought, floored at a day, and topped out under the four-day bar that
 * releases a new word. Ten words met in a fortnight, and never an
 * eleventh, for as long as they kept it up.
 *
 * Kept deliberately as a *pace* test rather than a unit one: the fault was
 * invisible in any single call to the scheduler and only appeared in the
 * shape of a fortnight.
 */
test("practising all day never stops a learner meeting new words", () => {
  const hard = live({ cards: courseOf(60), days: 10, sessionsPerDay: 30 });
  console.log(
    `    thirty sittings a day for ten days: met ${hard.met}, mastered ${hard.mastered}, ` +
      `${hard.asked} questions`,
  );
  assert.ok(
    hard.met > MAX_IN_LEARNING,
    `stuck at ${hard.met} words: nothing in learning ever cleared, so no new word came in`,
  );
  assert.ok(hard.mastered > 0, "nothing reached the top of its ladder");
});

test("and doing too much never beats doing the right amount", () => {
  /* The other side of it, and the property the limit exists for: the keen
     learner may meet more words — they have genuinely cleared more — but
     never holds more than twenty in learning, so practice cannot buy its
     way past the pacing. */
  const steady = live({ cards: courseOf(60), days: 10, sessionsPerDay: 1 });
  const keen = live({ cards: courseOf(60), days: 10, sessionsPerDay: 30 });
  assert.ok(keen.met >= steady.met, `${keen.met} against ${steady.met}`);
  const peaks = liveKeeping({ cards: courseOf(60), days: 10, sessionsPerDay: 30 });
  assert.ok(peaks.peakLearning <= MAX_IN_LEARNING, `${peaks.peakLearning} in learning`);
});

/* ------------------------------------------------------------------
   Effort buys the climb; time buys the keeping

   The release this was written for split what used to be one thing. A
   level used to open on a *gap* — through the learning steps below, four
   days of interval for the writing — so the ladder could only be climbed
   at the speed a calendar allows and an evening's work bought nothing.
   Now a level opens on two right answers in a row, and the gap is asked
   afterwards instead, as the two passes a card makes before it counts as
   learnt.

   So there are two claims to hold on to, and they pull opposite ways.
   Practising harder has to move the first. Nothing may move the second.

   These are read as directions rather than as numbers. The session
   builder shuffles what its ranking calls equal, using the real random
   rather than the clock handed in, so every figure this file prints moves
   a little between runs — which is worth knowing before reading any
   single line of its output as a result.
   ------------------------------------------------------------------ */

test("practising hard clears a card faster than practising once a day", () => {
  const steady = live({ cards: courseOf(60), days: 12, sessionsPerDay: 1 });
  const keen = live({ cards: courseOf(60), days: 12, sessionsPerDay: 8 });
  console.log(
    `    to clear a card: once a day ${steady.medianDaysToClear}, ` +
      `eight sittings a day ${keen.medianDaysToClear} days`,
  );
  assert.ok(keen.cleared > 0, "the keen learner cleared nothing in a fortnight");
  assert.ok(
    (keen.medianDaysToClear ?? 99) < (steady.medianDaysToClear ?? 99),
    `keen ${keen.medianDaysToClear} against steady ${steady.medianDaysToClear}: ` +
      "an evening's work bought nothing, which is the whole fault this release was for",
  );
});

test("and no amount of practice shortens the passes that follow", () => {
  /*
   * The other half, and the one that matters more. A pass is counted only
   * on an answer given when the question came round of its own accord, so
   * a learner drilling a card all evening cannot make one — and the two
   * of them sit behind gaps that start at a day and grow. Two reviews is
   * therefore never less than two days for anybody, and in practice
   * closer to four.
   */
  const keen = live({ cards: courseOf(60), days: 20, sessionsPerDay: 8 });
  console.log(
    `    eight sittings a day: cleared ${keen.cleared}, learnt ${keen.learnt}, ` +
      `median ${keen.medianPassDays} days from cleared to learnt`,
  );
  assert.ok(keen.learnt > 0, "nothing was ever kept");
  assert.ok(
    (keen.medianPassDays ?? 0) >= PASSES_TO_LEARN,
    `${keen.medianPassDays} days for ${PASSES_TO_LEARN} passes: a pass was made without a day passing`,
  );
  /* And cleared is genuinely ahead of learnt, which is what gives a
     learner something to see on the day they do the work. */
  assert.ok(keen.cleared >= keen.learnt, "more cards learnt than cleared, which cannot happen");
});

/* ------------------------------------------------------------------
   The learner who sits down all day, a month in

   Every test above asks whether new words arrive. None asked how often
   the *same* word does, which is how somebody practising fifteen times a
   day came to be dealt sixty words two or three times each, every day,
   with nothing new for a fortnight — and every test here stayed green.

   Measured on a 400-word course over sixty days, every answer right, with
   the simulation's clock fixed in 0.283 (before it, much of the app read
   today's date instead of the simulated one, and every figure printed
   here was off):

   |                                   | 0.279 | 0.280 pool grows | 0.281 climbers first, pool ×2 |
   |-----------------------------------|-------|------------------|-------------------------------|
   | 15 a day: words learnt            | 120   | 248              | about 275                     |
   | 15 a day: a card dealt, per day   | 5.4   | 3.8              | about 2.5                     |
   | 3 a day: words learnt             | 78    | 78               | about 60                      |
   | 1 a day: words learnt             | 23    | 24               | 24                            |

   Two things are still true and not what this test holds. At fifteen a
   day the pool fills around day twenty-five and new words stop for about
   three weeks, until the first words met stand at three-week gaps
   everywhere. And three a day is just past the keen line, where the
   climbers-first rule costs more than it gives: about 60 learnt against
   78. See DECISIONS.md.
   ------------------------------------------------------------------ */

test("fifteen sittings a day keep meeting new words, and meet the same card less", () => {
  const days = 60;
  const got = live({ cards: courseOf(400), days, sessionsPerDay: 15 });
  const late = got.daily.slice(30);
  const deals = late.reduce((n, d) => n + d.deals, 0);
  const distinct = late.reduce((n, d) => n + d.distinct, 0);
  const perCard = deals / Math.max(1, distinct);
  const asksPerCard = late.reduce((n, d) => n + d.questions, 0) / Math.max(1, distinct);
  console.log(
    `    fifteen sittings a day: met ${got.met}, learnt ${got.learnt} in ${days} days; ` +
      `days 31–60 each card dealt ${perCard.toFixed(2)} times a day, ${asksPerCard.toFixed(2)} questions about it`,
  );
  /* See the table above for what these were before. The bounds sit well
     clear of both the old figures and the new on purpose — see the note
     above "Effort buys the climb" on why every figure here moves a little
     between runs. */
  assert.ok(got.met >= 300, `only ${got.met} words met in ${days} days`);
  assert.ok(got.learnt >= 220, `only ${got.learnt} words learnt in ${days} days`);
  /* Counted in questions rather than in sittings since 0.453. A card past
     its lower levels is asked its top alone, so it takes one question
     where it took two and comes round in more sittings for fewer
     questions: about 2.8 sittings and 4.2 questions a day before, about
     4 and 4 after. Questions are what a learner feels. */
  assert.ok(asksPerCard < 4.6, `each card was asked ${asksPerCard.toFixed(2)} questions a day`);
});

test("and a once-a-day learner's reviews are never crowded out by the climbers", () => {
  /*
   * The case that decided where the keen line sits. Put the words still
   * climbing first for everybody and a once-a-day learner's nine places
   * go to them every day: the reviews that turn a cleared word into a
   * learnt one are crowded out, and what they learn falls away — measured
   * as none at all in sixty days under the simulation's old clock. Below
   * the line nothing about their order changed, and this holds them at
   * what they learnt before 0.281 (about two dozen in sixty days).
   */
  const got = live({ cards: courseOf(400), days: 60, sessionsPerDay: 1 });
  console.log(`    one sitting a day: met ${got.met}, learnt ${got.learnt} in 60 days`);
  assert.ok(got.learnt >= 12, `a once-a-day learner learnt ${got.learnt} words in sixty days`);
});

test("new cards arrive as fast as the prep forecast's floor assumes, and no faster", () => {
  /* The forecast says the soonest a prep could be ready, and reads new
     cards as arriving NEW_PER_DAY a day at most. Measured here on the
     learner who practises most and never gets anything wrong, and held to
     it: a change to the mix that moves this moves the forecast too. */
  const fast = live({ cards: courseOf(300), days: 10, sessionsPerDay: 15 });
  const perDay = Math.max(...[...Array(10).keys()].map((d) => [...fast.firstSeen.values()].filter((x) => x === d).length));
  console.log(`    fifteen sittings a day, never wrong: at most ${perDay} new cards in a day`);
  assert.ok(Math.abs(perDay - NEW_PER_DAY) <= NEW_PER_DAY / 5,
    `${perDay} new cards in a day against the forecast's ${NEW_PER_DAY}: measure it again and set it`);
});

