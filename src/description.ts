/*
 * A word's description, in the language itself (0.695).
 *
 * A few words a teacher writes about a word in the language being learnt —
 * "where you buy bread" for *bakery* — with its English beside it if they
 * like. Two questions are asked from it: the word chosen out of four for
 * the description (`def2pick`, level 2), and the word written for it
 * (`def2ar`, level 4). See EX in languages.ts and the plan in
 * docs/PLAN-skills-switches-no-english.md, of which this is the part the
 * owner chose to build first.
 *
 * Kept on the card's own word — its first form — the way its pictures are,
 * so the Basic tab and the Advanced tab write it in the same place and
 * ticking "Build an advanced card" carries it over with nothing to copy.
 *
 * Pure, so the rules can be tested without a screen.
 */
import type { Lang } from "./types.ts";
import { answersOf } from "./answers.ts";
import { answerFields, findWordSpan } from "./languages.ts";

/** The two fields on a form: the description, and its English. */
export const DESC = "desc";
export const DESC_EN = "descEn";

/** The longest description stored — a line or two, not a paragraph. */
export const DESC_MAX = 240;

/** The exercises asked from a description. */
export const DESC_TYPES = ["def2pick", "def2ar"];

type CardShape = {
  forms?: Record<string, any>[];
  sentence?: boolean;
  lines?: unknown[];
};

const text = (v: unknown): string => String(v || "").trim();

/** Whether a card is a word or phrase — not a sentence or a scene — which
    is the only kind of card that has a description. */
export const takesDescription = (card: CardShape): boolean =>
  !card.sentence && !(Array.isArray(card.lines) && card.lines.length);

/*
 * Whether a card's description is asked. Only on a word or phrase with
 * one form, by the owner's choice: a verb's table or a noun's plural is
 * several words, and the description says which of them it means no more
 * than an English meaning would. A description on such a card is kept,
 * and the editor says it is not asked while the card has more forms.
 */
export function descriptionAsked(card: CardShape): boolean {
  const forms = card.forms || [];
  return takesDescription(card) && forms.length === 1 && !!text(forms[0] && forms[0][DESC]);
}

/*
 * The card's own word, where its description gives it away: the first of
 * its accepted answers that the description contains, as the language's
 * own matcher finds a word in a phrase — so البيت finds بيت. Empty where
 * none is in it. A warning, not a refusal: the teacher has the last word.
 */
export function givenAway(form: Record<string, any> | null | undefined, lang: Partial<Lang>): string {
  const desc = text(form && form[DESC]);
  if (!desc || !form) return "";
  const hit = answersOf(form, answerFields()).find((a) => text(a.text) && findWordSpan(desc, text(a.text), lang));
  return hit ? text(hit.text) : "";
}

/* The two fields as they are stored: trimmed, capped, and absent where
   empty, so a form with no description gains nothing. */
export function storedDescription(form: Record<string, any> | null | undefined): { desc?: string; descEn?: string } {
  const desc = text(form && form[DESC]).slice(0, DESC_MAX);
  const en = text(form && form[DESC_EN]).slice(0, DESC_MAX);
  return { ...(desc ? { desc } : {}), ...(desc && en ? { descEn: en } : {}) };
}
