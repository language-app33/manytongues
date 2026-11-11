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
import type { Lang } from "./types.ts";
import { deckQuality, NAME_KINDS } from "./deck-quality.ts";
import { isDialog } from "./dialogs.ts";
import { holedParts, reviewOf, sentencesOf } from "./review.ts";
import type { Review } from "./review.ts";
import { isSentence, slotsOf } from "./variables.ts";
import { ownSlot } from "./verbs.ts";

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

/* ------------------------------------------------------------------
   Publishing: the checklist a unit must clear in a course (R7, R9, R10)
   ------------------------------------------------------------------ */

/** Sentences with a blank a unit needs (R7). */
export const MIN_SENTENCES = 5;
/** Different approved cards each blank needs (R10). */
export const MIN_FILLERS = 5;

export type UnitProblem =
  /** `have`: sentences with a blank now. `need`: MIN_SENTENCES. The screen shows need − have. */
  | { kind: "few-sentences"; have: number; need: number }
  /** `cardId` is the sentence card; the screen looks up its text to show it. */
  | { kind: "blank-short"; cardId: string; partId: string; slot: string; have: number; need: number }
  /** `cardId` is the word card; the screen looks up its text to show it. */
  | { kind: "word-unused"; cardId: string }
  | { kind: "two-finals"; have: number };

/** Whether a sentence a review lists was approved by a teacher: on `ok`
    and not on `no`. Not `passes`, which lets a card with no review through
    — and a card with no review has nothing approved. */
export function approvedIn(review: Review | null | undefined, key: string): boolean {
  if (!review) return false;
  const ok = Array.isArray(review.ok) ? review.ok : [];
  const no = Array.isArray(review.no) ? review.no : [];
  return ok.includes(key) && !no.includes(key);
}

/** One blank of one sentence part, and the different cards approved in it. */
export interface BlankFill {
  cardId: string;
  partId: string;
  slot: string;
  /** The ids of the cards that fill it in an approved sentence. */
  cards: string[];
}

/**
 * Every blank of a unit's sentences, with the cards that fill it in a
 * sentence a teacher approved, drawn from `counting` alone. Finals (a text
 * or conversation) are left out (R14). The checklist reads it, and so does
 * the advice on forms under the quality score.
 */
export function blankFills(cards: Held[], counting: Held[], lang: Lang | null | undefined): BlankFill[] {
  const out: BlankFill[] = [];
  for (const card of (cards || []).filter(Boolean)) {
    if (isDialog(card) || !isSentence(card)) continue;
    const review = reviewOf(card);
    for (const part of holedParts(card)) {
      const own = ownSlot(part);
      const drawn = slotsOf(part).filter((s) => s !== own);
      if (!drawn.length) continue;
      const listed = sentencesOf(card, part, counting || [], lang);
      const approved = listed.list.filter((s) => approvedIn(review, s.key));
      for (const slot of drawn) {
        const ids = new Set<string>();
        for (const s of approved) {
          const took = s.took[slot];
          if (took && took.card) ids.add(String(took.card));
        }
        out.push({ cardId: String(card.id), partId: String(part.id || ""), slot, cards: [...ids] });
      }
    }
  }
  return out;
}

/**
 * What stands between a unit and publishing it in one course.
 *
 * `cards` is the unit's own cards. `counting` is the cards that may count
 * toward the five (R12, A3): the unit's own cards; the cards of the earlier
 * units in drawsFrom(...); every card for which neverAskedAlone is true;
 * and the number values (see fillerCards) whose part is held, in
 * deck.parts, by this unit or by one of the earlier units in drawsFrom(...)
 * — `heldFillers` picks those.
 *
 * The approvals are the teacher's ordinary ones: a sentence's key is a
 * fingerprint of the filled text, so what was approved on the review
 * screen is what is found here. This judges, and changes nothing about
 * how blanks are filled anywhere (R13).
 */
export function unitProblems(input: { cards: Held[]; counting: Held[]; lang: Lang | null | undefined }): UnitProblem[] {
  const { lang } = input;
  const cards = (input.cards || []).filter(Boolean);
  const counting = (input.counting || []).filter(Boolean);
  const problems: UnitProblem[] = [];

  /* 1–2. Finals: a text or conversation, at most one, not examined further. */
  const finals = cards.filter((c) => isDialog(c));
  if (finals.length > 1) problems.push({ kind: "two-finals", have: finals.length });

  /* 3. Sentences with a blank (R7, R8). */
  const sentences = cards.filter((c) => !isDialog(c) && isSentence(c));
  const counts = (card: Held) =>
    holedParts(card).some((part) => {
      const own = ownSlot(part);
      return slotsOf(part).some((s) => s !== own);
    });
  const have = sentences.filter(counts).length;
  if (have < MIN_SENTENCES) problems.push({ kind: "few-sentences", have, need: MIN_SENTENCES });

  /* 4. Five approved cards per blank (R10, R11, R12). */
  for (const b of blankFills(sentences, counting, lang)) {
    if (b.cards.length < MIN_FILLERS) {
      problems.push({ kind: "blank-short", cardId: b.cardId, partId: b.partId, slot: b.slot, have: b.cards.length, need: MIN_FILLERS });
    }
  }

  /* 5. Every word used (R9). Cards the quality score does not ask to be in
     sentences — names, cards never asked on their own — are not checked. */
  const q = deckQuality(cards, { lang, pool: counting, known: counting });
  for (const w of q.words) {
    if (!w.forms.some((f) => f.met > 0)) problems.push({ kind: "word-unused", cardId: w.id });
  }
  return problems;
}

/** The number parts held, in deck.parts, by any of these decks. */
export function heldParts(decks: { id: string; parts?: string[] }[], ids: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const d of decks || []) if (d && ids.has(d.id)) for (const p of d.parts || []) out.add(String(p));
  return out;
}

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
  decks: (PathDeck & { parts?: string[] })[];
  unitId: string;
  cards: T[];
  deckIdsOf: (card: T) => string[];
  fillers?: T[];
}): T[] {
  const from = drawsFrom(o.course, o.decks, o.unitId);
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
    if (neverAskedAlone(c) || o.deckIdsOf(c).some((d) => from.has(d))) add(c);
  }
  for (const f of heldFillers(o.fillers || [], heldParts(o.decks, from))) add(f);
  return out;
}
