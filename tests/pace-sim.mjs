// @ts-check
/* The pacing simulation, shared by the two files that run it (0.580: split
   so the forgetting learner runs beside the rest rather than after it). */
/*
 * How fast a learner gets through a course.
 *
 * This file exists because the last person to change the rules that ration
 * new words left a note asking the next one to measure first — and the
 * measurement itself was a sentence in a comment, with nothing to re-run.
 * So it is written down here, as something that answers the question again
 * whenever somebody asks it.
 *
 * A simulated learner sits down some number of days in a row, is dealt a
 * session, and answers it. The scheduler and the session builder are both
 * pure with the clock passed in, so none of this needs a browser, a
 * server, or a person.
 *
 * What it measures is deliberately the three numbers that argue with each
 * other: how many words were *met*, how many were *mastered*, and how long
 * a word took to reach the top of its ladder. Loosening a cap always
 * improves the first and can quietly ruin the other two, which is exactly
 * what happened the last time this was tried.
 */

import path from "node:path";
import { buildOnce } from "./helpers.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, "..");

const built = await buildOnce(["ArabicTrainer.tsx"]);

const { buildSession, installIndexes, setOfflineNow, setAudibleClips, laddered, mixCardsOf, NEW_PER_DAY } = await import(
  path.join(built, "ArabicTrainer.js")
);
const { gradeInto } = await import(path.join(root, "src", "grade.ts"));
const {
  mastered,
  solid,
  cleared,
  learnt,
  unitsOf,
  dayKey,
  typicalDay,
  MASTERED_DAYS,
  PASSES_TO_LEARN,
} = await import(path.join(root, "src", "scheduler.ts"));
const { levelOf } = await import(path.join(root, "src", "languages.ts"));
const { MAX_IN_LEARNING, inLearningOf } = await import(path.join(root, "src", "session-mix.ts"));
const { SESSION_SIZE } = await import(path.join(root, "src", "session-layout.ts"));

const DAY = 86400000;
const START = Date.UTC(2026, 0, 1, 9, 0, 0);
const settings = { language: "ar-PS" };

/* Nothing here is about the network; say so once and leave it. */
setOfflineNow(false);
setAudibleClips(null);

/** A plain word with enough on it to be asked several ways. */
const word = (/** @type {number} */ i) => ({
  id: `w${i}`,
  tags: [],
  created: 1,
  lang: "ar-PS",
  kind: "word",
  forms: [{ id: `w${i}`, ar: `كلمة${i}`, en: `word ${i}`, lat: `kalima${i}`, lang: "ar-PS", s: {} }],
});

const courseOf = (/** @type {number} */ n) => Array.from({ length: n }, (_, i) => word(i + 1));

/**
 * A course shaped like a teacher's rather than a list of identical words.
 *
 * Mostly nouns, every other one with its plural as a second form drilled
 * in its own right; some adjectives with their feminine; and every tenth
 * card a sentence built out of them, which can be asked nothing until its
 * words are cleared. Spread through the course in the order a teacher
 * would write it, so a sentence turns up after the words it is made of.
 */
function mixedCourseOf(/** @type {number} */ n) {
  /** @type {any[]} */
  const out = [];
  for (let i = 1; out.length < n; i += 1) {
    if (i % 10 === 0) {
      out.push({
        id: `s${i}`, lang: "ar-PS", sentence: true, created: i,
        forms: [{ id: `s${i}`, ar: `{{noun}} {{adjective}} ${i}`, en: `a {{adjective}} {{noun}} ${i}`, lat: `{{noun}} {{adjective}} ${i}` }],
      });
    } else if (i % 7 === 0) {
      out.push({
        id: `a${i}`, lang: "ar-PS", category: "adjective", created: i,
        forms: [
          { id: `a${i}`, ar: `صفة${i}`, en: `adjective ${i}`, lat: `sifa${i}` },
          { id: `a${i}-f`, ar: `صفة${i}ة`, en: `adjective ${i}`, lat: `sifa${i}e`, row: "agreement", col: "feminine" },
        ],
      });
    } else {
      const gender = i % 3 ? "masculine" : "feminine";
      /** @type {any[]} */
      const forms = [{ id: `n${i}`, ar: `اسم${i}`, en: `noun ${i}`, lat: `ism${i}`, number: "singular", gender, human: "thing" }];
      if (i % 2) forms.push({ id: `n${i}-p`, ar: `اسماء${i}`, en: `nouns ${i}`, lat: `asma${i}`, number: "plural", gender, human: "thing" });
      out.push({ id: `n${i}`, lang: "ar-PS", category: "noun", created: i, forms });
    }
  }
  return out;
}

/*
 * A learner who forgets.
 *
 * Every other learner in this file answers everything right, which makes
 * them the upper bound on pace and blind to the one cost the caps exist
 * for: words forgotten because too many are in play at once. This one has
 * a memory of each form, hidden from the app, and answers from it.
 *
 * The model is the usual one and deliberately simple. Each form has a
 * strength in days; the chance of recalling it falls away with the time
 * since it was last seen, as exp(-days / strength). Recalling it makes it
 * stronger, and by more the closer it was to being lost — so the same
 * word answered five times in an hour gains a little, and answered after a
 * gap gains a lot. Missing it weakens it, but never below where it was
 * the first time it was seen: a miss shows the answer and the app asks it
 * again before the sitting ends, so a missed word is taught again rather
 * than lost.
 *
 * Calibrated to the common figures rather than fitted to anything here: a
 * word met in one sitting and got right twice there is recalled about two
 * times in three the next day, and one recalled after a day's gap lasts
 * about five more. Words differ in how hard they
 * are, and `memory` scales the whole learner: 1 is typical, 0.5 somebody
 * who struggles.
 *
 * Seeded, so the learner's luck is the same from one run to the next and
 * only the session builder's shuffle moves the figures.
 */
const SEEN_STRENGTH = 1;
const FLOOR = 0.3;
const GROWTH = 3;
const LAPSE = 0.4;

/** @param {number} seed */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How hard a word is, from 0.6 to 1.6, fixed by its id. */
function hardness(/** @type {string} */ id) {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return 0.6 + ((h >>> 0) % 1000) / 1000;
}

function forgetter({ memory = 1, seed = 1 } = {}) {
  const roll = seeded(seed);
  /** @type {Map<string, { strength: number, last: number }>} */
  const held = new Map();
  let answered = 0;
  let right = 0;
  const recall = (/** @type {{ strength: number, last: number }} */ m, /** @type {number} */ at) =>
    Math.exp(-Math.max(0, at - m.last) / DAY / m.strength);
  return {
    /** Answer a question on one form at `at`; true when it was right. */
    answer(/** @type {string} */ itemId, /** @type {string | null} */ subId, /** @type {number} */ at) {
      const key = `${itemId}/${subId || ""}`;
      const gain = memory / hardness(itemId);
      const m = held.get(key);
      /* The first time a form is put to the learner it is being taught,
         with the answer in front of them. It is seen, not recalled. */
      if (!m) {
        held.set(key, { strength: SEEN_STRENGTH * gain, last: at });
        return true;
      }
      const r = recall(m, at);
      const ok = roll() < r;
      answered += 1;
      if (ok) right += 1;
      m.strength = ok ? m.strength * (1 + gain * (FLOOR + GROWTH * (1 - r))) : Math.max(SEEN_STRENGTH * gain, m.strength * LAPSE);
      m.last = at;
      return ok;
    },
    /**
     * What the learner would get right if tested at `at` with no more
     * practice: summed over the words met, each as its weakest form.
     */
    knownAt(/** @type {number} */ at) {
      /** @type {Map<string, number>} */
      const worst = new Map();
      for (const [key, m] of held) {
        const id = key.split("/")[0];
        worst.set(id, Math.min(worst.get(id) ?? 1, recall(m, at)));
      }
      let sum = 0;
      for (const r of worst.values()) sum += r;
      return sum;
    },
    accuracy: () => (answered ? right / answered : 1),
  };
}

/**
 * Sit down and work through one session.
 *
 * Every question is answered right, which is the kindest case and
 * therefore the *upper bound* on how fast anyone gets through a course. A
 * real learner is slower. If the ceiling is too low for a perfect learner
 * it is certainly too low for a real one.
 *
 * @returns the cards as they stand afterwards.
 */
function sitDown(
  /** @type {any[]} */ items,
  /** @type {number} */ at,
  /** @type {number} */ budget,
  /** @type {Record<string, number>} */ log = {},
  /** @type {ReturnType<typeof forgetter> | null} */ learner = null,
) {
  const clock = { now: () => at, random: () => 0.5 };
  installIndexes(items, settings);
  /* Read off the learner's own log, as the app reads it, so how much they
     practise sizes how much they may hold. */
  const perDay = typicalDay(log, clock);
  /* Built at the moment the learner sits down. The builder reads the
     wall clock — what is due, what was asked half an hour ago and rests —
     and left alone it would read today's date against cards dated to
     this simulation's calendar, so everything would look overdue and the
     order would be a shuffle of the whole hand.

     And its chance from a seed: the session shuffles within each rank, and
     left to the real Math.random every figure below moved from run to run
     — enough that a bound measured on one run failed on the next with
     nothing changed. Seeded off the sitting's own moment, so the same
     sitting deals the same hand whichever tests run, and in whatever
     order. */
  const wall = Date.now;
  const dice = Math.random;
  Date.now = () => at;
  Math.random = seeded(at / 60000);
  let built;
  try {
    built = buildSession({ items, settings, inDeck: () => true, budget, perDay });
  } finally {
    Date.now = wall;
    Math.random = dice;
  }
  const day = dayKey(at);
  let cards = items;
  /** @type {Set<string>} */
  const dealt = new Set();
  let nth = 0;
  for (const ex of built.exercises || []) {
    nth += 1;
    dealt.add(ex.id);
    log[day] = (log[day] || 0) + 1;
    /* A learner who forgets answers from memory; one who doesn't, right.
       The questions in a sitting are a minute apart, so a form asked twice
       in one is a minute's gap rather than none. */
    const asked = at + nth * 60000;
    const ok = !learner || learner.answer(ex.id, ex.subId || null, asked);
    const marks = [{ id: ex.id, subId: ex.subId || null, rating: ok ? "good" : "again", correct: ok, advance: true }];
    /* A grid is a question about every word in it, and the app marks each
       of them — moving a word's schedule only where its own question was
       due. Marking the first word alone, as this did until 0.281, had every
       other word in a grid climb as if it had never been asked, and
       understated what a learner gets through. */
    for (const m of ex.mates || []) {
      const it = cards.find((/** @type {any} */ c) => c.id === m.id);
      const u = it && unitsOf(it).find((/** @type {any} */ x) => (m.subId ? x.unit.id === m.subId : !x.isSub));
      const st = u && u.unit.s && u.unit.s[ex.type];
      dealt.add(m.id);
      const mateOk = !learner || learner.answer(m.id, m.subId || null, asked);
      marks.push({
        id: m.id,
        subId: m.subId || null,
        rating: mateOk ? "good" : "again",
        correct: mateOk,
        advance: !st || st.phase === "new" || (st.due || 0) <= at,
      });
    }
    /* Handed the ladder, as the app hands it, so the passes that turn a
       cleared card into a learnt one are counted here too. Without it the
       simulation would measure the climb and nothing that follows it,
       which is half of what this release changed. */
    const next = gradeInto(cards, marks, {
      type: ex.type,
      clock,
      how: {},
      keysOf: (/** @type {any} */ unit) => laddered(unit, settings),
    });
    if (next) cards = next;
  }
  return { cards, asked: (built.exercises || []).length, dealt, perDay };
}

/**
 * A learner's life, day by day.
 *
 * @param {{ cards: any[], days: number, budget?: number, sessionsPerDay?: number, learner?: ReturnType<typeof forgetter> | null }} how
 */
function live({ cards, days, budget = SESSION_SIZE, sessionsPerDay = 1, learner = null }) {
  let items = cards;
  let asked = 0;
  /** @type {Record<string, number>} */
  const log = {};
  /* When each word was first put to the learner, and when it reached the
     top of its ladder. Both read off the cards afterwards rather than
     tracked here, except the first, which nothing on a card records. */
  /** @type {Map<string, number>} */
  const firstSeen = new Map();
  /** @type {Map<string, number>} */
  const mastery = new Map();
  /* And the two this release is about: the day a card had been up every
     level it has, and the day it had come back twice since and been kept.
     Effort is meant to move the first and not the second. */
  /** @type {Map<string, number>} */
  const clearedOn = new Map();
  /** @type {Map<string, number>} */
  const learntOn = new Map();
  /* And each day's rotation: how many times a card was dealt, and how
     many different cards those deals were. The first over the second is
     how often the same word came round that day, which is the number a
     learner practising all day actually feels. */
  /** @type {{ deals: number, distinct: number, questions: number }[]} */
  const daily = [];

  for (let d = 0; d < days; d += 1) {
    let deals = 0;
    let questions = 0;
    /** @type {Set<string>} */
    const today = new Set();
    for (let s = 0; s < sessionsPerDay; s += 1) {
      /* Spread through the day so a second session is genuinely later. */
      const at = START + d * DAY + s * 3600000;
      const ran = sitDown(items, at, budget, log, learner);
      items = ran.cards;
      asked += ran.asked;
      deals += ran.dealt.size;
      questions += ran.asked;
      for (const id of ran.dealt) today.add(id);
      /* Only the cards this sitting dealt can have moved: every check below
         reads a card's own schedules and nothing else, and a card nobody
         answered has the schedules it had. Asking all four hundred after
         every one of fifteen sittings a day was most of what this file
         cost (0.580); the answers are the same. */
      for (const it of items) {
        if (!ran.dealt.has(it.id)) continue;
        const met = unitsOf(it).some((/** @type {any} */ u) =>
          Object.values(u.unit.s || {}).some((/** @type {any} */ st) => (st.reps || 0) > 0),
        );
        if (met && !firstSeen.has(it.id)) firstSeen.set(it.id, d);
        if (!mastery.has(it.id)) {
          /* Every question it is still asked at a four-day gap. Since 0.453
             a form past its lower levels is asked its top alone, so the
             gaps below stop growing and are not what it is waiting on. */
          const all = unitsOf(it).every((/** @type {any} */ u) => {
            const keys = laddered(u.unit, settings);
            const s = u.unit.s || {};
            const top = Math.max(...keys.map(levelOf));
            const climbed = keys.some((/** @type {string} */ k) => levelOf(k) < top) &&
              keys.filter((/** @type {string} */ k) => levelOf(k) < top).every((/** @type {string} */ k) => s[k] && solid(s[k]));
            const asked = climbed ? keys.filter((/** @type {string} */ k) => levelOf(k) === top) : keys;
            return asked.length > 0 && asked.every((/** @type {string} */ k) => s[k] && mastered(s[k]));
          });
          if (all) mastery.set(it.id, d);
        }
        const up = unitsOf(it).every((/** @type {any} */ u) => {
          const keys = laddered(u.unit, settings);
          return keys.length > 0 && cleared(keys, (/** @type {string} */ k) => (u.unit.s || {})[k]);
        });
        if (up && !clearedOn.has(it.id)) clearedOn.set(it.id, d);
        const kept = unitsOf(it).every((/** @type {any} */ u) => {
          const keys = laddered(u.unit, settings);
          return keys.length > 0 && learnt(keys, (/** @type {string} */ k) => (u.unit.s || {})[k]);
        });
        if (kept && !learntOn.has(it.id)) learntOn.set(it.id, d);
      }
    }
    daily.push({ deals, distinct: today.size, questions });
  }

  const days_to_master = [...mastery.entries()].map(([id, d]) => d - (firstSeen.get(id) ?? 0));
  const since = (/** @type {Map<string, number>} */ m) =>
    [...m.entries()].map(([id, d]) => d - (firstSeen.get(id) ?? 0)).sort((a, b) => a - b);
  const median = (/** @type {number[]} */ xs) => (xs.length ? xs[Math.floor(xs.length / 2)] : null);
  const toClear = since(clearedOn);
  const toLearn = since(learntOn);
  return {
    met: firstSeen.size,
    mastered: mastery.size,
    cleared: clearedOn.size,
    learnt: learntOn.size,
    medianDaysToClear: median(toClear),
    medianDaysToLearn: median(toLearn),
    /* The gap between the two, per card: what the passes cost, which is
       the one thing effort is not allowed to shorten. */
    medianPassDays: median(
      [...learntOn.entries()]
        .filter(([id]) => clearedOn.has(id))
        .map(([id, d]) => d - (clearedOn.get(id) ?? 0))
        .sort((a, b) => a - b),
    ),
    asked,
    daily,
    /* For a learner who forgets: what they would get right the morning
       after the last day, and a month after that with no practice at all
       — the honest measure of what the course left them with. */
    knownNow: learner ? learner.knownAt(START + days * DAY) : null,
    knownInAMonth: learner ? learner.knownAt(START + (days + 30) * DAY) : null,
    accuracy: learner ? learner.accuracy() : 1,
    /* The day each word was first met, for counting what arrived when. */
    firstSeen,
    /* The number the last attempt at this regressed. */
    medianDaysToMaster: days_to_master.length
      ? days_to_master.sort((a, b) => a - b)[Math.floor(days_to_master.length / 2)]
      : null,
  };
}

/** The same life, watching how many cards are ever in learning at once. */
function liveKeeping(/** @type {{ cards: any[], days: number, budget?: number, sessionsPerDay?: number }} */ how) {
  let items = how.cards;
  let peakLearning = 0;
  /** @type {Record<string, number>} */
  const log = {};
  for (let d = 0; d < how.days; d += 1) {
    for (let s2 = 0; s2 < (how.sessionsPerDay || 1); s2 += 1) {
      const at = START + d * DAY + s2 * 3600000;
      const ran = sitDown(items, at, how.budget || SESSION_SIZE, log);
      items = ran.cards;
      peakLearning = Math.max(peakLearning, inLearningOf(mixCardsOf(items, items, settings)));
    }
  }
  return { peakLearning };
}

/* ------------------------------------------------------------------
   What the rules are worth
   ------------------------------------------------------------------ */

export {
  DAY,
  FLOOR,
  GROWTH,
  LAPSE,
  MASTERED_DAYS,
  MAX_IN_LEARNING,
  NEW_PER_DAY,
  PASSES_TO_LEARN,
  SEEN_STRENGTH,
  SESSION_SIZE,
  START,
  buildSession,
  cleared,
  courseOf,
  dayKey,
  forgetter,
  gradeInto,
  hardness,
  inLearningOf,
  installIndexes,
  laddered,
  learnt,
  levelOf,
  live,
  liveKeeping,
  mastered,
  mixCardsOf,
  mixedCourseOf,
  seeded,
  setAudibleClips,
  setOfflineNow,
  settings,
  sitDown,
  solid,
  typicalDay,
  unitsOf,
  word,
};
