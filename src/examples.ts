/*
 * The examples a verb's subjunctive is practised in.
 *
 * تاكل on its own means nothing a learner could be asked for: it is the
 * present without its b-, and it only ever follows another word — بدها
 * تاكل, لازم تاكل, رح تاكل. Asked as a word, it could only be glossed as
 * *(that) she eat*, which nobody says and nobody remembers. So it is not
 * asked as a word. The verb card carries up to three short examples with
 * a gap where the verb goes, and each subjunctive form is met inside them:
 *
 *     ar   لازم {{verb}}
 *     lat  laazim {{verb}}
 *     en   {{verb-who}} must {{verb-plain}}
 *
 * which is لازم آكل *I must eat*, لازم تاكلي *you (f) must eat*, and so
 * on down the table — one example written once, and every person of it
 * practised. The English is put together for each person from the words
 * in it (see verbReading in variables.ts), never typed per person, because
 * English has no subjunctive and the words it needs depend on the word in
 * front of the gap.
 *
 * Kept on the card rather than as forms of it: an example is not a thing
 * to learn, and nothing schedules it. What is scheduled is the form in
 * its gap, under the form's own id — see the context index, which is
 * where an example becomes somewhere a form turned up.
 *
 * Pure, and told the table rather than asking a language for it, like
 * verbs.ts.
 */
import type { Form, VerbExample, VerbSpec } from "./types.ts";
import { VERB_SLOT, cellsOf, colOf, personsOf, rowOf, tensesOf } from "./verbs.ts";
import type { Value } from "./variables.ts";
import { cellEnglish, fillText, slotsIn, speaks } from "./variables.ts";

/** The most examples a verb carries: two or three is what the owner asked
    for, and every one is asked of every person. */
export const MAX_EXAMPLES = 3;

const str = (x: unknown): string => (typeof x === "string" ? x.trim() : "");

/** The row of a table whose forms are practised in examples, or "" where
    it has none. */
export const examplesRowOf = (spec: VerbSpec | null | undefined): string =>
  (tensesOf(spec).find((t) => !!t.examples) || { id: "" }).id;

/** Whether one form is a cell of that row — a form asked only in the
    card's examples. */
export const inExamplesRow = (spec: VerbSpec | null | undefined, form: unknown): boolean => {
  const row = examplesRowOf(spec);
  return !!row && rowOf(form) === row && !!colOf(form);
};

/** Whether nothing at all has been written in an example. */
export const blankExample = (ex: Partial<VerbExample> | null | undefined): boolean =>
  !str(ex && ex.ar) && !str(ex && ex.lat) && !str(ex && ex.en);

/**
 * A card's examples as stored: trimmed, the blank ones dropped, at most
 * three. Anything that is not an example reads as none, rather than
 * throwing — a card is somebody's work.
 */
export function verbExamplesOf(card: unknown): VerbExample[] {
  const said = card && typeof card === "object" ? (card as Record<string, unknown>).examples : null;
  if (!Array.isArray(said)) return [];
  const out: VerbExample[] = [];
  for (const one of said) {
    if (!one || typeof one !== "object" || blankExample(one as VerbExample)) continue;
    const ex = one as Record<string, unknown>;
    const wish = str(ex.wish);
    out.push({
      ar: str(ex.ar),
      ...(str(ex.lat) ? { lat: str(ex.lat) } : {}),
      en: str(ex.en),
      ...(wish ? { wish } : {}),
    });
    if (out.length >= MAX_EXAMPLES) break;
  }
  return out;
}

const VERB = `{{${VERB_SLOT}}}`;
const READINGS = ["who", "plain", "to"].map((r) => `${VERB_SLOT}-${r}`);

/* How many times the verb's gap is written in some text. */
const gapsIn = (text: string): number => (String(text || "").match(/\{\{\s*verb\s*\}\}/gi) || []).length;

/**
 * What is wrong with one example, in the teacher's words, or "" where
 * nothing is. A blank example is not wrong: it is not there.
 */
export function exampleTrouble(ex: Partial<VerbExample> | null | undefined): string {
  if (!ex || blankExample(ex)) return "";
  const ar = str(ex.ar);
  const lat = str(ex.lat);
  const en = str(ex.en);
  if (!ar) return "Write the example in Arabic.";
  if (gapsIn(ar) !== 1) return `Write ${VERB} once in the Arabic, where the verb goes.`;
  if (slotsIn(ar).some((s) => s !== VERB_SLOT)) return `${VERB} is the only gap an example can have.`;
  if (lat && gapsIn(lat) !== 1) return `Write ${VERB} once in the transliteration too.`;
  if (lat && slotsIn(lat).some((s) => s !== VERB_SLOT)) return `${VERB} is the only gap an example can have.`;
  if (!en) return "Write what the example means in English.";
  const words = slotsIn(en);
  if (words.some((w) => !READINGS.includes(w))) {
    return "In the English, use {{verb-who}}, {{verb-plain}} or {{verb-to}} for the verb.";
  }
  if (!words.includes(`${VERB_SLOT}-who`) && !words.includes(`${VERB_SLOT}-to`)) {
    return "Use {{verb-who}} or {{verb-to}} in the English, so it changes with the person.";
  }
  return "";
}

/** Whether the English asks whose wish it is — see VerbExample.wish. */
export const asksWish = (ex: Partial<VerbExample> | null | undefined): boolean =>
  slotsIn(str(ex && ex.en)).includes(`${VERB_SLOT}-to`);

/**
 * Whose wish an example reads `{{verb-to}}` against: the one the teacher
 * chose, or the speaker where nobody has — بدي, the commonest. Nothing
 * where the English does not ask.
 */
export const wishOf = (ex: Partial<VerbExample> | null | undefined, spec: VerbSpec | null | undefined): string => {
  if (!asksWish(ex)) return "";
  const said = str(ex && ex.wish);
  if (said) return said;
  const first = personsOf(spec)[0];
  return first ? first.id : "";
};

/**
 * One example with one form in its gap: the words a question shows and
 * marks against. `card` is the verb, for the name its English is made
 * from; `cell` the form standing in the gap.
 */
export function filledExample(
  card: unknown,
  cell: Form,
  ex: VerbExample,
  spec: VerbSpec | null | undefined,
): { ar: string; en: string; lat: string } {
  const value: Value = {
    id: str(cell.id),
    ar: str(cell.ar),
    en: str(cell.en),
    lat: str(cell.lat),
    ...cellEnglish(card as Record<string, unknown>, cell as Record<string, unknown>),
    ...(speaks(cell as Record<string, unknown>) ? { keepsCase: true } : {}),
  };
  const values = { [VERB_SLOT]: value };
  const wish = wishOf(ex, spec);
  return {
    ar: fillText(ex.ar, values, "ar"),
    en: fillText(ex.en, values, "en", true, wish ? { [VERB_SLOT]: wish } : {}),
    lat: ex.lat && value.lat ? fillText(ex.lat, values, "lat") : "",
  };
}

/**
 * Every form of a card's examples row that is written, in the order the
 * language lists its persons — what the examples are asked of.
 */
export function exampleCells(card: unknown, spec: VerbSpec | null | undefined): Form[] {
  const row = examplesRowOf(spec);
  if (!row) return [];
  const order = personsOf(spec).map((p) => p.id);
  return cellsOf(card)
    .filter((c) => rowOf(c) === row && !str((c as Record<string, unknown>).of) && str(c.ar))
    .sort((a, b) => order.indexOf(colOf(a)) - order.indexOf(colOf(b)));
}
