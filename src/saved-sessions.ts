/*
 * Which cards a saved session holds, read at the moment it is used.
 *
 * A saved session names its material three ways: whole decks, by the name
 * every card in them carries as a tag; everything the learner has; and
 * single cards, by id. The first two are read against the cards as they
 * are now, so a deck that has grown since the session was kept brings its
 * new cards into it, and a card taken out of the deck leaves. Single cards
 * are only the ones picked one at a time — a card picked as part of a
 * whole deck is not also named, or it would stay after leaving the deck.
 *
 * Kept apart from the screens so the one answer is shared by the Start
 * button, the home screen's tile and the editor, and can be tested on
 * plain rows.
 */

import type { Item, SavedSession } from "./types.ts";

type Named = Pick<SavedSession, "ids" | "decks" | "everything">;

/** The cards of `items` the session holds now, in `items`' order. */
export function cardsOfSaved(s: Named, items: Item[]): Item[] {
  if (s.everything) return items;
  const ids = new Set(s.ids);
  const decks = new Set(s.decks || []);
  return items.filter((it) => ids.has(it.id) || (it.tags || []).some((t) => decks.has(t)));
}

/**
 * The single cards it names that are no longer among `items` — deleted
 * since, or another language's. A deck that has gone or been renamed is
 * not counted: it never said how many cards it would be.
 */
export function missingFromSaved(s: Named, items: Item[]): string[] {
  const here = new Set(items.map((it) => it.id));
  return s.ids.filter((id) => !here.has(id));
}

/**
 * What to keep, from what the Build screen has picked.
 *
 * A deck every card of which is picked is kept as the deck — which is
 * what its ticked box on the screen says — and every card picked as the
 * Everything row. A card a kept deck already covers is left off the list
 * of single cards, so it is in the session exactly as long as its deck
 * holds it.
 */
export function describeSaved({ picked, groups, all }: {
  picked: Set<string>;
  /** Each deck's name and the cards in it, as the screen shows them. */
  groups: Map<string, Item[]>;
  /** Every card the screen offers. */
  all: Item[];
}): Required<Named> {
  if (all.length && all.every((it) => picked.has(it.id))) return { ids: [], decks: [], everything: true };
  const decks = [...groups]
    .filter(([, cards]) => cards.length && cards.every((it) => picked.has(it.id)))
    .map(([name]) => name)
    .sort();
  const covered = new Set(decks.flatMap((d) => (groups.get(d) as Item[]).map((it) => it.id)));
  return {
    ids: [...picked].filter((id) => !covered.has(id)).sort(),
    decks,
    everything: false,
  };
}
