/*
 * A course's switches: which exercises its students are asked (0.627).
 *
 * A teacher can run a course with less English, or with none. Each course
 * carries one record, `practice`, set on the course's own page:
 *
 *   * `mode`, one of four shortcuts: *With translation* (everything on, as
 *     every course was before this), *Little translation*, *No translation*
 *     and *Custom*. The first three set and lock the switches of the
 *     exercises that use English; *Custom* unlocks them.
 *   * `off`, the exercises the teacher has switched off by hand. Absent
 *     means on, so an exercise added in a later release is on in every
 *     existing course the day it ships.
 *
 * A course with no record is *With translation* with nothing off — which
 * is what every course was. Older builds ignore the record and keep asking
 * everything.
 *
 * Pure. The app reads it through one door, `allowedTypes` here, applied
 * where it works out what a form can be asked (see availableTypes in the
 * trainer); nothing else decides whether an exercise is allowed.
 */

import { EX, levelOf } from "./languages.ts";

export type PracticeMode = "with" | "little" | "none" | "custom";
export const PRACTICE_MODES: PracticeMode[] = ["with", "little", "none", "custom"];

export interface CoursePractice {
  mode: PracticeMode;
  /** Exercise types switched off by the teacher. */
  off: string[];
}

/**
 * The exercises that use English: the meaning shown, or asked for, in
 * English. Number and time exercises write their figures in the field the
 * English goes in, but a figure is not English, so they are not here.
 */
export const ENGLISH_TYPES: string[] = [
  "ar2pick", "ar2en", "rec2en", "ex2en", "match", "en2pick", "en2ar", "sen2en", "en2sen",
];
export const usesEnglish = (type: string): boolean => ENGLISH_TYPES.includes(type);

/*
 * What can teach a word's meaning without English: a picture, a recording,
 * a phrase or a scene. A form whose only questions without English need
 * none of these (writing it from its transliteration, say) has nothing but
 * English to teach it, and in a *No translation* course is not asked.
 */
const TEACHING_NEEDS = ["images", "recs", "contexts", "contextAudio", "dialog", "line"];
const teaches = (type: string): boolean => {
  const spec = EX[type];
  return !!spec && (spec.needs || []).some((n: string) => TEACHING_NEEDS.includes(n));
};

/** A stored record, narrowed; null where there is none or it is not one. */
export function readPractice(raw: unknown): CoursePractice | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const mode = PRACTICE_MODES.includes(r.mode as PracticeMode) ? (r.mode as PracticeMode) : "with";
  const off = Array.isArray(r.off) ? [...new Set(r.off.filter((t): t is string => typeof t === "string"))] : [];
  return { mode, off };
}

/** Whether the shortcut in force sets this exercise's switch and locks it. */
export const lockedBy = (mode: PracticeMode, type: string): boolean => mode !== "custom" && usesEnglish(type);

/**
 * What a switch reads on the course page: on, off, or (Little translation,
 * English exercises) on only where there is nothing on its level without
 * English.
 */
export function switchOf(p: CoursePractice | null, type: string): "on" | "off" | "little" {
  if (!p) return "on";
  if (lockedBy(p.mode, type)) return p.mode === "with" ? "on" : p.mode === "none" ? "off" : "little";
  return p.off.includes(type) ? "off" : "on";
}

/**
 * Of the types a form supports, the ones one course allows.
 *
 * Little translation drops an English exercise only where the same form
 * has an exercise without English, allowed, on the same level. No
 * translation drops every English exercise, and every other one too where
 * what is left cannot teach the meaning — but only on a form that had a
 * meaning in English to begin with, so numbers, times, verbs' tables and
 * the rest are untouched by it.
 */
export function allowedBy(p: CoursePractice | null, supported: string[]): string[] {
  if (!p) return supported;
  const plain = supported.filter((t) => !usesEnglish(t) && switchOf(p, t) === "on");
  const kept = supported.filter((t) => {
    const s = switchOf(p, t);
    if (s === "on") return true;
    if (s === "off") return false;
    return !plain.some((o) => levelOf(o) === levelOf(t));
  });
  if (p.mode === "none" && supported.some(usesEnglish) && !kept.some(teaches)) return [];
  return kept;
}

/**
 * Of the types a form supports, the ones it may be asked, given every
 * course the learner got its card through: a question is asked if any of
 * them allows it. No course — a card of the learner's own — allows all.
 */
export function allowedTypes(practices: (CoursePractice | null)[], supported: string[]): string[] {
  if (!practices.length) return supported;
  const any = new Set(practices.flatMap((p) => allowedBy(p, supported)));
  return supported.filter((t) => any.has(t));
}

/**
 * Whether English may be shown with a question, and how: plainly, behind
 * a tap, or not at all — the most English any of the card's courses
 * allows.
 */
export function englishShown(practices: (CoursePractice | null)[]): "shown" | "tap" | "hidden" {
  const open = (p: CoursePractice | null) =>
    !p || p.mode === "with" || (p.mode === "custom" && ENGLISH_TYPES.some((t) => !p.off.includes(t)));
  if (!practices.length || practices.some(open)) return "shown";
  return practices.some((p) => p && p.mode === "little") ? "tap" : "hidden";
}

/* ------------------------------------------------------------------
   What the course page tells the teacher

   Read off the teacher's cards rather than a student's device, which the
   teacher never sees (and must not: a teacher cannot see a student's
   progress). So it is a reading of what a card holds — its meaning, its
   transliteration, recordings, pictures, and the phrases that use it — and
   not the app's full answer, which also depends on each student's other
   cards. Word cards only: a sentence, a conversation, a number or a verb
   table is never left with nothing by a switch on English.
   ------------------------------------------------------------------ */

type CardLike = {
  id: string;
  lang?: string;
  sentence?: boolean;
  lines?: unknown[];
  uses?: string[];
  forms?: { ar?: string; en?: string; lat?: string; clips?: unknown[]; slowClips?: unknown[]; images?: unknown[] }[];
  subs?: unknown[];
};

const isWordCard = (c: CardLike): boolean =>
  !c.sentence && !(Array.isArray(c.lines) && c.lines.length) && !!(c.forms && c.forms.length);

/** Roughly what a word card can be asked, from what it holds. */
function roughlySupported(c: CardLike, usedByPhrase: boolean): string[] {
  const f = (c.forms || [])[0] || {};
  const any = (k: "clips" | "images") =>
    (c.forms || []).some((x) => Array.isArray(x[k]) && x[k]!.length) ||
    (k === "clips" && (c.forms || []).some((x) => Array.isArray(x.slowClips) && x.slowClips.length));
  const out: string[] = [];
  if (f.en) out.push("ar2pick", "ar2en", "match", "en2pick", "en2ar");
  if (f.lat) out.push("tr2ar");
  if (any("clips")) out.push("recmatch", "rec2ar", ...(f.en ? ["rec2en"] : []), ...(any("images") ? ["rec2img"] : []));
  if (any("images")) out.push("img2pick", "img2ar");
  if (usedByPhrase) out.push("ctx2pick", "ctx2ar");
  return out;
}

/** The word cards of a course that have nothing but English to teach
    them: no picture, recording or phrase. */
export function untaughtWithoutEnglish<C extends CardLike>(cards: C[]): C[] {
  const used = new Set(cards.flatMap((c) => (c.sentence ? c.uses || [] : [])));
  return cards.filter((c) => isWordCard(c) && allowedBy({ mode: "none", off: [] }, roughlySupported(c, used.has(c.id))).length === 0 && !!((c.forms || [])[0] || {}).en);
}

/** How many word cards these switches would leave with no question. */
export function withoutQuestions(cards: CardLike[], p: CoursePractice | null): number {
  if (!p) return 0;
  const used = new Set(cards.flatMap((c) => (c.sentence ? c.uses || [] : [])));
  return cards.filter((c) => {
    if (!isWordCard(c)) return false;
    const can = roughlySupported(c, used.has(c.id));
    return can.length > 0 && allowedBy(p, can).length === 0;
  }).length;
}
