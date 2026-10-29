/*
 * Basic and advanced cards.
 *
 * A quick card is a word or phrase with one form, in no sentence and no
 * scene: a name, the word and its English, and its decks, all on the card
 * screen's first tab. Everything else — the type, the subtype, more forms,
 * blanks, other meanings — is on the Advanced tab, which is there only
 * while "Build an advanced card" is ticked. The owner's design, 0.515.
 *
 * Kept apart from the card editor so the rules can be tested on their own.
 */
import type { Card } from "./types.ts";
import { formsOf } from "./cards.ts";
import { isDialog } from "./dialogs.ts";
import { isSentence } from "./variables.ts";

type Shape = "word" | "sentence" | "scene";

const some = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : !!String(v || "").trim());

/* Whether a form has anything written in it — the card editor's own test. */
const written = (f: Record<string, any>): boolean =>
  some(f.ar) || some(f.lat) || some(f.en) || some(f.clips) || some(f.slowClips) || some(f.images) ||
  (Array.isArray(f.answers) && f.answers.some((a: any) => a && (some(a.text) || some(a.lat))));

/*
 * Whether a saved card opens with the box ticked: wherever it carries
 * anything the basic form would not show, so nothing on it is ever out of
 * sight.
 */
export function opensAdvanced(card: Card | null | undefined): boolean {
  if (!card) return false;
  if (isDialog(card as any) || isSentence(card)) return true;
  const c = card as Record<string, any>;
  return formsOf(card).length > 1 || some(c.category) || some(c.examples) || some(c.fills) ||
    some(c.ref) || some(c.uses) || some(c.clue);
}

/*
 * What a basic card is saved as: the card's own word and nothing the
 * Advanced tab holds. Whatever was written there and is still in the draft
 * — the teacher unticked the box — goes with this save, which the line
 * under the box says beforehand (see droppedByBasic).
 */
export function basicCard<T extends { forms: unknown[] }>(card: T, main: Record<string, any>): T {
  return {
    ...card,
    forms: [main],
    category: "",
    sentence: false,
    examples: [],
    uses: [],
    fills: [],
    ref: "",
    spread: [],
    stripped: [],
    drill: !!main && main.ask !== false,
    scene: null,
  };
}

/* What saving a basic card would drop from what is written in the draft,
   in the teacher's words, for the line under the box. */
export function droppedByBasic(
  word: { forms: Record<string, any>[]; tableCells?: Record<string, any>[]; category?: string; fills?: string[]; refName?: string; uses?: string[]; writtenExamples?: unknown[] },
  clue: string,
  picked: Shape,
): string[] {
  const out: string[] = [];
  if (picked === "sentence") out.push("the sentence");
  if (picked === "scene") out.push("the scene");
  const more = word.forms.slice(1).filter(written).length;
  if (more) out.push(more === 1 ? "1 other form" : `${more} other forms`);
  if ((word.tableCells || []).some((c) => some(c.ar) || some(c.en))) out.push("the table");
  if (some(word.category)) out.push("the subtype");
  if (some(word.writtenExamples)) out.push("the examples");
  if (some(word.fills) || some(word.refName)) out.push("the blanks it fills");
  if (some(word.uses)) out.push("the words it teaches");
  if (some(clue)) out.push("the clue for its other meanings");
  return out;
}
