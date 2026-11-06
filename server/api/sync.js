import { getStore } from "../store.js";
import { createHash } from "node:crypto";
import { formsOf } from "../../src/cards.ts";

/*
 * Sync endpoint.
 *
 * There are no accounts. The passphrase is the whole credential: the
 * client sends its SHA-256, and the storage key is a further hash of
 * that. Two devices using the same passphrase share a document; nobody
 * without it can guess the key.
 *
 * The client does the merging. This endpoint only reads and writes,
 * using the ETag to refuse a write built on a stale read.
 */

const MAX_BYTES = 4 * 1024 * 1024;
const STORE = "arabic-trainer";

/** @param {string} token */
function keyFor(token) {
  return createHash("sha256").update(`arabic-trainer:${token}`).digest("hex");
}

/* Errors that mean the data directory is missing, read-only or full,
   rather than anything about the request: on a host where the volume was
   never mounted, this is what every call fails with. */
const STORAGE_ERRORS = new Set(["EACCES", "EROFS", "ENOSPC", "ENOTDIR", "EPERM", "EDQUOT"]);

/**
 * @param {unknown} body
 * @param {number} [status]
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/**
 * Erase a learner's practice history: their document and every recording
 * it names (0.543; docs/PLAN-spaces.md, 86a). Called when an account is
 * deleted. `token` is the SHA-256 hex of the sign-in key — the device's
 * tokenFor(key), and the keyHash the courses store already keeps — so the
 * server can find the document without ever knowing the key.
 *
 * A document that cannot be read is deleted anyway; its recordings, which
 * only it names, are then left behind, which is the lesser loss.
 * @param {string} token
 */
export async function forgetSyncDoc(token) {
  if (!/^[a-f0-9]{64}$/.test(String(token || ""))) return;
  const store = getStore(STORE);
  const key = keyFor(token);
  /** @type {string[]} */
  let ids = [];
  try {
    const held = await store.get(key, { type: "text", consistency: "strong" });
    const doc = held ? JSON.parse(String(held)) : null;
    for (const it of (doc && doc.items) || []) {
      for (const f of formsOf(it)) for (const r of f.recs || []) ids.push(String(r.id));
      for (const ln of it.lines || []) for (const r of ln.recs || []) ids.push(String(r.id));
    }
  } catch (e) {
    ids = [];
  }
  for (const id of new Set(ids)) {
    if (/^[A-Za-z0-9_-]{1,64}$/.test(id)) await store.delete(keyFor(`${token}:audio:${id}`)).catch(() => {});
  }
  await store.delete(key).catch(() => {});
}

/**
 * Carry a learner's practice document, and every recording it names, from
 * one token to another (0.580, audit finding 1). Called when an admin
 * issues a new sign-in key: the document lives under a hash of the old
 * key's token, and without this the new key opens an empty one.
 *
 * Never overwrites: if the new token already holds a document, nothing is
 * moved. A document that cannot be parsed is still moved byte for byte (the
 * GET above knows how to recover it); only its recordings are left behind,
 * because only it names them.
 * @param {string} oldToken
 * @param {string} newToken
 * @returns {Promise<{ moved: boolean, clips?: number, reason?: string }>}
 */
export async function moveSyncDoc(oldToken, newToken) {
  const hex = /^[a-f0-9]{64}$/;
  if (!hex.test(String(oldToken || "")) || !hex.test(String(newToken || ""))) return { moved: false };
  if (oldToken === newToken) return { moved: false };
  const store = getStore(STORE);
  const oldKey = keyFor(oldToken);
  const newKey = keyFor(newToken);
  const text = await store.get(oldKey, { type: "text", consistency: "strong" });
  if (text == null) return { moved: false };
  const there = await store.get(newKey, { type: "text", consistency: "strong" });
  if (there != null) return { moved: false, reason: "exists" };
  const wrote = await store.set(newKey, String(text), { onlyIfNew: true });
  if (wrote && wrote.modified === false) return { moved: false, reason: "exists" };
  /** @type {string[]} */
  let ids = [];
  try {
    const doc = JSON.parse(String(text));
    for (const it of (doc && doc.items) || []) {
      for (const f of formsOf(it)) for (const r of f.recs || []) ids.push(String(r.id));
      for (const ln of it.lines || []) for (const r of ln.recs || []) ids.push(String(r.id));
    }
  } catch (e) {
    ids = [];
  }
  let clips = 0;
  /** @type {string[]} */
  const copied = [];
  for (const id of new Set(ids)) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) continue;
    try {
      const clip = await store.get(keyFor(`${oldToken}:audio:${id}`), { type: "text", consistency: "strong" });
      if (clip == null) continue;
      await store.set(keyFor(`${newToken}:audio:${id}`), String(clip), { onlyIfNew: true });
      copied.push(id);
      clips += 1;
    } catch (e) {
      /* Best effort per clip: the document matters more than one recording. */
    }
  }
  for (const id of copied) await store.delete(keyFor(`${oldToken}:audio:${id}`)).catch(() => {});
  await store.delete(oldKey).catch(() => {});
  return { moved: true, clips };
}

/** @param {Request} req */
export default async (req) => {
  const token = req.headers.get("x-sync-token") || "";
  // The client always sends a 64-char hex digest. Anything else is noise.
  if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: "bad-token" }, 401);

  /* Clips live under their own keys so a document sync doesn't have to
     carry them. ?audio=<id> addresses one clip. */
  const url = new URL(req.url);
  const audioId = url.searchParams.get("audio");
  if (audioId && !/^[A-Za-z0-9_-]{1,64}$/.test(audioId)) {
    return json({ error: "bad-id" }, 400);
  }
  const key = audioId ? keyFor(`${token}:audio:${audioId}`) : keyFor(token);

  try {
    /* Inside the try: on a site without Blobs configured this throws, and
       out here that would reach the client as a 500 whose body is not
       JSON — indistinguishable from the endpoint being missing. */
    const store = getStore(STORE);
    if (req.method === "GET" && audioId) {
      const clip = await store.get(key, { type: "text", consistency: "strong" });
      if (clip == null) return json({ error: "not-found" }, 404);
      return json({ id: audioId, data: clip });
    }

    if (req.method === "POST" && audioId) {
      let body;
      try {
        body = await req.json();
      } catch (e) {
        return json({ error: "bad-json" }, 400);
      }
      const clip = String(body && body.data ? body.data : "");
      if (!clip) return json({ error: "no-data" }, 400);
      if (Buffer.byteLength(clip, "utf8") > MAX_BYTES) return json({ error: "too-large" }, 413);
      // Clips never change once written, so this is a plain put.
      await store.set(key, clip);
      return json({ ok: true, id: audioId });
    }

    if (req.method === "DELETE" && audioId) {
      await store.delete(key);
      return json({ ok: true });
    }

    if (req.method === "GET") {
      const res = await store.getWithMetadata(key, { type: "text", consistency: "strong" });
      if (!res || res.data == null) return json({ etag: null, data: null });
      try {
        return json({ etag: res.etag || null, data: JSON.parse(res.data) });
      } catch (e) {
        /* Fall through to the recovery below. */
      }
      /*
       * A document that cannot be read is not a document that was never
       * written, and answering as though it were is what made this the
       * worst failure in the app.
       *
       * It used to say `{ etag: null, data: null }` — exactly what a first
       * sync gets. The client then pushed as a first write, the store
       * refused because a file existed, the client re-pulled, pushed
       * again, was refused again, and gave up. Every device on that
       * passphrase, for ever, behind "Sync failed", with nothing from that
       * moment on ever leaving the phone.
       *
       * So the ETag of the unreadable bytes is handed back with whatever
       * can be recovered behind them. Either way the client can merge and
       * push, and its push carries an ETag that matches, so the write goes
       * through and replaces the wreckage. `lost` says the remote copy was
       * not readable, so the app can tell the learner that another device's
       * unsynced work may have gone with it rather than pretending all is
       * well.
       */
      const previous = await store.getPrevious(key);
      if (previous != null) {
        try {
          return json({ etag: res.etag || null, data: JSON.parse(previous), lost: "recovered" });
        } catch (e) {
          /* The copy behind it is no better. */
        }
      }
      return json({ etag: res.etag || null, data: null, lost: "unreadable" });
    }

    if (req.method === "POST") {
      let body;
      try {
        body = await req.json();
      } catch (e) {
        return json({ error: "bad-json" }, 400);
      }
      if (!body || typeof body.data !== "object" || body.data === null) {
        return json({ error: "no-data" }, 400);
      }

      const payload = JSON.stringify(body.data);
      /* In bytes, which is what the limit is about and what the transport
         in front of this counts. Measured by length it was counting UTF-16
         units, so a document written in Arabic was refused at roughly half
         the size one written in Latin letters was. */
      const size = Buffer.byteLength(payload, "utf8");
      if (size > MAX_BYTES) return json({ error: "too-large", size, limit: MAX_BYTES }, 413);

      /*
       * A push that would empty a document that is not empty.
       *
       * There is no legitimate way to reach this. A device with nothing on
       * it pulls before it pushes, so its merge adopts whatever is here and
       * what it sends is not empty; and a learner who has genuinely removed
       * every card has the headstones to show for it, which is what
       * `allowEmpty` reports. What is left is a merge that lost everything,
       * and one request is enough to make that permanent.
       *
       * Refused rather than kept as a second copy, because the copy behind
       * the document is one write deep: a wipe followed by one more sync
       * would push it out. The read is only done when the incoming document
       * has nothing in it, so the ordinary push pays nothing for this.
       */
      const incoming = Array.isArray(body.data.items) ? body.data.items : [];
      if (!incoming.length && !body.allowEmpty) {
        const held = await store.get(key, { type: "text", consistency: "strong" });
        let items = null;
        try {
          items = held ? JSON.parse(held).items : null;
        } catch (e) {
          /* Unreadable is what the GET above recovers; not this one's
             business, and not a reason to refuse the write that replaces
             it. */
        }
        if (Array.isArray(items) && items.length) {
          return json({ error: "would-empty", held: items.length }, 409);
        }
      }

      /* Refuse the write if the document moved since the client read it.

         No fallback to a plain write: the only thing a failed conditional
         write can be here is a transient error, and retrying it without the
         condition would be exactly the stale overwrite the ETag exists to
         prevent. The client treats a 5xx as "try again next time". */
      const opts = body.etag ? { onlyIfMatch: body.etag } : { onlyIfNew: true };
      const result = await store.set(key, payload, opts);
      if (result && result.modified === false) return json({ error: "conflict" }, 409);

      // set() reports the new ETag itself; no second round trip needed.
      return json({ ok: true, etag: (result && result.etag) || null });
    }

    if (req.method === "DELETE") {
      await store.delete(key);
      return json({ ok: true });
    }
  } catch (err) {
    const e = /** @type {NodeJS.ErrnoException | null} */ (err);
    const detail = String((e && e.message) || err);
    /* Storage that can't be written to is worth telling apart from any
       other failure: nothing about the request was wrong, and the thing to
       look at is the volume rather than the code. */
    if (e && e.code && STORAGE_ERRORS.has(e.code)) {
      return json({ error: "storage-unconfigured", detail }, 500);
    }
    return json({ error: "server", detail }, 500);
  }

  return json({ error: "method" }, 405);
};
