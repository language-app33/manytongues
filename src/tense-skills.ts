/*
 * A verb's tense, learnt as one thing.
 *
 * Until this, every person of every tense was a word of its own: its own
 * ladder, its own reviews, one of them a session. A Palestinian verb was
 * two dozen things to learn and a Hebrew one more, and the persons of a
 * tense — which are one pattern, and are what the tense practices show —
 * arrived a sitting at a time. Now a tense is a **skill**, the way a
 * stretch of the number line is: it holds one schedule and climbs one
 * ladder, it carries no words of its own, and every question about it is
 * asked of a person drawn when the question is dealt.
 *
 * What a tense is stored as is a form of the verb card with no words on
 * it and a `tense` naming its row — so the schedule rides wherever a
 * form's does (the merge between devices, the fold of a teacher's card,
 * the drawer a withdrawn card's progress waits in) and nothing about those
 * had to learn what a tense is. Its id is made from the card's and the
 * row's, so a teacher's refresh hands back the same form.
 *
 * The persons are still the cells they always were, and they still carry
 * their own states: every answer about a person is written on it as well
 * as on the tense. They are no longer dealt or counted, but they are what
 * says which persons keep going wrong (`shaky`), whether every person of a
 * tense has been answered right on a level (`capOf`, which is what holds
 * the tense on that level until they have), and whom to ask next
 * (`drawPerson`). And they are the progress a learner had before this,
 * kept, for the day it is wanted back.
 *
 * Only on a table whose language lists the tense practices — Arabic's and
 * Hebrew's verbs. Vietnamese's verb is one form for everybody and is asked as it
 * always was; so are the pronouns on the end of a word, and an adjective's
 * forms.
 *
 * Pure, and about one card at a time. What a person can be asked depends
 * on the trainer's indexes, so it is handed in.
 */

import type { ExerciseState, Form, Lang, VerbSpec } from "./types.ts";
import { formsOf, leadOf, subFormsOf } from "./cards.ts";
import { levelOf, typeOf, verbOf } from "./languages.ts";
import { solid } from "./scheduler.ts";
import { isCell, ownerOf, rowIdsOf, rowOf, tensesOf } from "./verbs.ts";
import { sameLetters, tenseOf } from "./verb-drills.ts";
import type { Tense, TensePlace } from "./verb-drills.ts";
import { hash } from "./chance.ts";

/** Seeing the pattern: the one answer that is the learner's word for the whole table. */
export const PATTERN = "vpattern";

/**
 * The verb table whose tenses are skills, where the language has one: the
 * one that offers the practices of a tense as a whole.
 */
export function skillTableOf(lang: Lang | null | undefined): VerbSpec | null {
  const spec = verbOf(lang);
  return spec && Array.isArray(spec.practices) && spec.practices.length > 0 ? spec : null;
}

/** Whether a form is a tense held as a skill. */
export const isTenseForm = (form: unknown): boolean =>
  !!form && typeof form === "object" && typeof (form as Record<string, unknown>).tense === "string" &&
  String((form as Record<string, unknown>).tense) !== "";

/** What the tense of a row is called on a device: the card's id and the row's. */
export const tenseIdOf = (leadId: string, row: string): string => `${leadId}-t~${row}`;

/** Every tense a card holds as a skill, in the order the forms list them. */
export const tenseFormsOf = (card: unknown): Form[] => subFormsOf(card).filter(isTenseForm);

/** The tense of one row, where the card holds it as a skill. */
export const tenseFormAt = (card: unknown, row: string): Form | null =>
  tenseFormsOf(card).find((f) => f.tense === row) || null;

/** The row a tense form is the skill of. */
export const rowOfTense = (form: unknown): string =>
  isTenseForm(form) ? String((form as Record<string, unknown>).tense) : "";

/**
 * Whether a cell of the verb's table is held by its tense rather than asked
 * on its own: a cell of the card's own word's table, in a row the card holds
 * as a skill.
 */
export function heldByTense(card: unknown, cell: unknown, spec: VerbSpec | null | undefined): boolean {
  /* A cell has a column as well as a row: a verb's own sentence carries a
     row and no column, and is asked as the sentence it is. */
  if (!spec || !isCell(cell) || ownerOf(cell)) return false;
  if (!rowIdsOf(spec).has(rowOf(cell))) return false;
  return !!tenseFormAt(card, rowOf(cell));
}

/** The persons of a tense held as a skill, as the screens lay them out. */
export const placesOfTense = (card: unknown, spec: VerbSpec | null | undefined, form: unknown): Tense | null =>
  isTenseForm(form) && spec ? tenseOf(card, spec, rowOfTense(form)) : null;

/* ---- made, and seeded from the persons ---- */

const isFresh = (s: ExerciseState | null | undefined): boolean =>
  !s || (s.phase === "new" && !(s.reps || 0) && !(s.hist || []).length && !(s.right || 0) && !(s.wrong || 0));

const PHASE_RANK: Record<string, number> = { new: 0, learning: 1, relearning: 1, review: 2 };

/* How far along one state is, for finding the middle of a tense's persons:
   past its level before anything else, then its phase, then its gap. */
const progressOf = (s: ExerciseState | null | undefined): number =>
  isFresh(s)
    ? 0
    : (solid(s as ExerciseState) ? 1e7 : 0) + (PHASE_RANK[(s as ExerciseState).phase] || 0) * 1e5 +
      Math.min(99999, Math.round(((s as ExerciseState).interval || 0) * 100));

/**
 * Where most of a tense's persons are on one question: the middle of them.
 *
 * A person never asked it counts, as a person at the bottom — a tense whose
 * he and she had climbed and whose six others never were is not half way
 * up. Even counts take the lower of the two middles, so a tense is never
 * credited with more than the person at its centre has.
 */
export function middleState(states: (ExerciseState | null | undefined)[]): ExerciseState | null {
  if (!states.length) return null;
  const ranked = states.slice().sort((a, b) => progressOf(a) - progressOf(b));
  const mid = ranked[Math.floor((ranked.length - 1) / 2)];
  return isFresh(mid) ? null : { ...(mid as ExerciseState) };
}

/**
 * A card with every tense it has written down held as a skill.
 *
 * A row with at least one person written is given its tense, once; a row
 * left blank is not, so the Progress tab counts only the tenses a teacher
 * has filled in. A tense with nothing answered on it yet starts where most
 * of its persons are, question by question (`middleState`) — which is what
 * the persons a learner had already practised hand on when this arrives,
 * and nothing at all for a verb nobody has started. The persons keep their
 * own states either way.
 *
 * The same card back where there is nothing to do, so a caller can tell.
 */
export function withTenses<T extends Record<string, any>>(card: T, lang: Lang | null | undefined): T {
  const spec = skillTableOf(lang);
  if (!spec || !card || !Array.isArray(card.forms) || !card.forms.length) return card;
  const lead = leadOf(card);
  let forms: Form[] | null = null;
  const all = (): Form[] => (forms = forms || formsOf(card).slice());
  for (const row of tensesOf(spec)) {
    const tense = tenseOf(card, spec, row.id);
    if (!tense) continue;
    const id = tenseIdOf(lead.id, row.id);
    const at = (forms || formsOf(card)).findIndex((f) => f.id === id);
    const had = at >= 0 ? (forms || formsOf(card))[at] : null;
    const own: Record<string, ExerciseState> = (had && had.s) || {};
    const answered = Object.values(own).some((s) => !isFresh(s));
    const seeded: Record<string, ExerciseState> = {};
    if (!answered) {
      const keys = new Set<string>();
      for (const p of tense.places) for (const k of Object.keys(p.form.s || {})) if (typeOf(k) === k) keys.add(k);
      for (const k of keys) {
        const mid = middleState(tense.places.map((p) => (p.form.s || {})[k]));
        if (mid) seeded[k] = mid;
      }
    }
    if (had && !Object.keys(seeded).length) continue;
    const made: Form = {
      ...(had || {
        id,
        ar: "",
        en: "",
        lat: "",
        lang: (lead.lang || card.lang) as Form["lang"],
        tense: row.id,
        created: Number(card.created) || 0,
      }),
      s: { ...own, ...seeded },
    };
    if (at >= 0) all()[at] = made;
    else all().push(made);
  }
  return forms ? ({ ...card, forms } as T) : card;
}

/* ---- what the persons say ---- */

/**
 * How badly one question about a person is going — the same reading the
 * Weak spots session makes: 2 for wrong twice running, 1 for a miss in its
 * last two outings, 0 for nothing to fix.
 */
export function weaknessOf(s: ExerciseState | null | undefined): number {
  const h = (s && s.hist) || [];
  if (h.length >= 2 && h.slice(-2).every((x) => !x)) return 2;
  return h.slice(-2).some((x) => !x) ? 1 : 0;
}

/** Whether a person has gone wrong lately on one question. */
export const shakyOn = (cell: Form | null | undefined, key: string): boolean =>
  !!cell && weaknessOf((cell.s || {})[key]) > 0;

/**
 * Whether a person has gone wrong lately on anything: a miss in the last
 * two outings of any question about them. Seeing the pattern is left out,
 * since "I don't get it" is about the whole table and not about anyone.
 */
export function shaky(cell: Form | null | undefined): boolean {
  if (!cell) return false;
  return Object.entries(cell.s || {}).some(([k, s]) => typeOf(k) !== PATTERN && weaknessOf(s) > 0);
}

/** The persons of a tense that keep going wrong, in the language's order. */
export const shakyPlaces = (tense: Tense | null): TensePlace[] =>
  tense ? tense.places.filter((p) => shaky(p.form)) : [];

/**
 * Whether a person has been answered right on a level, by anything but
 * seeing the pattern — which is the learner's word for the whole table and
 * says nothing about anyone in it.
 */
export function rightAt(cell: Form | null | undefined, level: number): boolean {
  if (!cell) return false;
  return Object.entries(cell.s || {}).some(
    ([k, s]) =>
      typeOf(k) !== PATTERN &&
      levelOf(k) === level &&
      !!s &&
      ((s.hist || []).some((x) => !!x) || (s.right || 0) > 0),
  );
}

/**
 * Whether a person counts as answered right on a level. Two persons spelt
 * the same — بتكتب is *you (m)* and *she* — are one word, so a right answer
 * on either counts for both.
 */
export const coveredAt = (tense: Tense, place: TensePlace, level: number, lang: Lang | null | undefined): boolean =>
  tense.places.some((q) => (q.form.id === place.form.id || sameLetters(q.form, place.form, lang)) && rightAt(q.form, level));

/**
 * The level a tense is held on until every person of it has been answered
 * right there — or null where nothing holds it.
 *
 * A level opens on two right answers running, as everywhere; on a tense it
 * also waits until each person who can be asked something on the level
 * below has been answered right on it at least once, so a tense never moves
 * past a person it has never been asked. Read level by level from the
 * bottom, and only over the levels the tense has questions on; a person
 * with nothing to be asked on a level holds nothing back there.
 *
 * `supports` is what a person could be asked, as if alone.
 */
export function capOf(
  tense: Tense | null,
  keys: string[],
  supports: (cell: Form) => string[],
  lang: Lang | null | undefined,
): number | null {
  if (!tense) return null;
  const levels = [...new Set(keys.filter((k) => typeOf(k) !== PATTERN).map(levelOf))].sort((a, b) => a - b);
  for (const level of levels) {
    const asked = tense.places.filter((p) => supports(p.form).some((k) => typeOf(k) !== PATTERN && levelOf(k) === level));
    if (!asked.length) continue;
    if (!asked.every((p) => coveredAt(tense, p, level, lang))) return level;
  }
  return null;
}

/**
 * Whom one question about a tense is asked of.
 *
 * In this order: somebody not yet asked in this sitting; somebody who went
 * wrong on this very question; somebody not yet answered right on its
 * level; somebody going wrong on anything; then whoever has been asked it
 * least. What is left is split by a seed made of the tense, the question
 * and its count of right answers — so a re-render cannot swap the person
 * under somebody answering, and a right answer moves on.
 *
 * `asks` is whether a person can be asked this question at all.
 */
export function drawPerson(
  tense: Tense | null,
  key: string,
  asks: (cell: Form) => boolean,
  seed: string,
  lang: Lang | null | undefined,
  taken: Set<string> = new Set(),
): TensePlace | null {
  if (!tense) return null;
  const pool = tense.places.filter((p) => asks(p.form));
  if (!pool.length) return null;
  const level = levelOf(key);
  const rank = (p: TensePlace): number[] => [
    taken.has(p.form.id) ? 1 : 0,
    shakyOn(p.form, key) ? 0 : 1,
    typeOf(key) !== PATTERN && !coveredAt(tense, p, level, lang) ? 0 : 1,
    shaky(p.form) ? 0 : 1,
    (((p.form.s || {})[key] || {}).hist || []).length,
    hash(`${seed} ${p.form.id}`) >>> 0,
  ];
  const scored = pool.map((p) => ({ p, r: rank(p) }));
  scored.sort((a, b) => {
    for (let i = 0; i < a.r.length; i++) if (a.r[i] !== b.r[i]) return a.r[i] - b.r[i];
    return 0;
  });
  return scored[0].p;
}

/**
 * What one answer about a whole tense says about the tense: right only
 * where every person in it was right. Each person is marked on their own
 * as well.
 */
export const tenseRight = (marks: { right: boolean }[]): boolean => marks.length > 0 && marks.every((m) => m.right);
