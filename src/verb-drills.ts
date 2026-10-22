/*
 * The practices of one tense of a verb, as a whole.
 *
 * Every other question holds up one form and asks about it, so a verb was
 * thirty unrelated words to a learner: nothing ever showed a tense laid out
 * by person, or put the forms that look alike side by side. These do. The
 * language's verb table says which of them it offers (`practices`), each
 * is an exercise in the ordinary table marked `verbDrill`, and each is
 * scheduled on every form of the tense like any other question.
 *
 * Pure, and about one card at a time: the trainer hands in the card a cell
 * belongs to, because availableTypes is handed a form and a tense is a
 * fact about the card it is on.
 *
 * Nothing here colours or divides a form. The table is the pattern; what
 * changes from person to person is for the learner to see.
 */

import type { Form, Lang, VerbPerson, VerbSpec, VerbTense } from "./types.ts";
import { EX, tablesOf, typeOf } from "./languages.ts";
import { colOf, isCell, isCitation, ownerOf, rowIdsOf, rowOf, tableOf } from "./verbs.ts";

/** Whether a schedule key is one of the verb practices. */
export const isVerbDrill = (key: string | null | undefined): boolean => {
  const spec = key ? EX[typeOf(key)] : null;
  return !!(spec && spec.verbDrill);
};

/** Whether it is asked of the whole tense at once, marking every form in it. */
export const isRowDrill = (key: string | null | undefined): boolean => {
  const spec = key ? EX[typeOf(key)] : null;
  return !!(spec && spec.verbDrill === "row");
};

/**
 * The table a cell sits in, where that table offers verb practices.
 *
 * Read off the row, which is what tells one table from another. Null for
 * anything that is not a cell of the card's own table, and for a table
 * whose language declares no practices.
 */
export function drillTable(lang: Lang | null | undefined, cell: unknown): VerbSpec | null {
  if (!lang || !isCell(cell) || ownerOf(cell)) return null;
  const row = rowOf(cell);
  return (
    Object.values(tablesOf(lang)).find(
      (spec) => !!spec && Array.isArray(spec.practices) && spec.practices.length > 0 && rowIdsOf(spec).has(row),
    ) || null
  );
}

/** One person of a tense and the form the teacher wrote for them. */
export interface TensePlace {
  person: VerbPerson;
  form: Form;
}

/** One tense of one verb: its persons in the language's order, filled ones only. */
export interface Tense {
  tense: VerbTense;
  places: TensePlace[];
}

const written = (form: Form | null | undefined): boolean => !!form && !!String(form.ar || "").trim();

/**
 * The tense a cell belongs to, as the screens lay it out.
 *
 * Every person the teacher filled in, in the order the language lists
 * them — including the cell a dictionary cites, which belongs on the
 * screen with its tense even though it is not asked these questions.
 */
export function tenseOf(card: unknown, spec: VerbSpec | null | undefined, row: string): Tense | null {
  if (!spec) return null;
  const cells = tableOf(card, spec, "").filter((c) => c.row === row && written(c.form));
  if (!cells.length) return null;
  return {
    tense: cells[0].tense,
    places: cells.map((c) => ({ person: c.person, form: c.form as Form })),
  };
}

/**
 * A form as its letters, the way the language counts them.
 *
 * Two forms that differ only in what the language's marking forgives —
 * Arabic's harakat — are one form to a learner looking at them, and asking
 * which person is "يكتب" between two persons written that way is asking
 * nothing. Without a fold of its own, the form as written.
 */
export function lettersOf(text: unknown, lang: Lang | null | undefined): string {
  const s = String(text || "").trim();
  const fold = lang && lang.letter;
  if (!fold) return s;
  return Array.from(s)
    .map((ch) => fold(ch, {}))
    .join("");
}

/** Whether two forms read the same, by the language's letters. */
export const sameLetters = (a: Form | null | undefined, b: Form | null | undefined, lang: Lang | null | undefined): boolean =>
  !!a && !!b && lettersOf(a.ar, lang) === lettersOf(b.ar, lang);

/**
 * Whether a cell can be asked this verb practice.
 *
 * Its language has to offer it on this table, and the tense has to give
 * the question something to be about: two persons at least, and — for the
 * questions that tell forms apart — two forms that are not the same
 * letters. The cell a dictionary cites is left out: it is the word on the
 * front of the card and is met before its tense opens, so a question about
 * its whole tense would be the next tense shown early.
 */
export function drillFits(
  card: unknown,
  cell: Form,
  type: string,
  lang: Lang | null | undefined,
  /* Where the tense is held as a skill, the cited cell is one of its
     persons like any other and is asked them too — see tense-skills.ts. */
  citedToo = false,
): boolean {
  const spec = EX[typeOf(type)];
  if (!spec || !spec.verbDrill) return true;
  const table = drillTable(lang, cell);
  if (!table || !(table.practices || []).includes(typeOf(type))) return false;
  if (isCitation(table, cell) && !citedToo) return false;
  const tense = tenseOf(card, table, rowOf(cell));
  if (!tense || tense.places.length < 2) return false;
  if (!tense.places.some((p) => p.form.id === cell.id)) return false;
  const others = tense.places.filter((p) => p.form.id !== cell.id);
  /* Something in the tense that is not this form's letters: a person to
     choose wrongly, a tile that is not the answer, a person to change to. */
  return others.some((p) => !sameLetters(p.form, cell, lang));
}

/**
 * The persons a "who is it?" question offers, the right one first.
 *
 * Every person whose form reads the same as the one asked is right —
 * بتكتب is *you (m)* and *she* — so all of them are offered and any is
 * accepted. The wrong ones are the persons whose forms are nearest in
 * spelling, so what is asked is the difference that is easy to miss.
 */
export function whoChoices(
  tense: Tense,
  asked: Form,
  lang: Lang | null | undefined,
  distance: (a: string, b: string) => number,
  wanted: number,
): { right: VerbPerson[]; wrong: VerbPerson[] } {
  const mine = lettersOf(asked.ar, lang);
  const right = tense.places.filter((p) => lettersOf(p.form.ar, lang) === mine).map((p) => p.person);
  const wrong = tense.places
    .filter((p) => lettersOf(p.form.ar, lang) !== mine)
    .map((p, i) => ({ p, d: distance(lettersOf(p.form.ar, lang), mine), i }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((x) => x.p.person);
  return { right, wrong: wrong.slice(0, Math.max(0, wanted - Math.min(right.length, 1))) };
}

/**
 * Whether the person chosen is right for the form asked: their form in
 * this tense reads the same.
 */
export function whoIsRight(tense: Tense, asked: Form, personId: string, lang: Lang | null | undefined): boolean {
  const place = tense.places.find((p) => p.person.id === personId);
  return !!place && sameLetters(place.form, asked, lang);
}

/**
 * Every person of a tense against the tile put beside them.
 *
 * Right where the tile reads exactly as the teacher wrote that person's
 * form — so two tiles spelt the same are each right in either place. An
 * empty place is a miss.
 */
export function rowMarks(tense: Tense, placed: Record<string, string>): { form: Form; right: boolean }[] {
  return tense.places.map((p) => ({
    form: p.form,
    right: String(placed[p.person.id] || "").trim() !== "" && String(placed[p.person.id]).trim() === String(p.form.ar || "").trim(),
  }));
}

/**
 * The form a "change the person" question starts from.
 *
 * Another person of the same tense whose form is not the same letters —
 * a cue reading like the answer would make the question copying — and of
 * those, the one the learner has got furthest with, so it is a form they
 * know. `rank` says how far that is; ties go to the seed, so the cue moves
 * between askings rather than being the same person for ever.
 */
export function shiftCue(
  tense: Tense,
  asked: Form,
  lang: Lang | null | undefined,
  rank: (form: Form) => number,
  seed: number,
): TensePlace | null {
  const pool = tense.places.filter((p) => p.form.id !== asked.id && !sameLetters(p.form, asked, lang));
  if (!pool.length) return null;
  const best = Math.max(...pool.map((p) => rank(p.form)));
  const top = pool.filter((p) => rank(p.form) === best);
  return top[Math.abs(Math.floor(seed)) % top.length];
}

/** The person a cell is, in its tense. */
export const placeOf = (tense: Tense | null, cell: Form | null | undefined): TensePlace | null =>
  (tense && cell && tense.places.find((p) => p.form.id === cell.id)) || null;

/** The column a form sits in, for the screens that name it. */
export const personIdOf = (cell: unknown): string => colOf(cell);
