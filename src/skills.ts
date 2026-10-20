/*
 * What a skill is, said once.
 *
 * A skill is something a learner gets better at whose questions are made
 * up fresh from words they already know. Three kinds of card are one:
 *
 *   * **a stretch of a language's numbers, or of its clock** — *0 to 9*,
 *     *telling the hour*: the number or the time is drawn for each
 *     question (src/numbers/);
 *   * **a sentence with blanks** — "My name is ___": the words that fill
 *     it are drawn for each question (src/variables.ts, src/review.ts);
 *   * **a tense of a verb**, where the language offers the practices of a
 *     tense as a whole — the present of *to eat*: the person is drawn for
 *     each question (src/tense-skills.ts).
 *
 * They were built one at a time and each grew its own copy of the same
 * rules. The rules are these, and every kind keeps them:
 *
 *   1. **A skill holds one schedule and no words.** It climbs the same
 *      four levels as a word, on its own record of answers; what it is
 *      asked about is made up when the question is dealt and thrown away
 *      with the sitting.
 *   2. **What it is asked about is drawn from a seed** of the skill, the
 *      question and its count of right answers (`skillSeed`). So a
 *      re-render cannot change the question under somebody answering it,
 *      a missed question comes back as the same number or the same person,
 *      and a right one moves on.
 *   3. **Its parts are known before they are used.** A number waits on its
 *      words and a sentence on the words in its blanks; a tense's persons
 *      are its own, and a person who keeps going wrong is kept out of
 *      sentences until they are right again.
 *   4. **An answer marks the skill and the parts that stood in it**, each
 *      on its own record — the words of a number, the words in a blank,
 *      the person of a tense.
 *   5. **A skill is never further up than its parts allow** (`cappedAt`,
 *      and one map of where each skill is held, `SkillCaps`): a stretch of
 *      numbers no higher than the level its weakest word is working on, a
 *      tense no higher than the first level some person of it has not yet
 *      been answered right on. Nothing is taken off its schedule; the
 *      moment the part catches up, the levels come back as they were.
 *
 * Pure. What is here is the part of each rule that is the same for every
 * kind; what a kind's parts are, and when they count as known, is that
 * kind's own module.
 */

import type { ExerciseState } from "./types.ts";
import type { Standing } from "./scheduler.ts";

/**
 * The seed a skill's question is drawn from: the skill, the question it is
 * asked, and how many times it has been answered right — rule 2 above.
 */
export const skillSeed = (skillId: string, key: string, state: ExerciseState | null | undefined): string =>
  `${skillId} ${key} ${(state && state.right) || 0}`;

/**
 * Where each skill is held below its own ladder, by the id of the form
 * holding its schedule — the level it may be asked no higher than. Absent
 * where nothing holds it, which is nearly every skill nearly every day.
 */
export type SkillCaps = Map<string, number>;

/**
 * A skill's levels as its parts allow them — rule 5 above.
 *
 * The skill's own highest level at or under the cap is still being
 * learnt, whatever its own answers say, and every level above it has not
 * been started: the line on the screen is the line the questions stop at.
 * A skill with nothing on the capped level stops at the one below it.
 */
export function cappedAt<T extends Pick<Standing, "level" | "status">>(rows: T[], cap: number | null | undefined): T[] {
  if (cap == null || !rows.length) return rows;
  const under = rows.filter((r) => r.level <= cap);
  const line = under.length ? under[under.length - 1].level : rows[0].level;
  return rows.map((r) =>
    r.level > line
      ? { ...r, status: "none" }
      : r.level === line && (r.status === "done" || r.status === "cleared")
      ? { ...r, status: "learning" }
      : r,
  );
}
