/*
 * The path: a course's units, in order, each opening when the one before it
 * is finished (0.611).
 *
 * A **path unit** is a deck with `unit: true`. A course lists its units in
 * `path`, in order, drafts included; publishes each in `pathLive`; and may
 * open one early for its whole class in `opened`. Everything about the path
 * is per course, because one unit can be in several courses, and each gives
 * it its own place, publishes it separately and opens it early separately.
 *
 * The word "unit" alone is taken in the code: `Unit`, `unitsOf`,
 * `quietUnits` and the rest mean one form of a card that can be asked. So
 * the thing here is always a *path unit* in code, and "Unit" only on screen.
 *
 * Two principles govern it, in the owner's words:
 *
 * - **Cards are free objects.** A card can be in any number of units, decks
 *   and courses; nothing about where a card already is may block adding it
 *   somewhere else. A unit, like a deck, can be in any number of courses.
 * - **Progress belongs to the card.** A card cleared anywhere is cleared
 *   everywhere — which is why nothing here stores progress. Whether a unit
 *   is finished is read off its cards each time (`finishedNow`, the
 *   caller's), and the one thing remembered is which units were ever
 *   reached, so that a unit that has opened never locks again.
 *
 * This file decides two things and no more: which never-met cards may come
 * into a session (`cardHeld`), and whether a unit may be published
 * (`unitProblems`). It does not touch the levels, the scheduler, the session
 * mix, the review rules, or how blanks are filled.
 *
 * Pure: no clock, no storage, no React, no network. The app and the server
 * both import it. See README.md, "A course's path", and DECISIONS.md,
 * "Units: a course's path".
 */
import { NAME_KINDS } from "./deck-quality.ts";

type Held = Record<string, any>;

export interface PathCourse {
  id: string;
  decks?: string[];
  path?: string[];
  pathLive?: Record<string, number>;
  opened?: string[];
}
export interface PathDeck {
  id: string;
  unit?: true;
  cardIds?: string[];
}

/** Whether a deck is a path unit. */
export function isPathUnit(deck: PathDeck | null | undefined): boolean {
  return !!deck && deck.unit === true;
}

/** Whether a unit is published in this course. */
export const isLiveIn = (course: PathCourse | null | undefined, deckId: string): boolean =>
  !!course && !!course.pathLive && Object.prototype.hasOwnProperty.call(course.pathLive, deckId);

/**
 * The course's path units in order. Only those that still exist in `decks`.
 * `published: true` keeps only those in course.pathLive (the student's view).
 */
export function pathUnits(
  course: PathCourse | null | undefined,
  decks: PathDeck[],
  opts: { published?: boolean } = {},
): PathDeck[] {
  if (!course || !Array.isArray(course.path) || !course.path.length) return [];
  const byId = new Map((decks || []).filter(Boolean).map((d) => [d.id, d]));
  const seen = new Set<string>();
  const out: PathDeck[] = [];
  for (const id of course.path) {
    if (seen.has(id)) continue;
    seen.add(id);
    const deck = byId.get(id);
    if (!deck) continue;
    if (opts.published && !isLiveIn(course, id)) continue;
    out.push(deck);
  }
  return out;
}

/**
 * The deck ids whose cards count toward the five in `deckId`, in this
 * course: that unit, and every unit before it on this course's path that is
 * published in this course. Empty set when `deckId` is not on this course's
 * path.
 */
export function drawsFrom(course: PathCourse | null | undefined, decks: PathDeck[], deckId: string): Set<string> {
  const units = pathUnits(course, decks);
  const at = units.findIndex((u) => u.id === deckId);
  if (at < 0) return new Set();
  const out = new Set<string>();
  for (let i = 0; i < at; i++) if (isLiveIn(course, units[i].id)) out.add(units[i].id);
  out.add(deckId);
  return out;
}

export type PathState = "finished" | "open" | "locked";
export interface PathRow {
  id: string;
  /** 1 for the first published unit of the course. */
  number: number;
  state: PathState;
  /** Locked for this learner, but opened early by the teacher of this course. */
  openedEarly: boolean;
  /** The first open, unfinished unit in path order. At most one row. */
  current: boolean;
}

/**
 * Where a learner stands on one course's path, and the reached set to store.
 *
 * Over the units published in that course, in order:
 *
 * 1. A unit is *reached* if its id is in `reached`, or if it is the first
 *    unit, or if every unit before it is finished now.
 * 2. Once reached, always reached: the returned `reached` is the old list
 *    plus every newly reached id. It never shrinks — nobody is sent back
 *    (R25), whatever a teacher adds, reorders or inserts.
 * 3. State: `finished` if reached and finished now; `open` if reached and
 *    not finished now; otherwise `locked`.
 * 4. `openedEarly` is true for a locked unit whose id is in `course.opened`.
 * 5. `current` is true for the first row whose state is `open`.
 */
export function pathRows(
  course: PathCourse | null | undefined,
  decks: PathDeck[],
  finishedNow: (deckId: string) => boolean,
  reached: string[],
): { rows: PathRow[]; reached: string[] } {
  const stored = Array.isArray(reached) ? reached.filter((x) => typeof x === "string") : [];
  const had = new Set(stored);
  const grown = [...new Set(stored)];
  const opened = new Set(course && Array.isArray(course.opened) ? course.opened : []);
  const rows: PathRow[] = [];
  let allBefore = true;
  let current = false;
  pathUnits(course, decks, { published: true }).forEach((u, i) => {
    const done = !!finishedNow(u.id);
    const isReached = had.has(u.id) || i === 0 || allBefore;
    if (isReached && !had.has(u.id)) {
      had.add(u.id);
      grown.push(u.id);
    }
    const state: PathState = isReached ? (done ? "finished" : "open") : "locked";
    const isCurrent = state === "open" && !current;
    if (isCurrent) current = true;
    rows.push({
      id: u.id,
      number: i + 1,
      state,
      openedEarly: state === "locked" && opened.has(u.id),
      current: isCurrent,
    });
    allBefore = allBefore && done;
  });
  return { rows, reached: grown };
}

/**
 * The union of two pathReached records: for every course id in either,
 * every unit id in either list. Ids from `a` keep their order and come
 * first; ids only in `b` follow in their order. Neither input is changed.
 *
 * Why a union rather than last-writer-wins, as every other setting: a unit
 * that opened must never lock again, and a device that last synced before
 * it opened would otherwise take it back. See DECISIONS.md.
 */
export function mergeReached(
  a: Record<string, string[]> | undefined | null,
  b: Record<string, string[]> | undefined | null,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (rec: Record<string, string[]> | undefined | null) => {
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) return;
    for (const [course, ids] of Object.entries(rec)) {
      if (!Array.isArray(ids)) continue;
      const list = out[course] || (out[course] = []);
      for (const id of ids) if (typeof id === "string" && !list.includes(id)) list.push(id);
    }
  };
  add(a);
  add(b);
  return out;
}

/** Whether `b` holds a unit id that `a` does not. */
export function reachesFurther(
  a: Record<string, string[]> | undefined | null,
  b: Record<string, string[]> | undefined | null,
): boolean {
  if (!b || typeof b !== "object") return false;
  for (const [course, ids] of Object.entries(b)) {
    if (!Array.isArray(ids)) continue;
    const have = new Set(a && Array.isArray(a[course]) ? a[course] : []);
    if (ids.some((id) => typeof id === "string" && !have.has(id))) return true;
  }
  return false;
}

/**
 * Whether a never-met card must be held out of sessions (R22).
 *
 * `deckIds`: every downloaded deck the card is in. `openUnits`: the path
 * units whose state is "finished" or "open" in at least one course. Held
 * only when the card is in at least one deck AND every deck it is in is a
 * path unit that is not in `openUnits`. A card in no deck is never held —
 * a name borrowed by a sentence, say, which the sentence introduces itself.
 */
export function cardHeld(deckIds: string[], isUnit: (deckId: string) => boolean, openUnits: Set<string>): boolean {
  if (!deckIds || !deckIds.length) return false;
  return deckIds.every((d) => isUnit(d) && !openUnits.has(d));
}

/**
 * Whether a card is never asked on its own (A2): drill switched off, or a
 * name kind. The same test the quality score makes in `wantsSentences`,
 * reading the same list, so the two cannot drift apart.
 */
export function neverAskedAlone(card: Held | null | undefined): boolean {
  if (!card) return false;
  if (card.drill === false) return true;
  return NAME_KINDS.includes(String(card.category || "").trim());
}

