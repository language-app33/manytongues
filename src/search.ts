/*
 * What a search box finds a card by.
 *
 * Every list of cards has a box to type into, and each of them used to
 * write out its own idea of what a card is to be found under. Most asked
 * the card's own word and nothing else, so a plural, a feminine, a cell of
 * a verb's table — every form after the first — could be typed exactly
 * and not be found: the learner's deck and progress lists, the picker for
 * individual cards, and the teacher's lists all missed them. The one list
 * that did walk the forms skipped their pronunciation.
 *
 * One answer, here, for all of them: a card is found under any of its
 * forms — the script, the pronunciation, the meaning — under its name
 * where it has one, under its tags, and under any turn of a conversation.
 * Case is ignored throughout. The caller hands in what was typed; this
 * trims and lowers it, so a list that has already done so loses nothing.
 */
import { formsOf } from "./cards.ts";
import { linesOf } from "./dialogs.ts";

const has = (value: unknown, needle: string): boolean =>
  typeof value === "string" && value.toLowerCase().includes(needle);

export function cardMatches(card: unknown, typed: string): boolean {
  const needle = String(typed || "").trim().toLowerCase();
  if (!needle) return true;
  if (!card || typeof card !== "object") return false;
  const c = card as Record<string, any>;
  return (
    formsOf(c).some((f) => !!f && (has(f.ar, needle) || has(f.lat, needle) || has(f.en, needle))) ||
    has(c.name, needle) ||
    (Array.isArray(c.tags) && c.tags.some((t: unknown) => has(t, needle))) ||
    linesOf(c as any).some((l: any) => !!l && (has(l.ar, needle) || has(l.lat, needle) || has(l.en, needle)))
  );
}
