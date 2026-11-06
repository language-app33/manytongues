/*
 * One way to fetch a stored picture (0.580, audit finding 19).
 *
 * The card editor, the space's badge in the menu and the practice screens
 * each fetched pictures their own way, and the badge asked again every time
 * the menu opened. Pictures are stored under the hash of their own bytes,
 * so what one hash answers never changes: each is fetched once per
 * session, here, and every reader shares the answer. A failure is not
 * kept, so the next reader asks again.
 *
 * The learner's offline copy (IndexedDB, in the trainer) is filled from
 * this too; it lives beside the recordings in one database, which is why it
 * stays with them.
 */
import * as API from "./courses-api.ts";

const held: Map<string, Promise<string>> = new Map();

/** The picture's data URL. Rejects as the server did ("not-found", "offline"). */
export function pictureData(hash: string): Promise<string> {
  const had = held.get(hash);
  if (had) return had;
  const asked = API.getImage(hash).then((r: { data?: string }) => {
    if (!r || !r.data) throw new Error("not-found");
    return r.data;
  });
  asked.catch(() => held.delete(hash));
  held.set(hash, asked);
  return asked;
}

/*
 * Recordings the server has said it does not hold, and when it said so —
 * one list for the practice screens and the teaching screens alike (0.580:
 * each kept its own). Remembered for a few minutes rather than the whole
 * session: a recording published a moment ago can take up to a minute to
 * reach every edge.
 */
export const MISSING_CLIPS: Map<string, number> = new Map();
export const MISSING_FOR_MS = 5 * 60000;

export function knownMissing(id: string, now: number = Date.now()) {
  const at = MISSING_CLIPS.get(id);
  if (at === undefined) return false;
  if (now - at > MISSING_FOR_MS) {
    MISSING_CLIPS.delete(id);
    return false;
  }
  return true;
}

/** A picture made on this device, known before anyone asks the server. */
export function primePicture(hash: string, data: string) {
  held.set(hash, Promise.resolve(data));
}
