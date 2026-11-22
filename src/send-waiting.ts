/*
 * A teacher's cards saved without a connection, sent from anywhere (0.669).
 *
 * They used to be sent only by the Teaching screen, on opening it and when
 * the connection came back while it was open: a teacher who saved cards on
 * a train and then stayed in Learning left them on the device. Now the
 * whole app can send them — the You menu's Sync now, the connection coming
 * back, anything getting through, and a check every few minutes while
 * something waits — and Teaching sends them the same way.
 *
 * One send at a time, whoever asks: two callers at once share the first
 * one's answer, so no card goes up twice.
 *
 * Here rather than in spaces.tsx because the trainer calls it, and that
 * file is loaded only when a teacher opens Teaching.
 */

import * as API from "./courses-api.ts";
import { leadOf } from "./cards.ts";
import { isOffline } from "./net.ts";
import { CARD_OUTBOX, drainOutbox, isTransient, waiting } from "./outbox.ts";
import { mediaIn, sendHeld, withoutMedia } from "./held-media.ts";
import type { Card } from "./types.ts";

/** A card as a teacher would name it, in a message about it. */
export const cardLabel = (c: Partial<Card>) =>
  (c && (leadOf(c as Card).ar || c.name || leadOf(c as Card).en)) || "A card";

/** What to say when a save left locked decks as they were. */
export function lockedNote(titles: Set<string>): string {
  const names = [...titles].map((t) => `"${t}"`).join(", ");
  return titles.size === 1
    ? `${names} is locked, so its cards were not changed.`
    : `${names} are locked, so their cards were not changed.`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

type Say = (message: string, kind?: string) => void;

/*
 * The pictures and recordings a card names that were added offline and
 * are still on this device go up before the card does (0.659), so no
 * student is ever handed a card whose picture or recording the server has
 * not got. `waiting`: some could not go yet, and the card waits with them.
 * One the server refuses is taken off the card, which goes without it, and
 * the teacher is told.
 */
export async function sendCardMedia(card: Partial<Card>, say: Say): Promise<{ card: Partial<Card>; waiting: boolean }> {
  const named = mediaIn(card);
  if (!named.length) return { card, waiting: false };
  const r = await sendHeld(API.putMedia, named);
  if (r.refused.length) {
    const pics = r.refused.filter((x) => x.kind === "image").length;
    const recs = r.refused.length - pics;
    const what = [pics ? plural(pics, "picture") : "", recs ? plural(recs, "recording") : ""].filter(Boolean).join(" and ");
    say(
      `${what} on "${cardLabel(card)}" couldn't be sent and ${r.refused.length === 1 ? "was" : "were"} left off: ${API.explain(new Error(r.refused[0].msg))}`,
      "warn",
    );
  }
  return {
    card: r.refused.length ? withoutMedia(card, r.refused.map((x) => x.hash)) : card,
    waiting: r.waiting.length > 0,
  };
}

/* Cards the server refused once they could be sent, and so dropped: kept
   for the red band across the top of Teaching, whichever part of the app
   sent them, until the teacher dismisses it. */
export type Dropped = { name: string; msg: string };
let dropped: Dropped[] = [];
const droppedWatchers: Set<(d: Dropped[]) => void> = new Set();
export function droppedCards(): Dropped[] {
  return dropped;
}
export function watchDropped(fn: (d: Dropped[]) => void): () => void {
  droppedWatchers.add(fn);
  return () => {
    droppedWatchers.delete(fn);
  };
}
export function dismissDropped() {
  dropped = [];
  for (const fn of [...droppedWatchers]) fn(dropped);
}
function noteDropped(more: Dropped[]) {
  dropped = dropped.concat(more);
  for (const fn of [...droppedWatchers]) fn(dropped);
}

let going: Promise<number> | null = null;

/**
 * Send every card waiting, oldest first, then anything else kept offline.
 * `onSaved` hears each answer — Teaching folds it into its lists. Says
 * what happened through `say`. Answers how many cards went.
 */
export function sendWaitingCards({ say, onSaved }: { say: Say; onSaved?: (r: any) => void }): Promise<number> {
  if (going) return going;
  going = (async () => {
    if (isOffline()) return 0;
    const lost: Dropped[] = [];
    const locked: Set<string> = new Set();
    const { sent } = await drainOutbox(CARD_OUTBOX, async (body) => {
      const held = body as { card: Partial<Card>; decks: string[]; extra?: API.SaveExtra; org?: string };
      try {
        /* Its pictures and recordings kept offline go first (0.659). */
        const media = await sendCardMedia(held.card, say);
        if (media.waiting) return "keep";
        const r = await API.saveCard(media.card, held.decks, held.extra || {}, held.org);
        if (r && Array.isArray(r.locked)) for (const d of r.locked) locked.add(d.title || "a deck");
        if (onSaved) onSaved(r);
        return "sent";
      } catch (e) {
        /* Waited through anything that is not the server's own refusal; a
           refusal drops it, and the teacher is told (0.580, audit finding 5). */
        const msg = String((e && (e as Error).message) || e);
        if (isTransient(msg)) return "keep";
        lost.push({ name: cardLabel(held.card), msg });
        return "drop";
      }
    });
    /* And with no card left waiting, whatever else was kept offline goes
       too: a picture or recording added to a card that was then closed
       without saving, say. Nothing names it, so a refusal is not said. */
    if (!waiting(CARD_OUTBOX) && !isOffline()) await sendHeld(API.putMedia);
    if (lost.length) {
      const n = lost.length;
      say(
        `${n} saved card${n === 1 ? "" : "s"} could not be sent and ${n === 1 ? "was" : "were"} discarded: ${API.explain(new Error(lost[0].msg))}`,
        "warn",
      );
      noteDropped(lost);
    }
    if (locked.size) say(lockedNote(locked), "warn");
    else if (sent) say(`${plural(sent, "card")} sent`, "good");
    return sent;
  })().finally(() => {
    going = null;
  });
  return going;
}
