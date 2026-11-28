/*
 * The path: a course's units, in order, each opening when the one before it
 * is finished (0.613).
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
 * This file decides which never-met cards may come into a session
 * (`cardHeld`) and what counts as taught by a unit's place on the path
 * (`countingCards`, which the quality score reads). Whether a unit may be
 * published needs no rule here since 0.740: one with a card publishes.
 * It does not touch the levels, the scheduler, the session
 * mix, the review rules, or how blanks are filled.
 *
 * Pure: no clock, no storage, no React, no network. The app and the server
 * both import it. See README.md, "A course's path", and DECISIONS.md,
 * "Units: a course's path".
 */
import { NAME_KINDS } from "./module-quality.ts";

type Held = Record<string, any>;

export interface PathCourse {
  id: string;
  decks?: string[];
  path?: string[];
  pathLive?: Record<string, number>;
  opened?: string[];
}
export interface PathModule {
  id: string;
  unit?: true;
  cardIds?: string[];
}

/** Whether a deck is a path unit. */
export function isPathUnit(module: PathModule | null | undefined): boolean {
  return !!module && module.unit === true;
}

/** Whether a unit is published in this course. */
export const isLiveIn = (course: PathCourse | null | undefined, moduleId: string): boolean =>
  !!course && !!course.pathLive && Object.prototype.hasOwnProperty.call(course.pathLive, moduleId);

/**
 * The course's path units in order. Only those that still exist in `decks`.
 * `published: true` keeps only those in course.pathLive (the student's view).
 */
export function pathUnits(
  course: PathCourse | null | undefined,
  modules: PathModule[],
  opts: { published?: boolean } = {},
): PathModule[] {
  if (!course || !Array.isArray(course.path) || !course.path.length) return [];
  const byId = new Map((modules || []).filter(Boolean).map((d) => [d.id, d]));
  const seen = new Set<string>();
  const out: PathModule[] = [];
  for (const id of course.path) {
    if (seen.has(id)) continue;
    seen.add(id);
    const module = byId.get(id);
    if (!module) continue;
    if (opts.published && !isLiveIn(course, id)) continue;
    out.push(module);
  }
  return out;
}

/**
 * The deck ids whose cards count toward the five in `deckId`, in this
 * course: that unit, and every unit before it on this course's path that is
 * published in this course. Empty set when `deckId` is not on this course's
 * path.
 */
export function drawsFrom(course: PathCourse | null | undefined, modules: PathModule[], moduleId: string): Set<string> {
  const units = pathUnits(course, modules);
  const at = units.findIndex((u) => u.id === moduleId);
  if (at < 0) return new Set();
  const out = new Set<string>();
  for (let i = 0; i < at; i++) if (isLiveIn(course, units[i].id)) out.add(units[i].id);
  out.add(moduleId);
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
  modules: PathModule[],
  finishedNow: (moduleId: string) => boolean,
  reached: string[],
): { rows: PathRow[]; reached: string[] } {
  const stored = Array.isArray(reached) ? reached.filter((x) => typeof x === "string") : [];
  const had = new Set(stored);
  const grown = [...new Set(stored)];
  const opened = new Set(course && Array.isArray(course.opened) ? course.opened : []);
  const rows: PathRow[] = [];
  let allBefore = true;
  let current = false;
  pathUnits(course, modules, { published: true }).forEach((u, i) => {
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
export function cardHeld(moduleIds: string[], isUnit: (moduleId: string) => boolean, openUnits: Set<string>): boolean {
  if (!moduleIds || !moduleIds.length) return false;
  return moduleIds.every((d) => isUnit(d) && !openUnits.has(d));
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

/* ------------------------------------------------------------------
   Publishing (0.740)

   A unit publishes in a course once it holds a card or a word-set part:
   the server's publish-unit refuses an empty one with "unit-empty" and
   nothing else. The checklist that stood here (R7, R9, R10: five
   sentences with a blank, enough approved cards for each blank, every
   word used, one closing scene) was withdrawn by the owner in 0.740
   because it added complexity and confusion. See DECISIONS.md.
   ------------------------------------------------------------------ */

/** The number parts held, in deck.parts, by any of these decks. */
export function heldParts(modules: { id: string; parts?: string[] }[], ids: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const d of modules || []) if (d && ids.has(d.id)) for (const p of d.parts || []) out.add(String(p));
  return out;
}

/** Whether a card is a number value made for blanks (see fillerCards). */
const isFillerOf = (c: Held): boolean =>
  !!c && !!c.source && typeof c.source.slot === "string" && c.source.slot.startsWith("fill:");

/** The number values whose part is among `parts` (A3): each says which part
    it comes from in `source.slot`, as `fill:<part id>`. */
export function heldFillers<T extends Held>(fillers: T[], parts: Set<string>): T[] {
  return (fillers || []).filter((f) => {
    const slot = f && f.source && typeof f.source.slot === "string" ? f.source.slot : "";
    return slot.startsWith("fill:") && parts.has(slot.slice(5));
  });
}

/**
 * The cards that may count toward a unit's five, in one course: those of
 * the decks `drawsFrom` names, every card never asked on its own, and the
 * number values of the parts those decks hold. `deckIdsOf` says which decks
 * a card is in. The teacher's screen and the server build it the same way.
 */
export function countingCards<T extends Held>(o: {
  course: PathCourse;
  modules: (PathModule & { parts?: string[] })[];
  unitId: string;
  cards: T[];
  moduleIdsOf: (card: T) => string[];
  fillers?: T[];
}): T[] {
  const from = drawsFrom(o.course, o.modules, o.unitId);
  const out: T[] = [];
  const seen = new Set<string>();
  const add = (c: T) => {
    const id = String(c.id);
    if (seen.has(id)) return;
    seen.add(id);
    out.push(c);
  };
  for (const c of o.cards || []) {
    if (!c) continue;
    /* A number value is never asked on its own either, but it counts only
       through the part it comes from — below. */
    if (isFillerOf(c)) continue;
    if (neverAskedAlone(c) || o.moduleIdsOf(c).some((d) => from.has(d))) add(c);
  }
  for (const f of heldFillers(o.fillers || [], heldParts(o.modules, from))) add(f);
  return out;
}

/** The warning on deleting a unit that other courses hold too. */
export const deleteUnitLine = (others: number): string =>
  others === 1
    ? "This unit is also in 1 other course. Deleting it removes it from both."
    : `This unit is also in ${others} other courses. Deleting it removes it from all of them.`;
