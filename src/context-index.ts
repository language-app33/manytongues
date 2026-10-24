/*
 * Where each word turns up.
 *
 * A phrase a teacher wrote that contains a word they also teach is a
 * context for that word — somewhere it was really said. The pairing is
 * stored on the phrase, as the teacher confirmed it; this turns that round
 * into what everything else needs: for a given form, the phrases that show
 * it in use, and where inside each one it sits.
 *
 * It lived in the trainer, which meant only a learner could ask the
 * question. The teaching space needs the same answer about the same cards
 * — to say which exercises a card could be asked before anybody presses
 * anything — and two implementations of "is this word in that phrase"
 * would be two answers to it.
 *
 * Pure, and derived rather than stored: it cannot fall out of step with
 * the cards it came from, because it is rebuilt from them.
 */

import type { Form, Item, Lang } from "./types.ts";
import { bestWordIn, contextTokens, findWordSpan, guessKind, supportsContext, tensedOf } from "./languages.ts";
import { exampleCells, filledExample, verbExamplesOf } from "./examples.ts";
import { unitsOf } from "./scheduler.ts";
import { leadOf, wordOf } from "./cards.ts";
import { dialogPhrases } from "./dialogs.ts";

/*
 * Build it from the items in hand.
 *
 * A phrase names the *card* it teaches, because that is what a teacher
 * ticks. Which form of that card actually appears is a question for the
 * matcher: a phrase may hold the plural rather than the singular the card
 * leads with, and asking for the wrong form would be a question with no
 * right answer.
 */
/* Somewhere a word turned up: a phrase or a turn that contains it, with
   where inside it the word sits. `slot` is which token, `span` how many —
   a Vietnamese compound takes two, and a gap that blanked one syllable
   would leave the answer half written on the screen. */
export interface Context {
  id: string;
  ar: string;
  en: string;
  recs: { id: string }[];
  slot: number;
  span: number;
  /** Where it is one of a verb's own examples rather than a phrase
      somebody wrote: which one, and how it is said. See examples.ts. Its
      English is on the screen from the start, being what says which
      person the gap is in. */
  example?: number;
  lat?: string;
  /** The word as the phrase spells it, for finding it again once the
      phrase's blanks are filled — a value longer than one token moves it. */
  word?: string;
  /** Where the phrase is a card with blanks in it — "I'm learning
      {{language}}" — the card, so whoever shows the phrase can fill them
      the way the card's own questions do. Never shown as written. */
  frame?: Item;
}

/* What this reads of a phrase, which is all of what it reads. A card has
   these and so does a turn of a conversation, once dialogPhrases has handed
   it over in the same shape — and that is the whole reason a line can stand
   in for a phrase here without this knowing what a dialog is. */
type Source = {
  id: string;
  ar: string;
  en: string;
  uses?: string[];
  recs?: { id: string }[];
  lang?: string;
  frame?: Item;
};

export function buildContextIndex(items: Item[], lang: Lang): Map<string, Context[]> {
  const index = new Map<string, Context[]>();
  if (!supportsContext(lang)) return index;
  const byId = new Map(items.map((it) => [it.id, it]));

  /* A dialog's lines stand alongside the teacher's phrases here, in the
     same shape and on the same terms: a line that names the words it uses
     is somewhere those words turned up, and the gap-fill neither knows
     nor needs to know that this one came out of a conversation. It is
     what makes a scene worth writing on the first day — every word
     already being learnt gains a real exchange to be gapped inside of,
     with nothing new marked. */
  /* A card stands here as its own word — the first of its forms — with
     the card's own id and the words it teaches, which is what a phrase is
     to this index. */
  const sources: Source[] = [
    ...items.map((it) => ({ ...leadOf(it), id: it.id, uses: it.uses || [], lang: it.lang, frame: it })),
    ...dialogPhrases(items),
  ];
  for (const phrase of sources) {
    const uses = phrase.uses || [];
    if (!uses.length || !phrase.ar) continue;
    for (const targetId of uses) {
      const target = byId.get(targetId);
      if (!target) continue;
      /* One form per phrase: if a phrase contained both the singular and
         the plural it would be a context for each, but only one is the
         word the teacher meant — the one the phrase holds. The feminine
         فاهمة is found by the masculine فاهم too, and taking the first form
         found asked فاهم in "مش ___ة"; see bestWordIn. */
      const found = bestWordIn(
        phrase.ar,
        unitsOf(target).filter(({ unit }) => unit.ar).map(({ unit }) => ({ item: unit, word: unit.ar })),
        lang,
      );
      if (found) {
        const { item: unit, span } = found;
        const list = index.get(unit.id) || [];
        list.push({
          id: phrase.id,
          ar: phrase.ar,
          en: phrase.en,
          recs: phrase.recs || [],
          slot: span.at,
          /* How many tokens the word takes up. One in Arabic, two for a
             Vietnamese compound — and the gap has to cover all of them,
             because blanking one syllable of a two-syllable word leaves
             the answer half written on the screen. */
          span: span.len,
          word: unit.ar,
          ...(phrase.frame && /\{\{/.test(`${phrase.ar} ${phrase.en || ""}`) ? { frame: phrase.frame } : {}),
        });
        index.set(unit.id, list);
      }
    }
  }
  /* And a verb's own examples, once for every form of its subjunctive:
     the one place those forms are met, since none of them is asked as a
     word. See examples.ts. */
  for (const card of items) {
    const examples = verbExamplesOf(card);
    if (!examples.length) continue;
    const spec = tensedOf(lang, card.category);
    for (const cell of exampleCells(card, spec)) {
      examples.forEach((ex, at) => {
        const filled = filledExample(card, cell, ex, spec);
        if (!filled.ar || !filled.en) return;
        const span = gapIn(ex.ar, filled.ar, String(cell.ar || ""), lang);
        if (!span) return;
        const list = index.get(cell.id) || [];
        list.push({
          id: `${card.id}~ex${at}`,
          ar: filled.ar,
          en: filled.en,
          ...(filled.lat ? { lat: filled.lat } : {}),
          recs: [],
          slot: span.at,
          span: span.len,
          example: at,
        });
        index.set(cell.id, list);
      });
    }
  }
  return index;
}

/*
 * Where the verb sits in a filled example: where its gap was written, so
 * a form spelt like a word earlier in the example is not taken for it —
 * and, where the tokens do not line up, wherever the form is found.
 */
function gapIn(written: string, filled: string, word: string, lang: Lang): { at: number; len: number } | null {
  const before = String(written || "").split(/\{\{\s*verb\s*\}\}/i)[0];
  const at = before.trim() ? contextTokens(before, lang).length : 0;
  const len = contextTokens(word, lang).length;
  const tokens = contextTokens(filled, lang);
  if (len && at + len <= tokens.length) {
    const window = len === 1 ? tokens[at] : tokens.slice(at, at + len).join(" ");
    if (lang.context && lang.context.matches(window, word)) return { at, len };
  }
  return findWordSpan(filled, word, lang);
}

/*
 * The word cards a phrase or sentence could be ticked as teaching, for the
 * editor's "Words this teaches": every single-word card any of whose forms
 * turns up in `text`, with the form that did.
 *
 * Every form, not only the word on the front — a verb's conjugations, a
 * noun's plural — because a sentence saying "she wrote" teaches the card
 * for "he wrote" as surely as one saying "he wrote". The form is picked
 * the way buildContextIndex picks it (see bestWordIn), so the form named
 * here is the one the practice side will blank.
 *
 * Every card found, in the order its word comes in the text. This stopped
 * at 24, in the order the teacher's cards happen to be kept: a long text
 * lost whichever of its words came later in the collection, with nothing
 * to say any were missing, and a teacher took the missing عفواً for a
 * harakat the matcher had not ignored.
 *
 * A single word contains nothing, so it is offered nothing — except as a
 * line of a conversation (`line`), where a reply of one word, عفواً, is
 * still somewhere that word was really said.
 */
export function wordsOffered(
  text: string,
  cards: Item[],
  lang: Lang,
  selfId: string = "",
  { line = false }: { line?: boolean } = {},
): { card: Item; form: Form }[] {
  if (!supportsContext(lang) || !String(text || "").trim()) return [];
  if (!line && guessKind(text, lang) === "word") return [];
  const out: { card: Item; form: Form; at: number }[] = [];
  for (const card of cards || []) {
    if (!card || !card.id || card.id === selfId) continue;
    const lead = wordOf(card).ar;
    if (!lead || guessKind(lead, lang) !== "word") continue;
    const hit = bestWordIn(text, unitsOf(card).filter(({ unit }) => unit.ar).map(({ unit }) => ({ item: unit, word: unit.ar })), lang);
    if (hit) out.push({ card, form: hit.item, at: hit.span.at });
  }
  /* Stable, so two cards found at the same word keep the collection's order. */
  return out.sort((a, b) => a.at - b.at).map(({ card, form }) => ({ card, form }));
}
