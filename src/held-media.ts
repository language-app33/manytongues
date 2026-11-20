/*
 * Pictures and recordings added while offline (0.656).
 *
 * A card's pictures and recordings are sent to the server the moment they
 * are added in the card editor. Offline that used to fail, with "Can't
 * reach the server", while the card itself could be saved offline and was
 * kept until the connection came back. Now the picture or recording is
 * kept here too, by its hash, and goes up before the card that names it.
 *
 * Pictures and recordings are kept and sent the same way: the owner's
 * rule is that the two never behave differently.
 *
 * While it waits here, fetching it (courses-api's getClip and getImage)
 * reads it from here, so the editor shows it and practice on this device
 * plays it before the server has it.
 *
 * Its own small database rather than the trainer's media store: that one
 * is a cache, emptied by "Clear device media" and tidied of anything no
 * card names, and what is here is the only copy there is.
 *
 * The pure part — which hashes a card names, and taking refused ones off
 * it — is at the top, for the tests. Imports nothing from the network
 * side, which hands `send` in.
 */

import { isTransient } from "./outbox.ts";

export type HeldKind = "clip" | "image";

/* The fields of a card's forms and lines that name media by hash. */
const LISTS: Record<string, HeldKind> = { clips: "clip", slowClips: "clip", images: "image" };

/** Every picture and recording hash a card names, anywhere in it. */
export function mediaIn(card: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
      return;
    }
    if (!v || typeof v !== "object") return;
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (k in LISTS && Array.isArray(x)) {
        for (const h of x) if (typeof h === "string" && h) out.add(h);
      } else walk(x);
    }
  };
  walk(card);
  return [...out];
}

/**
 * The card without the given hashes: taken out of every list that names
 * them, and their speakers' names with them. Everything else is as it was.
 */
export function withoutMedia<T>(card: T, gone: Iterable<string>): T {
  const drop = new Set(gone);
  if (!drop.size) return card;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (!v || typeof v !== "object") return v;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (k in LISTS && Array.isArray(x)) out[k] = x.filter((h) => !drop.has(h as string));
      else if (k === "voices" && x && typeof x === "object" && !Array.isArray(x)) {
        out[k] = Object.fromEntries(Object.entries(x as Record<string, unknown>).filter(([h]) => !drop.has(h)));
      } else out[k] = walk(x);
    }
    return out;
  };
  return walk(card) as T;
}

/* ---------------- storage ---------------- */

interface Held {
  kind: HeldKind;
  /** A data URL, as it will be sent. */
  data: string;
  at: number;
}

const DB_NAME = "manytongues-held-media";
const STORE = "media";
let opening: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (opening) return opening;
  opening = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      /* A private mode that hangs rather than fails: not now, and the next
         call asks again. */
      setTimeout(() => {
        opening = null;
        resolve(null);
      }, 8000);
    } catch (e) {
      resolve(null);
    }
  });
  return opening;
}

/* Answers rather than throws, like the trainer's own store. */
async function run<T>(mode: IDBTransactionMode, fn: (st: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(undefined);
    } catch (e) {
      resolve(undefined);
    }
  });
}

const watchers: Set<() => void> = new Set();
function changed() {
  for (const f of [...watchers]) {
    try {
      f();
    } catch (e) {
      /* one watcher failing must not keep the rest from hearing */
    }
  }
}

/** Hear about anything being kept or sent. Returns the way to stop. */
export function watchHeld(fn: () => void): () => void {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

/** Keep one until it can be sent. False when there was nowhere to keep it. */
export async function holdMedia(kind: HeldKind, hash: string, data: string): Promise<boolean> {
  const ok = await run("readwrite", (st) => st.put({ kind, data, at: Date.now() } satisfies Held, hash));
  if (ok === undefined) return false;
  changed();
  return true;
}

/** The data URL of one waiting here, or null. */
export async function heldData(hash: string): Promise<string | null> {
  if (!hash) return null;
  const h = await run<Held>("readonly", (st) => st.get(hash));
  return h && typeof h.data === "string" ? h.data : null;
}

/** How many are waiting, of each kind. */
export async function heldCounts(): Promise<{ clips: number; images: number }> {
  const all = (await run<Held[]>("readonly", (st) => st.getAll())) || [];
  let clips = 0;
  let images = 0;
  for (const h of all) {
    if (h && h.kind === "image") images += 1;
    else if (h) clips += 1;
  }
  return { clips, images };
}

async function release(hash: string) {
  await run("readwrite", (st) => st.delete(hash));
}

/**
 * Send what is waiting, oldest first: those named in `only`, or all of
 * them. A hash that went is let go of. One the server refused is let go of
 * too and named in `refused`, so the card that names it can be sent
 * without it. Anything that could not go for want of a connection stays,
 * named in `waiting`, and nothing after it is tried.
 */
export async function sendHeld(
  send: (kind: HeldKind, hash: string, data: string) => Promise<unknown>,
  only?: Iterable<string> | null,
): Promise<{ sent: number; refused: { hash: string; kind: HeldKind; msg: string }[]; waiting: string[] }> {
  const keys = ((await run<IDBValidKey[]>("readonly", (st) => st.getAllKeys())) || []).filter(
    (k): k is string => typeof k === "string",
  );
  const wanted = only ? new Set(only) : null;
  const items: { hash: string; held: Held }[] = [];
  for (const hash of keys) {
    if (wanted && !wanted.has(hash)) continue;
    const held = await run<Held>("readonly", (st) => st.get(hash));
    if (held) items.push({ hash, held });
  }
  items.sort((a, b) => a.held.at - b.held.at);
  let sent = 0;
  const refused: { hash: string; kind: HeldKind; msg: string }[] = [];
  const waiting: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const { hash, held } = items[i];
    try {
      await send(held.kind, hash, held.data);
      await release(hash);
      sent += 1;
    } catch (e) {
      const msg = String((e && typeof e === "object" && "message" in e && (e as Error).message) || e);
      /* The same line the card outbox draws: try again later, or let go. */
      if (isTransient(msg)) {
        waiting.push(...items.slice(i).map((x) => x.hash));
        break;
      }
      await release(hash);
      refused.push({ hash, kind: held.kind === "image" ? "image" : "clip", msg });
    }
  }
  if (sent || refused.length) changed();
  return { sent, refused, waiting };
}
