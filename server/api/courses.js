/** @import { Card, Course, Deck, User } from "../../src/types.ts" */
/**
 * The document store, as store.js hands it over. Named rather than repeated
 * at every helper below.
 * @typedef {ReturnType<typeof getStore>} Store
 */
import { getStore } from "../store.js";
import {
  forgetSyncDoc, moveSyncDoc, readSyncDoc, readSyncAudio, recordingIdsOf, syncSize, mergeSyncDoc, writeSyncAudioIfAbsent,
  MAX_BYTES as SYNC_MAX_BYTES,
} from "./sync.js";
import { createHash, randomBytes } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
/* The one list of grammatical fields a card may carry, shared with the app so
   that adding an axis to a language does not silently drop it here. */
import { answerFields, grammarFields } from "../../src/languages.ts";
import { answersOf } from "../../src/answers.ts";
import { cardRef, droppedIn, fillNames, fillsOf, isSentence, MAX_FILLS, renamedIn, slotName, slotsOf } from "../../src/variables.ts";
import { isDialog, isText, linesOf, pickedFrom, pickedLine, TEXT } from "../../src/dialogs.ts";
/* Which member of a scene's cast each blank of a turn plays — see cast.ts. */
import { cleanRoles, memberName } from "../../src/cast.ts";
import { formsOf } from "../../src/cards.ts";
/* And which tenses a sentence's blanks ask their verbs for, read the one
   way the app reads it. */
import { NO_PARTNER, slotLinks, slotRows } from "../../src/verbs.ts";
import { holedParts, isSentenceKey, reviewOf } from "../../src/review.ts";
/* A number system and a time system are read at this boundary the way an
   answer is: hand-written, total, and silent about why. See
   src/numbers/schema.ts, and DECISIONS.md on why not a schema library. */
import { clipsOfSystem, emptyNumberSystem, readNumberSystem, readTimeSystem } from "../../src/numbers/schema.ts";
import { composerFor, timeComposerFor } from "../../src/numbers/index.ts";
import { rangeChecks } from "../../src/numbers/range.ts";
import { partsNow } from "../../src/numbers/types.ts";
import { migrateCards } from "../../src/numbers/migrate.ts";
import { liftSubtypeTagsIn } from "../../src/subtype-tags.ts";
import { tickCapitals } from "../../src/capitals.ts";
/* A course's path (0.613): every rule of it is in path.ts, read here the
   way the app reads it. */
import { countingCards, drawsFrom, isLiveIn, neverAskedAlone, unitProblems } from "../../src/path.ts";
import { LANGUAGES } from "../../src/languages.ts";
import { fillerCards } from "../../src/numbers/generate.ts";
import { countedNouns, withNouns } from "../../src/numbers/nouns.ts";

/* Locking a deck is set aside for now: a locked deck's flag is kept, but
   nothing is refused because of it. Turn back on to bring locks back. */
const DECK_LOCKS = false;

/*
 * Courses, decks and the people who use them.
 *
 * Identity:
 *   handle       sara-4f2a   public, permanent, what rosters point at
 *   displayName  Sara        public, editable, cosmetic
 *   sign-in key  five words  secret, and the only credential there is
 *
 * The key signs you in on any device and is what your devices share. Only
 * its digest is stored, so it can't be read back — but an admin can issue
 * a replacement against a handle, which is the whole reason identity is
 * kept here rather than derived on the device.
 *
 * Roles are not properties of a person. Admin is a flag; teaching and
 * studying are memberships of a course. The same person can teach one
 * course and study another.
 */

const STORE = "arabic-courses";
const MAX_CLIP_BYTES = 1024 * 1024;
/* An image, as the data URL the editor sends. The editor shrinks a photo
   to a long side of 1024 pixels before it leaves the device, which puts an
   ordinary one at a few hundred kilobytes; this leaves room for a detailed
   one and refuses a camera original sent whole. */
const MAX_IMAGE_BYTES = 1536 * 1024;
/* The only kinds of picture kept: what every browser draws. Checked on the
   data URL's own header, so an image key cannot be used to park anything
   else on the server. */
const IMAGE_DATA = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

const WORDS = [
  "amber", "cedar", "harbour", "lantern", "meadow", "quartz", "raven", "saffron",
  "thistle", "velvet", "willow", "cobalt", "ember", "fjord", "gable", "indigo",
  "juniper", "kestrel", "larch", "mistral", "nimbus", "opal", "pewter", "rowan",
  "sorrel", "tamarind", "umber", "verbena", "yarrow", "zephyr",
];

/** @type {(s: unknown) => string} */
const sha = (s) => createHash("sha256").update(String(s)).digest("hex");

/* Errors that mean the data directory is missing, read-only or full,
   rather than anything about the request: on a host where the volume was
   never mounted, this is what every call fails with. */
const STORAGE_ERRORS = new Set(["EACCES", "EROFS", "ENOSPC", "ENOTDIR", "EPERM", "EDQUOT"]);

/**
 * @param {unknown} body
 * @param {number} [status]
 * @param {Record<string, string>} [headers] laid over the defaults
 */
function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });
}

/* A recording or a picture is addressed by the hash of its own bytes, so
   what one hash answers never changes. Private, because the request is
   signed in with x-key and a shared cache must not keep it (0.580). */
const FOREVER = { "cache-control": "private, max-age=31536000, immutable" };

/**
 * A list a screen asks for again and again (0.580, audit finding 17): the
 * same answer as json(), with an ETag, and a bare 304 when the device
 * already holds exactly this.
 * @param {Request} req
 * @param {unknown} body
 */
function jsonTagged(req, body) {
  const text = JSON.stringify(body);
  const etag = `"${sha(text).slice(0, 32)}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag, "cache-control": "no-store" } });
  }
  return new Response(text, {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store", etag },
  });
}

/* Five words. Roughly 24 bits per word from a 30-word list is thin, so the
   words carry a numeric tail as well. */
function makeKey() {
  const pick = () => WORDS[randomBytes(1)[0] % WORDS.length];
  return `${pick()}-${pick()}-${pick()}-${pick()}-${randomBytes(2).toString("hex")}`;
}

function makeCode() {
  const pick = () => WORDS[randomBytes(1)[0] % WORDS.length];
  return `${pick()}-${pick()}-${randomBytes(2).toString("hex")}`;
}

/* A handle is chosen once from the display name and never changes, because
   rosters and memberships point at it. */
/**
 * @param {string} displayName
 * @param {string[]} taken
 */
function makeHandle(displayName, taken) {
  const base =
    String(displayName || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20) || "user";
  for (let i = 0; i < 40; i++) {
    const handle = `${base}-${randomBytes(2).toString("hex")}`;
    if (!taken.includes(handle)) return handle;
  }
  return `${base}-${randomBytes(4).toString("hex")}`;
}

/*
 * The fields a card carried before 0.138, cleared when one is saved.
 *
 * A card was its own first form: the word, its recordings and its grammar
 * sat on the card, and its other forms in `subs` beside it. One `forms`
 * list replaced both, and a save that spread the stored record under the
 * new fields left the old ones standing — so every card written before
 * that release kept a second, stale copy of its word for ever, sent it to
 * every reader, and offered any of them the wrong half to read.
 *
 * Written out rather than derived, because the list is closed and short:
 * these are the fields that stopped belonging to a card, and a field that
 * stops belonging to one in future belongs here beside them. Every one of
 * them now lives on a form — see the `forms` whitelist in save-card.
 */
/*
 * Every recording a card refers to.
 *
 * Its forms' and its conversation's alike. A line of a scene is drilled in
 * its own right and carries recordings of its own — the whitelist stores
 * them — and the two places that had to know what a card's recordings are
 * walked the forms alone: a backup of a course with a conversation in it
 * came out without a word of the conversation audible, and clearing a card
 * left its lines' recordings on the disk with nothing pointing at them.
 * One answer, read by both.
 */
/** @param {Record<string, any>} card */
const clipsOfOne = (card) => [
  ...formsOf(card).flatMap((/** @type {Record<string, any>} */ f) => [
    ...(f.clips || []),
    ...(f.slowClips || []),
    /* And whatever its accepted answers hold. A recording belongs to the
       answer it is of, and the form's two lists are written from those —
       so in an ordinary card these add nothing. They are read anyway,
       because "what is this card still pointing at" is the question that
       decides whether a blob is deleted, and answering it off a derived
       field means a card written by anything but this app's own packer
       loses its audio. */
    ...(Array.isArray(f.answers) ? f.answers : []).flatMap(
      (/** @type {Record<string, any>} */ a) => [...(a.clips || []), ...(a.slowClips || [])],
    ),
  ]),
  ...(((card && card.lines) || [])).flatMap((/** @type {Record<string, any>} */ ln) => [
    ...(ln.clips || []),
    ...(ln.slowClips || []),
  ]),
];
/* And the ones its unpublished changes hold, which are as much the card's
   as the published version's: a recording made while editing a published
   card is uploaded as it is made, and a backup or a clear that read only
   what students have would lose it, or leave it on the disk. */
/** @param {Record<string, any>} card */
const clipsOfCard = (card) => [
  ...clipsOfOne(card),
  ...(card && card.pending ? clipsOfOne(withVersion(card, card.pending.card)) : []),
];

/*
 * Which of these recordings the server does not hold.
 *
 * A card can name a recording that never reached the server: an upload cut
 * off by a weak connection, cards brought in from a file exported without
 * its recordings, or a recording lost to an older backup being restored.
 * A learner's device could only find that out by failing to download it,
 * and then said "everything was already on this device"; a teacher never
 * found out at all. So the server says, and both sides read the answer.
 *
 * A recording never changes once written, so one found here is remembered
 * for the life of the process and not looked for again; one that is not
 * here is looked for every time, because it may arrive at any moment.
 * Clearing data forgets what it deletes — see admin-clear.
 */
const CLIPS_HERE = new Set();
/* And the same for pictures, which are stored the same way. */
const IMAGES_HERE = new Set();
/**
 * @param {any} store
 * @param {Iterable<string>} hashes
 * @param {"clip" | "image"} [kind]
 * @returns {Promise<string[]>}
 */
async function clipsMissing(store, hashes, kind = "clip") {
  const known = kind === "image" ? IMAGES_HERE : CLIPS_HERE;
  const keyOf = (/** @type {string} */ h) => (kind === "image" ? K.image(h) : K.clip(h));
  const asked = [...new Set(hashes)].filter((h) => typeof h === "string" && /^[a-f0-9]{64}$/.test(h) && !known.has(h));
  const missing = /** @type {string[]} */ ([]);
  for (let i = 0; i < asked.length; i += 50) {
    await Promise.all(asked.slice(i, i + 50).map(async (h) => {
      /* The directory store answers without reading the file; any other
         store is asked for the document itself. */
      const here = typeof store.has === "function" ? await store.has(keyOf(h)) : !!(await store.get(keyOf(h), { type: "text" }));
      if (here) known.add(h);
      else missing.push(h);
    }));
  }
  return missing.sort();
}

/*
 * The recordings named on one form, narrowed to names a recording can have.
 *
 * A clip is stored under the hash of its own bytes and is fetched by that
 * hash — sixty-four hex characters, which `put-clip` and `get-clip` both
 * insist on. What was kept on a card was whatever arrived: any type, any
 * length, twelve per form across sixty-five forms. Nothing could ever be
 * fetched by one of those names, so keeping them bought nothing and cost a
 * card a client could make arbitrarily large, which every student then
 * downloads.
 *
 * Dropped rather than refused, like every other narrowing here: a card
 * with an unfetchable name on it is saved without it, and the answer says
 * what was trimmed.
 */
/** @param {unknown} list */
const clipList = (list) =>
  (Array.isArray(list) ? list : [])
    .filter((/** @type {unknown} */ h) => typeof h === "string" && /^[a-f0-9]{64}$/.test(h))
    .slice(0, 12);

/* The images on one form, narrowed the way its recordings are — names an
   image can have, and a handful of them: a picture is there to say what
   the word means, and four is already a gallery. */
const MAX_IMAGES = 4;
/** @param {unknown} list */
const imageList = (list) => [
  ...new Set(
    (Array.isArray(list) ? list : [])
      .filter((/** @type {unknown} */ h) => typeof h === "string" && /^[a-f0-9]{64}$/.test(h)),
  ),
].slice(0, MAX_IMAGES);

/** Every image a card points at — what backup, restore and clearing read. */
/** @param {Record<string, any>} card */
const imagesOfCard = (card) =>
  [card, ...(card && card.pending ? [withVersion(card, card.pending.card)] : [])].flatMap((one) =>
    formsOf(one).flatMap((/** @type {Record<string, any>} */ f) => (Array.isArray(f.images) ? f.images : [])),
  );

const RETIRED_CARD_FIELDS = Object.fromEntries(
  [
    "ar", "en", "lat", "clips", "slowClips", "answers", "subs", "ask", "lend",
    "row", "col", "of",
    /* Whatever grammatical values the languages declare, which were the
       card's when the card was a form. */
    ...grammarFields(),
  ].map((field) => [field, undefined]),
);

/* ------------------------------------------------------------------
   A card's status, and its two versions

   A card is a Draft, Ready for review, or Published, and only a published
   card reaches a student. A card saved before statuses existed carries
   none and is published, which is what it was.

   Changing a published card does not change what students have. What the
   card screen saves goes into `pending` — the card's unpublished changes,
   with a status of their own (Draft or Ready for review) — and students
   keep the published card until somebody publishes the changes. A card
   that has never been published has no second version: the card is the
   draft.

   What a version holds is what a teacher writes about the word itself:
   its words, forms, tables, blanks, recordings, examples, note and turns.
   What it does not hold is its decks, its ID and its tags, which other
   cards depend on, so they are one answer for both versions and apply at
   once. See DECISIONS.md.
   ------------------------------------------------------------------ */

/** The fields a version holds. Everything else on a card is shared. */
const VERSIONED_KEYS = [
  "name", "category", "person", "enIs", "enAsk", "clue", "examples", "capitals",
  "splitFrom", "together", "note", "sentence", "drill", "forms", "uses",
  "speakers", "you", "sceneKind", "lines",
];
/** The header: shared by both versions, applied at once. Decks are the
    third, and live in the decks rather than on the card. */
const HEADER_KEYS = ["fills", "ref"];
const CARD_STATUSES = ["draft", "review", "published"];

/** Whether students get this card. No status is published: every card
    saved before there were statuses. */
/** @param {Record<string, any> | null | undefined} card */
function isPublished(card) {
  return !!card && (!card.status || card.status === "published");
}

/** A card's version, as a record of exactly the versioned fields, null
    standing for absent so that applying it takes a field away too. */
/** @param {Record<string, any>} card */
function versionOf(card) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const k of VERSIONED_KEYS) out[k] = card[k] === undefined ? null : card[k];
  return out;
}

/** The card with a version laid over it. */
/**
 * @param {Record<string, any>} card
 * @param {Record<string, any>} version
 */
function withVersion(card, version) {
  /** @type {Record<string, any>} */
  const out = { ...card };
  for (const k of VERSIONED_KEYS) {
    if (!(k in version)) continue;
    const v = version[k];
    if (v === null || v === undefined) delete out[k];
    else out[k] = v;
  }
  return out;
}

/**
 * @param {Record<string, any>} a
 * @param {Record<string, any>} b
 */
function sameVersion(a, b) {
  return JSON.stringify(versionOf(a)) === JSON.stringify(versionOf(b));
}

/** The version a teacher works on: the unpublished changes where there
    are any, and otherwise the card. Without `pending`, which is the
    stored shape of what this has already applied. */
/** @param {Record<string, any>} card */
function workingOf(card) {
  const { pending, ...rest } = card;
  return pending ? withVersion(rest, pending.card || {}) : rest;
}

/** A card as a teacher's screens see it: the version they work on, its
    status, and the status of its changes where it has any. */
/** @param {Record<string, any>} card */
function teacherView(card) {
  const { pending } = card;
  return {
    ...workingOf(card),
    status: isPublished(card) ? "published" : card.status,
    ...(pending ? { changes: pending.status || "draft", changed: pending.updated || 0 } : {}),
  };
}

/** A card as it goes to a student: what is published, and nothing about
    what is not. */
/** @param {Record<string, any>} card */
function studentView(card) {
  const { pending: _pending, ...rest } = card;
  return rest;
}

/** What a student's device compares to know whether a card changed. */
/** @param {Record<string, any>} card */
function seenByStudents(card) {
  if (!isPublished(card)) return "";
  return JSON.stringify([versionOf(card), HEADER_KEYS.map((k) => card[k] === undefined ? null : card[k])]);
}

/* Left to infer rather than declared as a record of string-makers: the
   keys here are fixed and known, and saying otherwise made `K.course`
   something that might not exist. */
const K = {
  /** @param {string} h */
  user: (h) => `user:${h}`,
  /** @param {string} h */
  ownCards: (h) => `owncards:${h}`,
  /** @param {string} hash */
  keyOf: (hash) => `key:${hash}`,
  /** @param {string} id */
  course: (id) => `course:${id}`,
  /** @param {string} id */
  deck: (id) => `deck:${id}`,
  /** @param {string} id */
  cards: (id) => `cards:${id}`,          // legacy: cards stored per deck
  /** @param {string} id */
  card: (id) => `card:${id}`,
  /** @param {string} owner */
  myCards: (owner) => `mycards:${owner}`,
  /**
   * How many times this person's values have changed — the cards that fill
   * a variable. They belong to no deck, so nothing else moves when one is
   * written, and a student's device compares deck versions to decide
   * whether to fetch. Without this a name added today would reach nobody
   * until something unrelated changed.
   * @param {string} owner
   */
  fillsRev: (owner) => `fillsrev:${owner}`,
  /**
   * Whether this person's cards have had their subtype-named custom tags
   * folded into their subtype — see liftTags. A stamp, like `seeded` on a
   * person's systems, because the pass reads their whole collection and
   * every student's poll would otherwise ask it again.
   * @param {string} owner
   */
  tagLift: (owner) => `taglift:${owner}`,
  /** @param {string} c */
  code: (c) => `code:${String(c).toLowerCase()}`,
  /**
   * A teacher's numbers, and their clock.
   *
   * One of each per teacher per language, because the words a language
   * builds its numbers out of are a fact about the language and not about
   * one deck — the same reason the Numbers screen stopped living on a
   * deck in 0.153. They belong to no deck at all, like the cards that
   * fill a blank, which is why their revisions have to be folded into the
   * material version by hand: nothing else moves when one is written.
   * @param {string} id
   */
  numSys: (id) => `numsys:${id}`,
  /** @param {string} id */
  timeSys: (id) => `timesys:${id}`,
  /**
   * The version of a number or time system its teacher last signed off,
   * kept whole. It was what students were sent while later edits waited;
   * since a save signs itself, students are sent the saved system and
   * this is only written, for a build that still reads it. See
   * save-system and my-material.
   * @param {string} id
   */
  sysSigned: (id) => `syssigned:${id}`,
  /**
   * Which system is which, for one teacher: kind, then language, then id.
   * A map rather than a list because every lookup here is by the pair.
   * @param {string} owner
   */
  mySystems: (owner) => `mysystems:${owner}`,
  /** @param {string} h */
  clip: (h) => `clip:${h}`,
  /** @param {string} h */
  image: (h) => `image:${h}`,
  /** @param {string} id */
  flag: (id) => `flag:${id}`,
  /** Feedback about the app (0.552), read by the App admin alone. */
  /** @param {string} id */
  feedback: (id) => `feedback:${id}`,
  /** @param {string} what */
  index: (what) => `index:${what}`,
  /** A space (on screen) — an org (in code). See docs/PLAN-spaces.md. */
  /** @param {string} id */
  org: (id) => `org:${id}`,
  /** An address, to the org it belongs to. Kept for ever (8b). */
  /** @param {string} name */
  slug: (name) => `slug:${name}`,
  /** An org's Former members list (0.544). */
  /** @param {string} org */
  former: (org) => `former:${org}`,
  /** A deleted account's name, kept for what it made (0.544). */
  /** @param {string} handle */
  gone: (handle) => `gone:${handle}`,
};

/*
 * Reported problems.
 *
 * A learner who hits a bad question says so from the answer screen, and
 * the report has to reach somebody who can change the card — which the
 * learner's own document never does, since the server cannot read it. So a
 * flag is its own small record here: what was wrong, on which question, by
 * whom, and when.
 *
 * The kinds are the four the app offers — "easy" only arrives when the
 * learner wrote something with it — listed here as well because a
 * kind the app never sends is a kind nothing can read, and an open field
 * would fill the admin screen with whatever anyone posted.
 */
const FLAG_KINDS = ["strict", "data", "easy", "other"];
const FEEDBACK_KINDS = ["broken", "idea"];
const FLAG_NOTE_MAX = 500;

/*
 * How the flagged question had gone for the learner who flagged it.
 *
 * Listed here for the same reason the kinds are: this is read on an admin
 * screen and copied into an export, and a word the app never sends is a
 * word nothing at the other end can act on. Anything else is stored as
 * empty, which reads as "not recorded" — which is also what every report
 * sent before this existed says.
 */
const FLAG_VERDICTS = ["right", "near", "wrong", "shown", "skipped", "unanswered"];

/* Enough to keep every flag a real site accumulates between one look and
   the next, and a ceiling so a stuck client cannot fill the disk. The
   oldest go first, which is also the order they stop being worth reading
   in. */
const MAX_FLAGS = 500;

/* The most fingerprints a card keeps on either list. Past the most any
   frame may be approved at, with room for the ones it has stopped making;
   see review-card. */
const MAX_REVIEWED = 3000;

/*
 * The card a report is about, named the way this server names cards.
 *
 * Course material reaches a device as an item whose id is the card's id
 * with "srv" in front of it, and for one release the app reported that id
 * rather than the card's own. Every report made in that window points at a
 * card that cannot be found — which read on screen as "the learner's own
 * card", about material the learner did not make and cannot change.
 *
 * Taken off here as well as fixed in the app, because the reports already
 * stored are the ones worth reading. Safe to strip unconditionally: a card
 * id made here is "k" and twelve hex digits, so none of them begins with
 * these three letters.
 */
/** @type {(id: unknown) => string} */
const cardIdOf = (id) => String(id || "").replace(/^srv/, "");

/* Strong reads come from the origin, eventual ones from the edge. Anything
   that reads in order to write back must be strong, and so must anything a
   teacher looks at straight after saving. A student's view of course
   material can be a minute behind without anyone noticing, so those paths
   pass EVENTUAL. */
const EVENTUAL = { consistency: "eventual" };

/**
 * Whatever was stored under the key, or null. `any` on purpose: every key
 * holds a different record and each caller below knows which — a union of
 * all of them would be one type nobody could read.
 * @param {Store} store
 * @param {string} key
 * @param {{ consistency?: string }} [opts]
 * @returns {Promise<any>}
 */
async function readJson(store, key, opts = {}) {
  /*
   * A read that failed is not a record that is absent, and this used to
   * answer both with null.
   *
   * Every list on this endpoint filters out the nulls and answers `ok`, so
   * one unreadable course, deck or card came back as a complete answer
   * with that record missing — and on the student's device a course card
   * missing from the answer is a card the teacher withdrew: deleted, and
   * marked deleted so the next sync removes it from their other devices
   * too. A disk hiccup was enough to destroy a learner's progress on a
   * whole deck, everywhere, with nothing reported.
   *
   * So only a record that genuinely is not there reads as null. Anything
   * else throws, and the handler's own catch turns it into a 500 the
   * client already knows how to treat as "try again" rather than as
   * "gone".
   */
  const raw = await store.get(key, { type: "text", consistency: opts.consistency || "strong" });
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw Object.assign(new Error(`unreadable record: ${key}`), { unreadable: true });
  }
}
/** @type {(store: Store, key: string, value: unknown) => Promise<any>} */
const writeJson = (store, key, value) => store.set(key, JSON.stringify(value));

/*
 * A record read, changed, and written back — without another request's
 * change going missing in between.
 *
 * Every list on this endpoint was read, changed in memory and written
 * whole: which cards a deck holds, which cards a teacher owns. Two saves
 * in flight at once — two tabs, two co-teachers, a queued draft draining
 * while somebody is typing — both read the list as it was and the second
 * wrote its copy over the first, so a card was silently dropped from a
 * deck, or from the owner's own list, where nothing afterwards would look
 * for it. The lock inside the store serialises the write and not the read
 * before it, so it cannot see this.
 *
 * So the write says which version it is replacing and is refused if that
 * is no longer the one on disk, and a refusal reads again and redoes the
 * change against what is there now. The change has to be a function of the
 * record for that to be safe, which is what this asks for.
 *
 * `change` returning null means there is nothing to write, and the record
 * is left exactly as it stands.
 */
/**
 * @template T
 * @param {Store} store
 * @param {string} key
 * @param {(current: T | null) => T | null} change
 * @returns {Promise<T | null>}
 */
async function updateJson(store, key, change) {
  /* Enough goes at it to outlast any contention a teaching site sees, and
     few enough that a genuinely stuck key reports rather than spins. Each
     round only one of the writers racing for a key wins, so since the
     indexes came through here (0.580) there are as many rounds as a burst
     of writers needs, with a short random pause so they stop colliding in
     step. */
  for (let i = 0; i < 24; i++) {
    if (i > 1) await new Promise((r) => setTimeout(r, Math.random() * Math.min(50, 2 * i)));
    const held = await store.getWithMetadata(key);
    /* Through the same parse every other read goes through, so a record
       that cannot be read throws here too rather than being quietly
       replaced with whatever this call was about to write. */
    let current = null;
    if (held && held.data) {
      try {
        current = JSON.parse(held.data);
      } catch (e) {
        throw Object.assign(new Error(`unreadable record: ${key}`), { unreadable: true });
      }
    }
    const next = change(current);
    if (next === null) return current;
    const done = await store.set(key, JSON.stringify(next), held ? { onlyIfMatch: held.etag } : { onlyIfNew: true });
    if (done && done.modified) return next;
  }
  throw new Error(`could not update ${key}`);
}

/*
 * The four records, each read by name.
 *
 * readJson returns `any`, because every key holds something different and
 * one union of all of them would be unreadable. These say which is which at
 * the point it is read, which is the only place the answer is known — and
 * they read better than the raw call besides.
 */
/*
 * Spaces, called orgs in code (0.542; docs/PLAN-spaces.md, B1–B3).
 *
 * Every person, course, deck, card and report belongs to one org. A record
 * written before orgs existed has no `org` and is in Main: `orgOf` is the
 * only way anything here reads it, so no migration was ever needed.
 *
 * The org a request acts in is worked out once, after the caller is known,
 * and held for the rest of the request in `orgScope` — per request, not per
 * process, because requests interleave. While it is set, the four readers
 * below answer null for a record from another org, so a course, deck, card
 * or person in another space reads exactly like one that doesn't exist,
 * whichever action asked. Lists read straight off an index are filtered
 * with `inScope` where they are read.
 */
const MAIN = "main";
/** @type {(rec: any) => string} */
const orgOf = (rec) => (rec && rec.org) || MAIN;
/*
 * Memberships (docs/PLAN-memberships.md, B1). An account may be in several
 * spaces: `orgs` lists them, and one written before memberships is in its
 * one space, `org`. `org` is still written, as the first space, so a reader
 * this change missed keeps meaning something. Suspension, and the moments
 * an admin sees, are per space; these are the only readers of them.
 */
/** The spaces an account is in. @type {(u: any) => string[]} */
const memberOf = (u) => (u && Array.isArray(u.orgs) && u.orgs.length ? u.orgs : [orgOf(u)]);
/** A user record, as opposed to a card, deck, course or flag: only users carry `admin`. @type {(rec: any) => boolean} */
const isUserRec = (rec) => !!rec && typeof rec.handle === "string" && typeof rec.admin === "boolean";
/**
 * This account's suspension in one space, or null. Reads the old one-space
 * field too, for an account written before memberships.
 * @type {(u: any, org: string) => any}
 */
const suspensionIn = (u, org) => {
  if (!u) return null;
  if (u.suspendedIn && u.suspendedIn[org]) return u.suspendedIn[org];
  if (u.suspended && !Array.isArray(u.orgs) && orgOf(u) === org) return u.suspended;
  return null;
};
/**
 * When this account last practised in one space: account-wide until a
 * per-space stamp exists. Undefined for never, as the account's own field
 * reads, so a screen says "never" rather than a date in 1970.
 * @type {(u: any, org: string) => number | undefined}
 */
const lastLearnedFor = (u, org) => (u.lastLearnedIn ? u.lastLearnedIn[org] || undefined : u.lastLearned || undefined);
/** @type {(u: any, org: string) => number | undefined} */
const lastTaughtFor = (u, org) => (u.lastTaughtIn ? u.lastTaughtIn[org] || undefined : u.lastTaught || undefined);
/**
 * A user record with its memberships written out: `orgs` always present and
 * an old `suspended` folded into `suspendedIn`. Every write that changes
 * memberships goes through this first, so the old field is never read
 * beside the new one.
 * @param {any} u
 */
function normalisedUser(u) {
  const { suspended, ...rest } = u;
  const orgs = memberOf(u);
  /** @type {Record<string, any>} */
  const suspendedIn = { ...(u.suspendedIn || {}) };
  if (suspended && !Array.isArray(u.orgs)) suspendedIn[orgOf(u)] = suspended;
  return { ...rest, orgs, suspendedIn };
}
/** What the server keeps about memberships, taken off anything sent out. @param {any} u */
const withoutMemberships = (u) => {
  const { keyHash: _k, orgs: _o, suspendedIn: _s, lastLearnedIn: _l, lastTaughtIn: _t, ...safe } = u;
  return safe;
};

/** @type {AsyncLocalStorage<{ org: string | null, self: string, orgs: string[], wide: boolean }>} */
const orgScope = new AsyncLocalStorage();
/**
 * Whether a record is in the org this request acts in (always, outside one).
 * A learner's own reading actions are `wide`: they act in every space the
 * caller is in at once, and nothing beyond them. A person is in scope when
 * one of their spaces is.
 * @type {(rec: any) => boolean}
 */
const inScope = (rec) => {
  const at = orgScope.getStore();
  if (!rec || !at || !at.org) return true;
  /* Someone's My space (0.545): a personal deck or card is its owner's
     alone — not a co-teacher's, a space admin's or an App admin's (48a, 71a). */
  if (rec.personal && at.self && rec.owner !== at.self) return false;
  const orgsHere = at.wide && at.orgs.length ? at.orgs : [at.org];
  if (isUserRec(rec)) return memberOf(rec).some((o) => orgsHere.includes(o));
  return orgsHere.includes(orgOf(rec));
};
/** @type {<T>(rec: T) => T | null} */
const scoped = (rec) => (inScope(rec) ? rec : null);

/** @type {(store: Store, id: string) => Promise<Course | null>} */
const readCourse = async (store, id) => scoped(await readJson(store, K.course(id)));
/** @type {(store: Store, id: string) => Promise<Deck | null>} */
const readDeck = async (store, id) => scoped(await readJson(store, K.deck(id)));
/** @type {(store: Store, id: string) => Promise<Card | null>} */
const readCard = async (store, id) => scoped(await readJson(store, K.card(id)));
/* The caller themselves is always readable: an App admin working in another
   org is still the person they are. */
/** @type {(store: Store, h: string) => Promise<(User & { keyHash?: string }) | null>} */
const readUser = async (store, h) => {
  const u = await readJson(store, K.user(h));
  const at = orgScope.getStore();
  return u && at && at.self === h ? u : scoped(u);
};

/**
 * The ids under an index. Always a list: a missing index reads as empty
 * rather than as null every caller has to think about.
 * @param {Store} store
 * @param {string} what
 * @returns {Promise<string[]>}
 */
async function readIndex(store, what) {
  return (await readJson(store, K.index(what))) || [];
}

/**
 * @param {Store} store
 * @param {string} what
 * @param {string} id
 */
async function indexAdd(store, what, id) {
  /* Conditional, so two adds at once both land (0.580). */
  await updateJson(store, K.index(what), (/** @type {string[] | null} */ cur) =>
    (cur || []).includes(id) ? null : (cur || []).concat([id]));
}

/**
 * @param {Request} req
 * @param {Store} store
 * @returns {Promise<(User & { keyHash?: string }) | null>}
 */
async function currentUser(req, store) {
  const key = req.headers.get("x-key") || "";
  if (!key) return null;
  const handle = await readJson(store, K.keyOf(sha(key)));
  if (!handle) return null;
  return readUser(store, handle);
}

/*
 * When somebody last did a thing.
 *
 * Three moments are kept on the account, and only the moment: lastSeen when
 * the app signs in or checks who they are, lastLearned when the app says a
 * session has been practiced, and lastTaught when a card or a deck is
 * actually made or changed. It is what an administrator needs to tell a
 * quiet course from an empty one, and it is as little as will answer that —
 * no counts, no history, and nothing about what was practiced, which lives
 * in a document on the person's own device that this server cannot read.
 *
 * Practised and changed material are also kept per space (memberships),
 * so a space's admin sees only what happened in their space; the
 * account-wide moment stays for Super admin. A conditional write, because
 * a stamp and a join can land on one account at once and a spread of the
 * account as this request read it would drop the other.
 */
/** @type {(store: Store, user: User, field: string, orgs?: string[]) => Promise<any>} */
const touch = (store, user, field, orgs = []) =>
  updateJson(store, K.user(user.handle), (/** @type {any} */ cur) => {
    if (!cur) return null;
    const now = Date.now();
    const per = `${field}In`;
    const map = { ...(cur[per] || {}) };
    for (const o of orgs) map[o] = now;
    return { ...cur, [field]: now, ...(orgs.length ? { [per]: map } : {}) };
  });

/** @type {(course: Course | null, h: string) => boolean} */
const isTeacher = (course, h) => !!course && (course.teachers || []).includes(h);
/** @type {(course: Course | null, h: string) => boolean} */
const isStudent = (course, h) => !!course && (course.students || []).includes(h);
/** @type {(course: Course | null, h: string) => boolean} */
const inCourse = (course, h) => isTeacher(course, h) || isStudent(course, h);

/*
 * Removing a person: their decks go, their cards go, and they come out of
 * every course. Nothing of theirs is left pointing at nothing.
 */
/* Blob reads are network calls, so reading a list one record at a time turns
   a screen into a waterfall of round trips. Reads are safe to run together;
   writes are not, because course and deck records are read-modify-write, so
   the destructive loops below stay deliberately sequential. */
/*
 * Which courses a deck is in — read off the courses, never off the deck.
 *
 * The link is written in two places: the course lists the deck, and the
 * deck lists the course with the day it was added. The two came apart. A
 * course could go on handing a deck to its students while the deck no
 * longer said it was in that course, so the teacher's course screen showed
 * one deck and the student's showed seven, and Manage decks could not take
 * out what it could not see. Whichever request wrote last won; see
 * updateJson for why that is no longer how they are written.
 *
 * The course's list is the one a student's device is sent, so it is the one
 * that answers. The deck's own list is kept for the date and for nothing
 * else: every screen that says which courses hold a deck is given links
 * worked out here, so it says what the students actually have.
 */
/**
 * @param {Deck} deck
 * @param {Course[]} courses  Every course on the site, or at least every one that may list it.
 * @returns {import("../../src/types.ts").DeckLink[]}
 */
function linksOf(deck, courses) {
  const added = new Map((deck.courses || []).map((l) => [l.courseId, l.addedAt]));
  return courses
    .filter((c) => c && (c.decks || []).includes(deck.id))
    .map((c) => {
      const at = added.get(c.id);
      return at ? { courseId: c.id, addedAt: at } : { courseId: c.id };
    });
}

/**
 * Every course on the site, read once for a caller that needs to know which
 * of them list a deck.
 * @param {Store} store
 * @returns {Promise<Course[]>}
 */
async function everyCourse(store) {
  const ids = await readIndex(store, "courses");
  return (await readManyJson(store, ids.map((id) => K.course(id)))).filter((c) => c && inScope(c));
}

/**
 * Decks as a screen is given them: with the courses that hold them, read
 * off those courses — see linksOf.
 * @template {Deck} D
 * @param {Store} store
 * @param {D[]} decks
 * @param {Course[]} [courses]  Already read, where the caller has them.
 * @returns {Promise<D[]>}
 */
async function withLinks(store, decks, courses) {
  if (!decks.length) return decks;
  const all = courses || (await everyCourse(store));
  return decks.map((d) => ({ ...d, courses: linksOf(d, all) }));
}

/**
 * A deck that is going, taken out of every course that lists it.
 *
 * Every course, not the ones the deck names: a course the deck had
 * forgotten it was in would otherwise keep a deck that no longer exists.
 * @param {Store} store
 * @param {string} deckId
 */
async function dropFromCourses(store, deckId) {
  for (const c of await everyCourse(store)) {
    if (!(c.decks || []).includes(deckId) && !onPath(c, deckId)) continue;
    await updateJson(store, K.course(c.id), (/** @type {Course | null} */ fresh) =>
      fresh && ((fresh.decks || []).includes(deckId) || onPath(fresh, deckId))
        ? offPath({ ...fresh, decks: (fresh.decks || []).filter((x) => x !== deckId) }, deckId)
        : null
    );
  }
}

/**
 * Whether a course has a deck anywhere on its path: in its order, among
 * what is published there, or among what is opened early (0.613).
 * @param {Course} course
 * @param {string} deckId
 */
function onPath(course, deckId) {
  return (course.path || []).includes(deckId) || isLiveIn(course, deckId) || (course.opened || []).includes(deckId);
}

/**
 * The course with a unit taken off its path: out of its order, its
 * publication there and its opening early, and nothing else. Fields left
 * empty are dropped, so a course with no units stores what it always did.
 * @param {Course} course
 * @param {string} deckId
 * @returns {Course}
 */
function offPath(course, deckId) {
  const { path, pathLive, opened, ...rest } = course;
  const nextPath = (path || []).filter((x) => x !== deckId);
  const nextLive = Object.fromEntries(Object.entries(pathLive || {}).filter(([k]) => k !== deckId));
  const nextOpened = (opened || []).filter((x) => x !== deckId);
  return {
    ...rest,
    ...(nextPath.length ? { path: nextPath } : {}),
    ...(Object.keys(nextLive).length ? { pathLive: nextLive } : {}),
    ...(nextOpened.length ? { opened: nextOpened } : {}),
  };
}

/* Who may change a deck.
 *
 * Its owner, an administrator, or any teacher of a course the deck is in.
 * A course is shared work: a teacher brought in to help cannot be expected
 * to ask the original author before fixing a card. Merely studying a course
 * grants nothing. "In" is the course's say, as everywhere — the same rule
 * my-decks lists a co-teacher's decks by, so a deck a teacher is shown is
 * one they may work on. */
/**
 * @param {Store} store
 * @param {Deck | null} deck
 * @param {string} handle
 * @param {boolean} isAdmin
 */
async function canEditDeck(store, deck, handle, isAdmin) {
  if (!deck || !inScope(deck)) return false;
  if (isAdmin || deck.owner === handle) return true;
  return (await everyCourse(store)).some((c) => (c.decks || []).includes(deck.id) && isTeacher(c, handle));
}

/**
 * @param {Store} store
 * @param {string[]} keys
 * @param {{ consistency?: string }} [opts]
 * @returns {Promise<any[]>}
 */
async function readManyJson(store, keys, opts) {
  return Promise.all(keys.map((k) => readJson(store, k, opts)));
}

/* A fingerprint of what a student would receive, cheap enough to compute
   from courses and decks alone. Deck versions move whenever a deck's cards
   change (membership or content), so the cards need not be read to know
   whether anything did. */
/**
 * @param {Course[]} courses
 * @param {Deck[]} decks
 */
/**
 * @param {any[]} courses
 * @param {any[]} decks
 * @param {[string, number][]} fills  Each teacher's value revision — see K.fillsRev.
 * @param {[string, number][]} systems  Each number or time system's revision — see K.numSys.
 */
function materialVersion(courses, decks, fills = [], systems = []) {
  const summary = {
    /* With its path, where it has one (0.613): an order changed, a unit
       published or opened early moves nothing else a device compares.
       Added only when there is something on it, so the version of a
       course with no units is what it always was. */
    courses: courses.map((c) => {
      const row = [c.id, c.title, c.language || "", (c.decks || []).length];
      const live = Object.keys(c.pathLive || {}).sort();
      const path = c.path || [];
      const opened = c.opened || [];
      const withPath = path.length || live.length || opened.length ? row.concat([path.join(","), live.join(","), opened.join(",")]) : row;
      /* And its switches, where it has any (0.627): a teacher changing what
         is asked moves nothing else a device compares. */
      return c.practice ? withPath.concat([JSON.stringify(c.practice)]) : withPath;
    }),
    /* With the parts of the numbers it holds, which are not cards and so
       move neither its version nor its count — see set-deck-parts. And
       whether it is a path unit, only where it is one. */
    decks: decks.map((d) => {
      const row = [d.id, d.version || 1, d.title, (d.cardIds || []).length, (d.parts || []).join(",")];
      return d.unit ? row.concat(["unit"]) : row;
    }),
    /* The values a teacher has written are material too, and the only
       material that moves without a deck moving: a card that fills a
       variable is in no deck. Sorted, so two reads of the same site agree
       whatever order the teachers came back in. */
    fills: [...fills].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    /* And the systems, for exactly the reason the line above exists: a
       number system is in no deck, so a teacher correcting a word in one
       moves nothing else a device compares against. Left out of here it
       would reach nobody until something unrelated changed. */
    systems: [...systems].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  };
  return sha(JSON.stringify(summary)).slice(0, 24);
}

/**
 * Every key one person's systems live under.
 *
 * Read off their own index rather than guessed at, and written out here
 * once because three places delete a person's work — leaving an account,
 * an administrator removing one, and clearing the site — and a system
 * left behind by one of them is a lexicon nobody can reach and nothing
 * will ever tidy.
 * @param {Store} store
 * @param {string} handle
 */
async function systemKeysOf(store, handle) {
  const held = (await readJson(store, K.mySystems(handle)).catch(() => null)) || {};
  const numbers = held.numbers && typeof held.numbers === "object" ? held.numbers : {};
  const times = held.times && typeof held.times === "object" ? held.times : {};
  return [
    ...Object.values(numbers).map((id) => K.numSys(String(id))),
    ...Object.values(times).map((id) => K.timeSys(String(id))),
  ];
}

/**
 * Takes a person off every course they teach or study. Says whether they
 * were on any.
 * @param {Store} store
 * @param {string} handle
 */
async function dropFromRosters(store, handle) {
  let found = false;
  for (const id of await readIndex(store, "courses")) {
    await updateJson(store, K.course(id), (/** @type {Course | null} */ c) => {
      if (!c || !inScope(c) || !(c.teachers.includes(handle) || c.students.includes(handle))) return null;
      found = true;
      return {
        ...c,
        teachers: c.teachers.filter((x) => x !== handle),
        students: c.students.filter((x) => x !== handle),
      };
    });
  }
  return found;
}

/**
 * The course a join code opens. The code's own record is the quick way,
 * but a course restored from a backup came back without one (a backup
 * holds courses, not their codes), so a miss looks through the courses
 * and writes the record it should have found.
 * @param {Store} store
 * @param {string} given
 */
async function courseForCode(store, given) {
  if (!given) return null;
  const id = await readJson(store, K.code(given));
  if (id) return id;
  const ids = await readIndex(store, "courses");
  for (const c of await readManyJson(store, ids.map((x) => K.course(x)))) {
    if (c && (c.code === given || c.teacherCode === given)) {
      await writeJson(store, K.code(given), c.id);
      return c.id;
    }
  }
  return null;
}

/**
 * Former members (0.544; docs/PLAN-spaces.md, B2): one list per org of the
 * people who left, were removed or were deleted, newest last. A record is
 * replaced, not doubled, when the same person's story moves on (suspended,
 * then deleted).
 * @param {Store} store
 * @param {string} org
 * @param {Record<string, any>} rec
 */
async function noteFormer(store, org, rec) {
  await updateJson(store, K.former(org), (/** @type {any} */ cur) =>
    (cur || []).filter((/** @type {any} */ r) => r.handle !== rec.handle).concat([rec])
  );
}

/**
 * The courses someone is on, with their roles and titles — what a record
 * keeps and what reactivating puts back. This org's courses only.
 * @param {Store} store
 * @param {string} handle
 */
async function coursesOf(store, handle) {
  return (await everyCourse(store))
    .filter((c) => isTeacher(c, handle) || isStudent(c, handle))
    .map((c) => ({
      id: c.id,
      title: c.title,
      roles: /** @type {string[]} */ ([]).concat(isTeacher(c, handle) ? ["teacher"] : [], isStudent(c, handle) ? ["student"] : []),
    }));
}

/**
 * Deleting an account (0.544; 85a, 86a, 83a, 84a).
 *
 * What the person made for their space stays, under their name — decks,
 * cards, numbers and clock — so courses keep working and a space admin can
 * hand it on. Their own private material (My space: personal decks and
 * cards) goes, and so does their practice history. Their place on every
 * roster goes, and a Former members record says who they were.
 *
 * Every list here is changed by taking out what is named, never rewritten
 * from what this request can see: since 0.542 a request sees one org, and
 * a list rewritten from that would lose every other org's entries.
 * @param {Store} store
 * @param {string} handle
 * @param {{ why?: string, by?: string }} [how]
 */
async function wipeAccount(store, handle, how = {}) {
  const user = await readUser(store, handle);
  /* A course restored from a backup brings its roster back as it was, and
     that can name somebody whose account has since gone. There is nothing
     of theirs left to remove but their place on the rosters. */
  if (!user) return dropFromRosters(store, handle);
  const org = orgOf(user);
  const orgs = memberOf(user);
  const who = how.by || handle;

  /* Off every space they are in (memberships): each one's rosters and
     admins, and a Former members record in each. The request's scope is
     moved to each space in turn, and put back after. */
  const scopeNow = orgScope.getStore();
  const kept = scopeNow ? { org: scopeNow.org, wide: scopeNow.wide } : null;
  for (const o of orgs) {
    if (scopeNow) {
      scopeNow.org = o;
      scopeNow.wide = false;
    }
    const was = suspensionIn(user, o);
    const courses = was && Array.isArray(was.courses) && was.courses.length ? was.courses : await coursesOf(store, handle);
    await dropFromRosters(store, handle);
    await updateJson(store, K.org(o), (/** @type {any} */ doc) =>
      doc && (doc.admins || []).includes(handle) ? { ...doc, admins: doc.admins.filter((/** @type {string} */ x) => x !== handle) } : null
    );
    await noteFormer(store, o, {
      handle,
      displayName: user.displayName,
      joined: user.created || 0,
      left: Date.now(),
      courses,
      why: who === handle ? "deleted-self" : "deleted-by-admin",
      by: who,
    });
  }
  if (scopeNow && kept) {
    scopeNow.org = kept.org;
    scopeNow.wide = kept.wide;
  }

  /* Their personal cards and decks, in every space. */
  await clearPersonal(store, handle, "");

  if (user.keyHash) await store.delete(K.keyOf(user.keyHash)).catch(() => {});
  /* And the practice history, which the key's digest finds (86a). */
  if (user.keyHash) await forgetSyncDoc(user.keyHash).catch(() => {});
  await store.delete(K.user(handle)).catch(() => {});
  await updateJson(store, K.index("users"), (/** @type {any} */ cur) =>
    (cur || []).filter((/** @type {string} */ x) => x !== handle)
  );

  /* Their name, kept for the material that stays, and so the handle is
     never given to somebody else. */
  await writeJson(store, K.gone(handle), { displayName: user.displayName, org, orgs, at: Date.now() });
  await updateJson(store, K.index("gone"), (/** @type {any} */ cur) =>
    (cur || []).includes(handle) ? null : (cur || []).concat([handle])
  );
  return true;
}

/**
 * A person's My space material — personal cards, taken out of whatever
 * decks hold them, then personal decks — in one space, or in every space
 * when `org` is "". Shared by closing an account and by taking one space
 * away from it (0.580).
 * @param {Store} store
 * @param {string} handle
 * @param {string} org
 */
async function clearPersonal(store, handle, org) {
  const here = (/** @type {any} */ rec) => !org || orgOf(rec) === org;
  const listed = (await readJson(store, K.myCards(handle))) || [];
  const cards = (await readManyJson(store, listed.map((/** @type {string} */ id) => K.card(id)))).filter(
    (c) => c && c.personal && here(c)
  );
  for (const c of cards) {
    for (const did of c.inDecks || []) {
      await updateJson(store, K.deck(did), (/** @type {any} */ fresh) => {
        if (!fresh || !(fresh.cardIds || []).includes(c.id)) return null;
        const next = fresh.cardIds.filter((/** @type {string} */ x) => x !== c.id);
        return { ...fresh, cardIds: next, cardCount: next.length, version: (fresh.version || 1) + 1, updated: Date.now() };
      });
    }
    await store.delete(K.card(c.id)).catch(() => {});
  }
  if (cards.length) {
    const gone = new Set(cards.map((c) => c.id));
    await updateJson(store, K.myCards(handle), (/** @type {any} */ cur) =>
      (cur || []).filter((/** @type {string} */ x) => !gone.has(x))
    );
  }
  /* A deck borrowing course cards (66b) goes alone: those cards are the
     space's. */
  const deckIds = await readIndex(store, "decks");
  const decks = (await readManyJson(store, deckIds.map((id) => K.deck(id)))).filter(
    (d) => d && d.owner === handle && d.personal && here(d)
  );
  for (const d of decks) await store.delete(K.deck(d.id)).catch(() => {});
  if (decks.length) {
    const goneDecks = new Set(decks.map((d) => d.id));
    await updateJson(store, K.index("decks"), (/** @type {any} */ cur) =>
      (cur || []).filter((/** @type {string} */ x) => !goneDecks.has(x))
    );
  }
}

/**
 * Taking one space away from an account that has others (memberships):
 * off that space's rosters and admins, its My space material there
 * deleted, the membership and its stamps gone, and a Former members record
 * unless the space itself is being deleted. Nothing about the person's
 * other spaces is touched.
 * @param {Store} store
 * @param {string} handle
 * @param {string} org
 * @param {{ why?: string, by?: string, former?: boolean }} [how]
 */
async function removeMembership(store, handle, org, how = {}) {
  const user = await readJson(store, K.user(handle));
  if (!user) return false;
  const scopeNow = orgScope.getStore();
  const kept = scopeNow ? { org: scopeNow.org, wide: scopeNow.wide } : null;
  if (scopeNow) {
    scopeNow.org = org;
    scopeNow.wide = false;
  }
  try {
    const was = suspensionIn(user, org);
    const courses = was && Array.isArray(was.courses) && was.courses.length ? was.courses : await coursesOf(store, handle);
    await dropFromRosters(store, handle);
    await updateJson(store, K.org(org), (/** @type {any} */ o) =>
      o && (o.admins || []).includes(handle) ? { ...o, admins: o.admins.filter((/** @type {string} */ x) => x !== handle) } : null
    );

    /* Their My space in this space: personal cards, then personal decks. */
    await clearPersonal(store, handle, org);

    await updateJson(store, K.user(handle), (/** @type {any} */ cur) => {
      if (!cur) return null;
      const u = normalisedUser(cur);
      const drop = (/** @type {any} */ m) => {
        const { [org]: _x, ...rest } = m || {};
        return rest;
      };
      return {
        ...u,
        orgs: u.orgs.filter((/** @type {string} */ x) => x !== org),
        suspendedIn: drop(u.suspendedIn),
        lastLearnedIn: drop(u.lastLearnedIn),
        lastTaughtIn: drop(u.lastTaughtIn),
      };
    });
    if (how.former !== false) {
      await noteFormer(store, org, {
        handle,
        displayName: user.displayName,
        joined: user.created || 0,
        left: Date.now(),
        courses,
        why: how.why || "removed",
        by: how.by || handle,
      });
    }
    return true;
  } finally {
    if (scopeNow && kept) {
      scopeNow.org = kept.org;
      scopeNow.wide = kept.wide;
    }
  }
}

/**
 * Putting an account into a space it is not in, or back into one it left
 * (memberships): the membership written once, and a rejoin treated as a
 * reactivation (0.544) — back on the courses the suspension kept, off
 * Former members. The fresh user record, or null when the account is gone.
 *
 * The caller has already checked the space exists and is open, and decided
 * whether someone *removed* from it may come back: a code may not, the App
 * admin may.
 * @param {Store} store
 * @param {string} handle
 * @param {string} orgId
 */
async function addMembership(store, handle, orgId) {
  const before = await readJson(store, K.user(handle));
  if (!before) return null;
  const was = suspensionIn(before, orgId);
  const fresh = await updateJson(store, K.user(handle), (/** @type {any} */ cur) => {
    if (!cur) return null;
    const u = normalisedUser(cur);
    const orgs = u.orgs.includes(orgId) ? u.orgs : u.orgs.concat([orgId]);
    if (orgs === u.orgs && !u.suspendedIn[orgId] && Array.isArray(cur.orgs) && !cur.suspended) return null;
    const { [orgId]: _gone, ...suspendedIn } = u.suspendedIn;
    return { ...u, orgs, suspendedIn };
  });
  const now = fresh || (await readJson(store, K.user(handle)));
  if (!now) return null;
  if (was) {
    const scopeNow = orgScope.getStore();
    const kept = scopeNow ? { org: scopeNow.org, wide: scopeNow.wide } : null;
    if (scopeNow) {
      scopeNow.org = orgId;
      scopeNow.wide = false;
    }
    try {
      /* Back on the courses they were on, the way admin-reactivate-user does it. */
      for (const c of was.courses || []) {
        await updateJson(store, K.course(c.id), (/** @type {Course | null} */ course) => {
          if (!course || !inScope(course)) return null;
          const next = { ...course, teachers: course.teachers.slice(), students: course.students.slice() };
          if ((c.roles || []).includes("teacher") && !next.teachers.includes(handle)) next.teachers.push(handle);
          if ((c.roles || []).includes("student") && !next.students.includes(handle)) next.students.push(handle);
          return next;
        });
      }
      await updateJson(store, K.former(orgId), (/** @type {any} */ cur) =>
        (cur || []).some((/** @type {any} */ r) => r.handle === handle) ? cur.filter((/** @type {any} */ r) => r.handle !== handle) : null
      );
    } finally {
      if (scopeNow && kept) {
        scopeNow.org = kept.org;
        scopeNow.wide = kept.wide;
      }
    }
  }
  return now;
}

/**
 * The spaces an account may use right now: each it is in, not suspended
 * there, and not closed. With the space documents, read once.
 * @param {Store} store
 * @param {any} me
 */
async function standingOf(store, me) {
  /** @type {Map<string, any>} */
  const orgDocs = new Map();
  for (const id of memberOf(me)) orgDocs.set(id, await readJson(store, K.org(id)));
  const active = memberOf(me).filter((id) => {
    const o = orgDocs.get(id);
    return !!o && !o.archived && !suspensionIn(me, id);
  });
  return { orgDocs, active };
}

/*
 * Actions that read across every space the caller is in (memberships):
 * what a learner holds is the union of their spaces. Everything else acts
 * in one. And the actions a key may use with no space to act in, because
 * the code it brings decides one.
 */
/* Not my-courses: that is Teaching's list, which is of one space. */
const WIDE = new Set(["my-material", "report-flag", "practiced"]);
const JOINS = new Set(["join-course", "join-space"]);
/* What someone with no space they may use can still do (0.578): their own
   name, their key's reminder, and closing their account. */
const STRANDED_MAY = new Set(["rename", "key-saved", "delete-account"]);

/**
 * Joining by a code (memberships, A2): a space's invitation adds the space;
 * a course code adds the space and the course. Someone who left a space
 * rejoins it this way; someone removed from it is refused — its admin
 * reactivates them. The answer to send, with its status.
 * @param {Store} store
 * @param {any} me
 * @param {string} given
 * @returns {Promise<{ ok: boolean, status: number, body: Record<string, any> }>}
 */
async function joinByCode(store, me, given) {
  const no = (/** @type {number} */ status, /** @type {Record<string, any>} */ body) => ({ ok: false, status, body });
  const target = await codeTarget(store, given);
  if (!target) return no(404, { error: "bad-code" });
  const orgId = target.kind === "org" ? target.org.id : orgOf(target.course);
  const org = await readJson(store, K.org(orgId));
  if (!org) return no(404, { error: "no-space" });
  if (org.archived) return no(403, { error: "space-closed" });
  const was = suspensionIn(me, orgId);
  /* Suspended by the space (0.578) is the admin's to lift; someone who
     left or was removed may come back with an invitation or a code. */
  if (was && was.why === "suspended") return no(403, { error: "suspended-here", space: orgCard(org) });
  /* The App admin acts in any space without being in it (35a). */
  if (!me.admin && !(await addMembership(store, me.handle, orgId))) return no(401, { error: "bad-key" });
  if (target.kind === "course") {
    const as = target.asTeacher ? "teachers" : "students";
    const joined = await updateJson(store, K.course(target.course.id), (/** @type {Course | null} */ c) =>
      c && !c[as].includes(me.handle) ? { ...c, [as]: c[as].concat([me.handle]) } : null
    );
    const { code: _c, teacherCode: _t, ...safe } = joined || (await readJson(store, K.course(target.course.id))) || target.course;
    return { ok: true, status: 200, body: { ok: true, space: orgCard(org), course: safe, role: target.asTeacher ? "teacher" : "student" } };
  }
  return { ok: true, status: 200, body: { ok: true, space: orgCard(org) } };
}

/**
 * What a code opens (0.543): a space's invite (recorded as `org:<id>`) or a
 * course, as student or teacher. Course codes go through courseForCode,
 * which also finds the codes of a course restored from a backup.
 * @param {Store} store
 * @param {string} given
 * @returns {Promise<{ kind: "org", org: any } | { kind: "course", course: Course, asTeacher: boolean } | null>}
 */
async function codeTarget(store, given) {
  if (!given) return null;
  const at = await readJson(store, K.code(given));
  if (typeof at === "string" && at.startsWith("org:")) {
    const org = await readJson(store, K.org(at.slice(4)));
    return org && org.inviteCode === given ? { kind: "org", org } : null;
  }
  const id = await courseForCode(store, given);
  const course = id ? await readJson(store, K.course(id)) : null;
  if (!course) return null;
  if (course.teacherCode && given === course.teacherCode) return { kind: "course", course, asTeacher: true };
  if (given === course.code) return { kind: "course", course, asTeacher: false };
  return null;
}

/** A space as anyone may be told of it. @param {any} org */
const orgCard = (org) => ({
  id: org.id, slug: org.slug, name: org.name, logo: org.logo || "", colour: org.colour || "",
});

/*
 * Making sure Main exists (0.542). Everything written before orgs is in it
 * already, by `orgOf`; this is only its document, address and invite code,
 * created once and never twice — updateJson creates only when the key is
 * missing. Checked once per process, and again after a clear.
 */
/** @type {Promise<void> | null} */
let mainReady = null;
/** @param {Store} store */
function ensureMain(store) {
  if (!mainReady) {
    mainReady = (async () => {
      const code = makeCode();
      const made = await updateJson(store, K.org(MAIN), (/** @type {any} */ cur) =>
        cur ? null : {
          id: MAIN, slug: MAIN, formerSlugs: [], name: "Main", logo: "", colour: "",
          admins: [], inviteCode: code, created: Date.now(),
        }
      );
      await updateJson(store, K.slug(MAIN), (/** @type {any} */ cur) => (cur ? null : MAIN));
      if (made && made.inviteCode === code) {
        await updateJson(store, K.code(code), (/** @type {any} */ cur) => (cur ? null : `org:${MAIN}`));
      }
      await updateJson(store, K.index("orgs"), (/** @type {any} */ cur) =>
        (cur || []).includes(MAIN) ? null : (cur || []).concat([MAIN])
      );
    })().catch((e) => {
      mainReady = null;
      throw e;
    });
  }
  return mainReady;
}

/*
 * A space's address (B2). Lower-case letters, digits and single dashes,
 * starting with a letter; never a name the app itself answers to.
 */
const RESERVED_SLUGS = new Set([
  "api", "assets", "main", "admin", "new", "join", "www", "app", "static", "index",
  "favicon", "logo", "apple-touch-icon", "icon-192", "icon-512", "icon-512-maskable",
  "manifest", "manifest.webmanifest", "sw", "registersw", "workbox",
]);
/** @param {string} slug */
export function slugProblem(slug) {
  if (!/^[a-z][a-z0-9-]{2,39}$/.test(slug) || slug.includes("--") || slug.endsWith("-")) return "slug-invalid";
  if (RESERVED_SLUGS.has(slug)) return "slug-invalid";
  return "";
}
/** A hex colour or nothing. @param {unknown} c */
const colourOf = (c) => (/^#[0-9a-f]{6}$/i.test(String(c || "")) ? String(c).toLowerCase() : "");

/*
 * Students' My space, removed once (0.550, 7a). Since 0.550 only teachers
 * and those who run a space have a My space; what students made in it under
 * 0.545–0.549 is deleted the first time this release runs, and never again
 * (the stamp is written first, so two processes can't both do it). A
 * teacher's My space is kept even when they later stop teaching (9a).
 */
/** @type {Promise<void> | null} */
let sweptStudents = null;
/** @param {Store} store */
function sweepStudentMySpace(store) {
  if (!sweptStudents) {
    sweptStudents = (async () => {
      const at = Date.now();
      const stamp = await updateJson(store, "stamp:student-myspace-0550", (/** @type {any} */ cur) => (cur ? null : { at }));
      if (!stamp || stamp.at !== at) return;
      const courses = (await readManyJson(store, (await readIndex(store, "courses")).map((id) => K.course(id)))).filter(Boolean);
      const orgs = (await readManyJson(store, (await readIndex(store, "orgs")).map((id) => K.org(id)))).filter(Boolean);
      const runs = new Set(orgs.flatMap((o) => o.admins || []));
      const teaches = new Set(courses.flatMap((c) => c.teachers || []));
      const deckIds = await readIndex(store, "decks");
      const decks = (await readManyJson(store, deckIds.map((id) => K.deck(id)))).filter(Boolean);
      const students = new Set();
      for (const d of decks.filter((x) => x.personal)) {
        const owner = await readJson(store, K.user(d.owner));
        if (owner && (owner.admin || runs.has(d.owner) || teaches.has(d.owner))) continue;
        students.add(d.owner);
        await store.delete(K.deck(d.id)).catch(() => {});
      }
      const goneDecks = new Set(decks.filter((x) => x.personal && students.has(x.owner)).map((x) => x.id));
      if (goneDecks.size) {
        await updateJson(store, K.index("decks"), (/** @type {any} */ cur) => (cur || []).filter((/** @type {string} */ x) => !goneDecks.has(x)));
      }
      for (const h of (await readIndex(store, "users"))) {
        const u = await readJson(store, K.user(h));
        if (!u || u.admin || runs.has(h) || teaches.has(h)) continue;
        const ids = (await readJson(store, K.myCards(h))) || [];
        const cards = (await readManyJson(store, ids.map((/** @type {string} */ id) => K.card(id)))).filter((c) => c && c.personal);
        if (!cards.length) continue;
        for (const c of cards) await store.delete(K.card(c.id)).catch(() => {});
        const gone = new Set(cards.map((c) => c.id));
        await updateJson(store, K.myCards(h), (/** @type {any} */ cur) => (cur || []).filter((/** @type {string} */ x) => !gone.has(x)));
      }
    })().catch(() => {
      sweptStudents = null;
    });
  }
  return sweptStudents;
}

/* ================= restoring (0.583) =================

   docs/PLAN-space-backup.md, Part B4–B6. One engine for a whole-site file
   and for one space's, deciding each record from the site as it stands at
   the moment it is written. The rule above every other: a restore adds what
   the file holds and the site lacks, and changes nothing already here —
   except the deletion record of an account the owner ticked to bring back,
   and a space's name, logo, colour and admins when the owner asked for the
   file's. Every record not written is reported, with why. */

/**
 * @typedef {{ handle: string, created?: number, keyHash?: string, orgs?: string[], org?: string, displayName?: string }} FileUser
 * @typedef {{ kind: "site" } | { kind: "space", space: string }} RestoreScope
 * @typedef {{ scope: RestoreScope, bringBack: string[], fileOrgs: string[], keepSpaceCard: boolean,
 *   newSlugs: Record<string, string>, created: Record<string, number> }} RestoreOptions
 * @typedef {{ kind: "other-person" } | { kind: "kept" } | { kind: "not-member" }
 *   | { kind: "deleted", at: number } | { kind: "recreate", orgs: string[] }} Verdict
 * @typedef {{ outcome: "written" | "merged" | "skipped", why?: string, also?: { key: string, why: string }[] }} Outcome
 */

/**
 * The owner's choices, as a request carries them, made safe to read. Only
 * choices and facts about the file: never a verdict, which the server
 * always works out for itself.
 * @param {any} o
 * @returns {RestoreOptions}
 */
function restoreOptions(o) {
  const raw = o && typeof o === "object" ? o : {};
  const s = raw.scope && typeof raw.scope === "object" ? raw.scope : {};
  /** @type {RestoreScope} */
  const scope = s.kind === "space" && typeof s.space === "string" && s.space ? { kind: "space", space: s.space } : { kind: "site" };
  const strings = (/** @type {any} */ v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x) : []);
  /** @type {Record<string, string>} */
  const newSlugs = {};
  if (raw.newSlugs && typeof raw.newSlugs === "object") {
    for (const [id, slug] of Object.entries(raw.newSlugs)) if (typeof slug === "string" && slug) newSlugs[id] = slug.trim().toLowerCase();
  }
  if (typeof raw.newSlug === "string" && raw.newSlug.trim() && scope.kind === "space") newSlugs[scope.space] = raw.newSlug.trim().toLowerCase();
  /** @type {Record<string, number>} */
  const created = {};
  if (raw.created && typeof raw.created === "object") {
    for (const [h, at] of Object.entries(raw.created)) if (typeof at === "number" && at) created[h] = at;
  }
  return {
    scope,
    bringBack: strings(raw.bringBack),
    fileOrgs: strings(raw.fileOrgs),
    keepSpaceCard: raw.keepSpaceCard !== false,
    newSlugs,
    created,
  };
}

/**
 * What a restore will do about each person in the file (B4). Read from the
 * site once per handle; the preview and the restore both ask this, with
 * the same options, so the one cannot promise what the other does not do.
 *
 * `created` is what tells two people apart: set once when an account is
 * made and carried unchanged into every backup and every re-creation. Not
 * the key's hash, which changes with every new key.
 * @param {Store} store
 * @param {FileUser[]} fileUsers
 * @param {RestoreOptions} options
 * @returns {Promise<Map<string, Verdict>>}
 */
async function restoreVerdicts(store, fileUsers, options) {
  const bringBack = new Set(options.bringBack);
  /** @type {Map<string, Verdict>} */
  const verdicts = new Map();
  /** @type {Map<string, boolean>} */
  const orgHere = new Map();
  const exists = async (/** @type {string} */ id) => {
    if (!orgHere.has(id)) orgHere.set(id, !!(await readJson(store, K.org(id))));
    return orgHere.get(id);
  };
  for (const fu of fileUsers) {
    const h = String((fu && fu.handle) || "");
    if (!h || verdicts.has(h)) continue;
    const site = await readJson(store, K.user(h));
    if (site) {
      if (site.created && fu.created && site.created !== fu.created) verdicts.set(h, { kind: "other-person" });
      else if (options.scope.kind === "space" && !memberHere(site, options.scope.space)) verdicts.set(h, { kind: "not-member" });
      else verdicts.set(h, { kind: "kept" });
      continue;
    }
    const gone = await readJson(store, K.gone(h));
    if (gone && !bringBack.has(h)) {
      verdicts.set(h, { kind: "deleted", at: Number(gone.at) || 0 });
      continue;
    }
    /** @type {string[]} */
    let orgs;
    if (options.scope.kind === "space") {
      orgs = [options.scope.space];
    } else {
      orgs = [];
      for (const o of memberOf(fu)) if (options.fileOrgs.includes(o) || (await exists(o))) orgs.push(o);
      /* An account in no space can sign in nowhere. */
      if (!orgs.length && options.fileOrgs.length) orgs = [options.fileOrgs[0]];
      if (!orgs.length) orgs = [MAIN];
    }
    verdicts.set(h, { kind: "recreate", orgs });
  }
  return verdicts;
}

/**
 * Whether an account counts as in a space for a restore: a member, and not
 * removed from it (a removal keeps the membership, marked; 0.578). Someone
 * merely suspended there is still a member.
 * @type {(u: any, org: string) => boolean}
 */
const memberHere = (u, org) => {
  if (!u || !memberOf(u).includes(org)) return false;
  const was = suspensionIn(u, org);
  return !(was && was.why === "removed");
};

/** Which record an index names. @type {Record<string, (id: string) => string>} */
const INDEXED = {
  users: K.user, courses: K.course, decks: K.deck, flags: K.flag, orgs: K.org, gone: K.gone,
};

/* What a restore may write, and nothing else: a prefix missing from here is
   reported as not allowed, never skipped in silence. A new kind of record is
   added to this line in the same release that starts writing one. */
const RESTORABLE =
  /^(user|key|course|deck|owncards|mycards|card|numsys|timesys|mysystems|flag|clip|image|code|index|org|slug|former|gone|progress|paudio):/;

/**
 * Whether the account a record is about is a different person from the
 * file's, by what this request knows of the file.
 * @param {Map<string, Verdict>} verdicts
 * @param {RestoreOptions} options
 * @param {string} handle
 * @param {any} siteUser  The site's record, already read, or undefined.
 */
function anotherPerson(verdicts, options, handle, siteUser) {
  const v = verdicts.get(handle);
  if (v && v.kind === "other-person") return true;
  const was = options.created[handle];
  return !!(siteUser && siteUser.created && was && siteUser.created !== was);
}

/**
 * Write a record only when nothing is stored under its key.
 * @param {Store} store
 * @param {string} key
 * @param {string} payload
 * @returns {Promise<Outcome>}
 */
async function createOnly(store, key, payload) {
  const done = await store.set(key, payload, { onlyIfNew: true });
  return done && done.modified === false ? { outcome: "skipped", why: "exists" } : { outcome: "written" };
}

/**
 * A list on the site, with whatever the file's has that it lacks added at
 * the end. Nothing is taken out.
 * @param {Store} store
 * @param {string} key
 * @param {(cur: any) => any} grow  Returns the grown record, or null for no change.
 * @param {any} whole  The file's record, written as it is when the site has none.
 * @returns {Promise<Outcome>}
 */
async function growOnly(store, key, grow, whole) {
  /** @type {Outcome} */
  let outcome = { outcome: "skipped", why: "exists" };
  await updateJson(store, key, (/** @type {any} */ cur) => {
    if (!cur) {
      outcome = { outcome: "written" };
      return whole;
    }
    const next = grow(cur);
    outcome = next ? { outcome: "merged" } : { outcome: "skipped", why: "exists" };
    return next;
  });
  return outcome;
}

/** The ids `extra` has and `have` lacks, in `extra`'s order. @type {(have: any, extra: any) => string[]} */
const missingFrom = (have, extra) => {
  const held = new Set(Array.isArray(have) ? have : []);
  return [...new Set(Array.isArray(extra) ? extra : [])].filter((x) => typeof x === "string" && !held.has(x));
};

/**
 * One record of a restore (B5), decided from the site as it is now.
 * @param {Store} store
 * @param {string} key
 * @param {any} value
 * @param {{ options: RestoreOptions, verdicts: Map<string, Verdict>, into?: string }} ctx
 *   `into`: the space the restore is run from, which is where material
 *   from before spaces goes — see placed.
 * @returns {Promise<Outcome>}
 */
async function restoreOne(store, key, value, ctx) {
  const { options, verdicts } = ctx;
  /*
   * Material from before spaces (0.589). A backup taken before 0.542 names
   * no space on its courses, decks, cards and reports, and a record that
   * names none reads as Main's: put back as it was, a class that had since
   * moved to a space of its own showed its decks there, each saying how
   * many cards it held, and not one card reached its teacher or students.
   *
   * So such a record goes into the space the restore is run from, and one
   * already on the site that names no space — from before spaces, or put
   * back that way by an earlier restore — is placed there too. Placing is
   * the one change a restore makes to a record it finds (the owner's
   * answer, 2a): nothing else about it moves, a record that names its
   * space keeps it, and run from Main this changes nothing at all.
   */
  const into = ctx.into && ctx.into !== MAIN ? ctx.into : "";
  const SPACED_KINDS = ["course", "deck", "card", "flag"];
  /** The file's record, with the space it goes into. @param {any} v */
  const placed = (v) => (into && v && typeof v === "object" && !Array.isArray(v) && !v.org ? { ...v, org: into } : v);
  /** The site's record, placed, or null when it has a space. @param {any} cur */
  const placeHere = (cur) => (into && cur && typeof cur === "object" && !cur.org ? { ...cur, org: into } : null);
  const fromBefore =
    !!into && SPACED_KINDS.includes(key.slice(0, key.indexOf(":"))) &&
    !!value && typeof value === "object" && !Array.isArray(value) && !value.org;
  if (fromBefore) value = placed(value);
  if (!RESTORABLE.test(key) || key.length > 200) return { outcome: "skipped", why: "not-allowed" };
  const cut = key.indexOf(":");
  const kind = key.slice(0, cut);
  const rest = key.slice(cut + 1);
  const isText = kind === "clip" || kind === "image" || kind === "progress" || kind === "paudio";
  const payload = isText ? String(value == null ? "" : value) : JSON.stringify(value);
  if (!payload || payload === "null" || payload === "undefined") return { outcome: "skipped", why: "empty" };
  const cap = kind === "progress" || kind === "paudio" ? SYNC_MAX_BYTES : 4 * 1024 * 1024;
  if (Buffer.byteLength(payload, "utf8") > cap) return { outcome: "skipped", why: "too-large" };
  const obj = !isText && value && typeof value === "object" && !Array.isArray(value) ? value : null;

  switch (kind) {
    /* ---- people and keys ---- */
    case "user": {
      const v = verdicts.get(rest);
      if (!v || !obj) return { outcome: "skipped", why: "not-allowed" };
      if (v.kind !== "recreate") return { outcome: "skipped", why: v.kind };
      const u = normalisedUser({ ...obj, handle: rest });
      const only = (/** @type {any} */ m) =>
        Object.fromEntries(Object.entries(m && typeof m === "object" ? m : {}).filter(([o]) => v.orgs.includes(o)));
      const record = {
        ...u,
        orgs: v.orgs,
        org: v.orgs[0],
        suspendedIn: only(u.suspendedIn),
        ...(u.lastLearnedIn ? { lastLearnedIn: only(u.lastLearnedIn) } : {}),
        ...(u.lastTaughtIn ? { lastTaughtIn: only(u.lastTaughtIn) } : {}),
      };
      const done = await createOnly(store, key, JSON.stringify(record));
      if (done.outcome !== "written") return done;
      /* Brought back on purpose: its deletion record goes, and with it the
         Former members entries it left (as addMembership does on a
         reactivation). The one deletion a restore makes (B0.1). */
      if (options.bringBack.includes(rest) && (await readJson(store, K.gone(rest)))) {
        await store.delete(K.gone(rest)).catch(() => {});
        await updateJson(store, K.index("gone"), (/** @type {any} */ cur) =>
          (cur || []).includes(rest) ? cur.filter((/** @type {string} */ x) => x !== rest) : null);
        for (const o of v.orgs) {
          await updateJson(store, K.former(o), (/** @type {any} */ cur) =>
            (cur || []).some((/** @type {any} */ r) => r && r.handle === rest) ? cur.filter((/** @type {any} */ r) => r && r.handle !== rest) : null);
        }
      }
      return done;
    }
    case "key": {
      const handle = typeof value === "string" ? value : "";
      if (!handle) return { outcome: "skipped", why: "not-allowed" };
      const site = await readJson(store, K.user(handle));
      if (!site) return { outcome: "skipped", why: "no-account" };
      if (anotherPerson(verdicts, options, handle, site)) return { outcome: "skipped", why: "other-person" };
      /* A replaced key must never work again. */
      if (site.keyHash !== rest) return { outcome: "skipped", why: "key-changed" };
      return createOnly(store, key, payload);
    }

    /* ---- spaces ---- */
    case "org": {
      if (!obj) return { outcome: "skipped", why: "not-allowed" };
      const id = rest;
      const here = await readJson(store, K.org(id));
      if (!here) {
        let slug = String(obj.slug || "");
        const owner = slug ? await readJson(store, K.slug(slug)) : null;
        if (owner && owner !== id) {
          const wanted = options.newSlugs[id] || "";
          if (!wanted || slugProblem(wanted) || (await readJson(store, K.slug(wanted)))) return { outcome: "skipped", why: "slug-taken" };
          slug = wanted;
        }
        /* Only the addresses still its own: an address another space has
           since taken stays that space's, and listing it here would have
           this space's deletion take it away. */
        /** @type {string[]} */
        const formerSlugs = [];
        for (const f of Array.isArray(obj.formerSlugs) ? obj.formerSlugs : []) {
          const who = await readJson(store, K.slug(f));
          if ((!who || who === id) && f !== slug) formerSlugs.push(f);
        }
        const done = await createOnly(store, key, JSON.stringify({ ...obj, id, slug, formerSlugs }));
        if (done.outcome !== "written") return done;
        if (slug) await store.set(K.slug(slug), JSON.stringify(id), { onlyIfNew: true });
        /* Its invitation code, which a backup does not carry: back if free. */
        if (typeof obj.inviteCode === "string" && obj.inviteCode) {
          await store.set(K.code(obj.inviteCode), JSON.stringify(`org:${id}`), { onlyIfNew: true });
        }
        return done;
      }
      if (options.keepSpaceCard) return { outcome: "skipped", why: "exists" };
      /* The file's card, asked for by name: its name, logo, colour and
         admins — never its address, its codes or anything else. */
      /** @type {string[]} */
      const admins = [];
      for (const h of Array.isArray(obj.admins) ? obj.admins : []) {
        const u = await readJson(store, K.user(String(h)));
        if (memberHere(u, id) && !anotherPerson(verdicts, options, String(h), u)) admins.push(String(h));
      }
      /** @type {Outcome} */
      let outcome = { outcome: "skipped", why: "exists" };
      await updateJson(store, key, (/** @type {any} */ cur) => {
        if (!cur) return null;
        const next = {
          ...cur,
          name: typeof obj.name === "string" && obj.name ? obj.name : cur.name,
          logo: typeof obj.logo === "string" ? obj.logo : cur.logo,
          colour: typeof obj.colour === "string" ? obj.colour : cur.colour,
          admins,
        };
        if (JSON.stringify(next) === JSON.stringify(cur)) return null;
        outcome = { outcome: "merged" };
        return next;
      });
      return outcome;
    }
    case "slug": {
      const owner = await readJson(store, key);
      if (owner === null) return createOnly(store, key, payload);
      return owner === value ? { outcome: "skipped", why: "exists" } : { outcome: "skipped", why: "slug-taken" };
    }
    case "former": {
      if (!Array.isArray(value)) return { outcome: "skipped", why: "not-allowed" };
      const org = rest;
      /** @type {Set<string>} */
      const members = new Set();
      for (const r of value) {
        const h = r && typeof r.handle === "string" ? r.handle : "";
        const u = h ? await readJson(store, K.user(h)) : null;
        if (memberHere(u, org)) members.add(h);
      }
      const add = value.filter((r) => r && typeof r.handle === "string" && !members.has(r.handle));
      return growOnly(store, key, (cur) => {
        const held = new Set((Array.isArray(cur) ? cur : []).map((/** @type {any} */ r) => r && r.handle));
        const more = add.filter((r) => !held.has(r.handle));
        return more.length ? (Array.isArray(cur) ? cur : []).concat(more) : null;
      }, add);
    }
    case "gone": {
      if (await readJson(store, K.user(rest))) return { outcome: "skipped", why: "account-exists" };
      const done = await createOnly(store, key, payload);
      if (done.outcome === "written") await indexAdd(store, "gone", rest);
      return done;
    }

    /* ---- material ---- */
    case "card":
    case "flag": {
      /* Present means kept as it is, but for being placed (see above). */
      if (!fromBefore || !obj) return createOnly(store, key, payload);
      return growOnly(store, key, placeHere, obj);
    }
    case "numsys":
    case "timesys":
    case "clip":
    case "image":
      /* Present means kept as it is: a card edited since the backup keeps
         its edit. The way back to the file's copy is to delete it first. */
      return createOnly(store, key, payload);
    case "deck": {
      if (!obj) return { outcome: "skipped", why: "not-allowed" };
      return growOnly(store, key, (cur) => {
        const more = missingFrom(cur.cardIds, obj.cardIds);
        const here = (fromBefore && placeHere(cur)) || null;
        if (!more.length && !here) return null;
        const base = here || cur;
        const cardIds = (base.cardIds || []).concat(more);
        /* Its count and version move with its cards, as on any change to
           them, so a learner's device fetches the cards that came back. */
        return { ...base, cardIds, cardCount: cardIds.length, version: (base.version || 1) + 1 };
      }, obj);
    }
    case "course": {
      if (!obj) return { outcome: "skipped", why: "not-allowed" };
      const here = await readJson(store, key);
      if (here) {
        /* Its roster as it is now: only decks it lacks are added. */
        return growOnly(store, key, (cur) => {
          const more = missingFrom(cur.decks, obj.decks);
          const base = (fromBefore && placeHere(cur)) || cur;
          /* And the units among them back on its path, where the course has
             lost them (0.613): a unit is on the path of every course that
             holds it. Published where the copy says so; never opened early
             by a restore. */
          const decks = (base.decks || []).concat(more);
          const lostPath = (Array.isArray(obj.path) ? obj.path : []).filter(
            (/** @type {string} */ id) => decks.includes(id) && !(base.path || []).includes(id),
          );
          const live = obj.pathLive && typeof obj.pathLive === "object" ? obj.pathLive : {};
          const lostLive = Object.entries(live).filter(([id]) => lostPath.includes(id));
          if (!more.length && base === cur && !lostPath.length) return null;
          return {
            ...base,
            decks,
            ...(lostPath.length ? { path: (base.path || []).concat(lostPath) } : {}),
            ...(lostLive.length ? { pathLive: { ...(base.pathLive || {}), ...Object.fromEntries(lostLive) } } : {}),
          };
        }, obj);
      }
      const org = orgOf(obj);
      const member = async (/** @type {string} */ h) => {
        const u = await readJson(store, K.user(h));
        return memberHere(u, org) && !anotherPerson(verdicts, options, h, u);
      };
      /** @type {string[]} */
      const teachers = [];
      for (const h of Array.isArray(obj.teachers) ? obj.teachers : []) if (await member(h)) teachers.push(h);
      /** @type {string[]} */
      const students = [];
      for (const h of Array.isArray(obj.students) ? obj.students : []) if (await member(h)) students.push(h);
      const done = await createOnly(store, key, JSON.stringify({ ...obj, teachers, students }));
      if (done.outcome !== "written") return done;
      /* A code another course has taken since stays that course's; this
         one keeps the field, and its teacher makes a new code from the
         course page. Reported under the code's own key. */
      const taken = await restoreCodes(store, { ...obj, id: rest });
      return taken.length ? { ...done, also: taken.map((c) => ({ key: K.code(c), why: "code-taken" })) } : done;
    }
    case "mycards":
    case "owncards": {
      if (!Array.isArray(value)) return { outcome: "skipped", why: "not-allowed" };
      const site = await readJson(store, K.user(rest));
      if (anotherPerson(verdicts, options, rest, site)) return { outcome: "skipped", why: "other-person" };
      return growOnly(store, key, (cur) => {
        const more = missingFrom(cur, value);
        return more.length ? (Array.isArray(cur) ? cur : []).concat(more) : null;
      }, [...new Set(value)]);
    }
    case "mysystems": {
      if (!obj) return { outcome: "skipped", why: "not-allowed" };
      const site = await readJson(store, K.user(rest));
      if (anotherPerson(verdicts, options, rest, site)) return { outcome: "skipped", why: "other-person" };
      return growOnly(store, key, (cur) => {
        let grew = false;
        const next = { ...cur };
        for (const part of ["numbers", "times"]) {
          const have = cur[part] && typeof cur[part] === "object" ? cur[part] : {};
          const theirs = obj[part] && typeof obj[part] === "object" ? obj[part] : {};
          const merged = { ...have };
          for (const [lang, id] of Object.entries(theirs)) {
            if (!(lang in merged)) {
              merged[lang] = id;
              grew = true;
            }
          }
          next[part] = merged;
        }
        return grew ? next : null;
      }, obj);
    }
    case "code": {
      const owner = await readJson(store, key);
      if (owner === null) return createOnly(store, key, payload);
      return owner === value ? { outcome: "skipped", why: "exists" } : { outcome: "skipped", why: "code-taken" };
    }

    /* ---- practice, in the sync store, found by the site's account ---- */
    case "progress":
    case "paudio": {
      const [handle, id] = rest.split(":");
      const site = await readJson(store, K.user(handle || ""));
      if (!site || !site.keyHash) return { outcome: "skipped", why: "no-account" };
      if (anotherPerson(verdicts, options, handle, site)) return { outcome: "skipped", why: "other-person" };
      if (kind === "progress") {
        const r = await mergeSyncDoc(site.keyHash, payload, Date.now());
        return r.outcome === "skipped" ? { outcome: "skipped", why: r.why || "exists" } : { outcome: r.outcome };
      }
      return (await writeSyncAudioIfAbsent(site.keyHash, id || "", payload))
        ? { outcome: "written" }
        : { outcome: "skipped", why: "exists" };
    }

    /* ---- indexes: only what is on the site now ---- */
    case "index": {
      const recordOf = INDEXED[rest];
      if (!recordOf || !Array.isArray(value)) return { outcome: "skipped", why: "not-allowed" };
      /** @type {string[]} */
      const there = [];
      for (const id of new Set(value)) {
        if (typeof id === "string" && id && (await store.has(recordOf(id)))) there.push(id);
      }
      /** @type {Outcome} */
      let outcome = { outcome: "skipped", why: "exists" };
      await updateJson(store, key, (/** @type {any} */ cur) => {
        const more = missingFrom(cur, there);
        if (!more.length) return null;
        outcome = cur ? { outcome: "merged" } : { outcome: "written" };
        return (Array.isArray(cur) ? cur : []).concat(more);
      });
      return outcome;
    }
  }
  return { outcome: "skipped", why: "not-allowed" };
}

/**
 * A course's join codes, after the course was written from a file: a code
 * goes back where it is free or already this course's.
 * @param {Store} store
 * @param {any} course
 * @returns {Promise<string[]>}  Codes now in use by another course.
 */
async function restoreCodes(store, course) {
  /** @type {string[]} */
  const taken = [];
  for (const c of [course.code, course.teacherCode]) {
    if (typeof c !== "string" || !c) continue;
    const owner = await readJson(store, K.code(c));
    if (owner === null) await store.set(K.code(c), JSON.stringify(course.id), { onlyIfNew: true });
    else if (owner !== course.id) taken.push(c);
  }
  return taken;
}

/** @param {Request} req */
export default (req) => orgScope.run({ org: null, self: "", orgs: [], wide: false }, () => handle(req));

/** @param {Request} req */
async function handle(req) {
  /* Everything, the setup included, runs inside the try. getStore throws
     outright on a site with no Blobs configuration, and a throw out here
     is not an answer at all: the platform replies 500 with a body that
     isn't JSON, so the app can only report that it couldn't read the
     answer. Inside, the same failure arrives as an error it can name. */
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const store = getStore(STORE);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    /* ================= accounts ================= */

    /*
     * A space's public face (0.543): what its address shows before anyone
     * signs in — its name, logo and colour, or where it moved to. Never its
     * people or material. The logo travels as its data URL, because the
     * image action needs a key.
     */
    if (action === "org-info") {
      await ensureMain(store);
      const slug = String(url.searchParams.get("slug") || "").toLowerCase();
      const id = slug ? await readJson(store, K.slug(slug)) : null;
      const org = typeof id === "string" ? await readJson(store, K.org(id)) : null;
      if (!org) return json({ error: "no-space" }, 404);
      if (org.slug !== slug) return json({ ok: true, moved: org.slug });
      const logoData = org.logo ? (await store.get(K.image(org.logo), { type: "text" }).catch(() => null)) || "" : "";
      return json({ ok: true, org: { ...orgCard(org), logoData, closed: !!org.archived } });
    }

    /*
     * Making an account (0.543): with a space's invite code or a course
     * code, which decides the space (24b, 23a). The one exception is the
     * very first account on an empty site, which has nobody to be invited
     * by: it goes into Main, and is the owner's.
     */
    if (action === "signup") {
      await ensureMain(store);
      const displayName = String(body.displayName || "").trim().slice(0, 40);
      if (!displayName) return json({ error: "name-required" }, 400);

      const handles = await readIndex(store, "users");
      const given = String(body.code || "").replace(/\s+/g, "").toLowerCase();
      const target = await codeTarget(store, given);
      if (!target && (given || handles.length)) return json({ error: given ? "bad-code" : "code-required" }, 403);
      const orgId = !target ? MAIN : target.kind === "org" ? target.org.id : orgOf(target.course);
      const org = await readJson(store, K.org(orgId));
      if (!org) return json({ error: "no-space" }, 404);
      if (org.archived) return json({ error: "space-closed" }, 403);
      const at = String(body.org || "");
      if (at && at !== orgId) return json({ error: "other-space", space: orgCard(org) }, 409);

      const handle = makeHandle(displayName, handles.concat(await readIndex(store, "gone")));
      const key = makeKey();
      const user = {
        handle,
        displayName,
        admin: false,
        org: orgId,
        orgs: [orgId],
        created: Date.now(),
        lastSeen: Date.now(),
        keySaved: false,
      };
      await writeJson(store, K.user(handle), { ...user, keyHash: sha(key) });
      await writeJson(store, K.keyOf(sha(key)), handle);
      await updateJson(store, K.index("users"), (/** @type {any} */ cur) => (cur || []).concat([handle]));
      /* A course code puts them on the course, as the code says. */
      if (target && target.kind === "course") {
        const as = target.asTeacher ? "teachers" : "students";
        await updateJson(store, K.course(target.course.id), (/** @type {Course | null} */ c) =>
          c && !c[as].includes(handle) ? { ...c, [as]: c[as].concat([handle]) } : null
        );
      }
      // The key is shown once and cannot be read back from the digest.
      return json({ ok: true, user: { ...withoutMemberships(user), org: orgCard(org), orgs: [orgCard(org)] }, key });
    }

    /*
     * Signing in, and asking who you are (memberships). The space answered
     * is the one asked for (the address open, or the one last used on the
     * device) when the account is in it and may use it, and otherwise the
     * first that it may. Signing in at a space you're not in is no longer
     * refused: you land in your own (A2). An account with no space it may
     * use gets in only with a code that gives it one — the invitation it
     * followed. An App admin may open any address (35a), as before.
     */
    if (action === "signin" || action === "whoami") {
      await ensureMain(store);
      const found = await currentUser(req, store);
      if (!found) return json({ error: "bad-key" }, 401);
      /* Suspended across the whole app by the super admin (0.578). */
      if (!found.admin && found.suspendedApp) return json({ error: "suspended-app" }, 403);
      /** @type {any} */
      let me = found;
      let { orgDocs, active } = await standingOf(store, me);
      const code = String(url.searchParams.get("code") || "").replace(/\s+/g, "").toLowerCase();
      if (!me.admin && !active.length && code) {
        const joined = await joinByCode(store, me, code);
        if (joined.ok) {
          me = (await readJson(store, K.user(me.handle))) || me;
          ({ orgDocs, active } = await standingOf(store, me));
        }
      }
      if (!me.admin && !active.length) {
        /* Suspended in, removed from or gone from every space they are in
           (0.578): they still sign in, to a page that says so and takes an
           invitation or a course code. Only every space closed signs out. */
        const stranded = memberOf(me)
          .map((id) => ({ id, was: suspensionIn(me, id), doc: orgDocs.get(id) }))
          .filter((x) => x.was && x.doc && !x.doc.archived)
          .map((x) => ({ space: orgCard(x.doc), why: String(x.was.why || "suspended") }));
        if (!stranded.length) return json({ error: "space-closed" }, 403);
        await touch(store, me, "lastSeen");
        return json({
          ok: true,
          user: {
            ...withoutMemberships(me),
            suspended: undefined,
            org: stranded[0].space,
            orgAdmin: false,
            orgs: [],
            stranded,
          },
        });
      }
      const at = String(url.searchParams.get("org") || "");
      const landId = me.admin ? orgOf(me) : at && active.includes(at) ? at : active[0];
      const org = orgDocs.get(landId) || (await readJson(store, K.org(landId)));
      await touch(store, me, "lastSeen");
      /* The App admin's own spaces too (0.574), so the app can tell them
         from a space they are only trying. */
      const shown = me.admin ? memberOf(me).filter((id) => orgDocs.get(id)) : active;
      return json({
        ok: true,
        user: {
          ...withoutMemberships(me),
          suspended: undefined,
          org: org ? orgCard(org) : { id: MAIN, slug: MAIN, name: "Main", logo: "", colour: "" },
          orgAdmin: !!org && (org.admins || []).includes(me.handle),
          /* Whether they run each space too (0.610), so Where you are can
             offer Admin on a space other than the one here. */
          orgs: shown
            .map((id) => orgDocs.get(id))
            .filter(Boolean)
            .map((o) => ({ ...orgCard(o), runs: (o.admins || []).includes(me.handle) })),
        },
      });
    }

    const me = await currentUser(req, store);
    if (!me) return json({ error: "bad-key" }, 401);
    if (!me.admin && me.suspendedApp) return json({ error: "suspended-app" }, 403);
    const mine = me.handle;
    const iAmAdmin = !!me.admin;

    /*
     * The spaces this account may act in right now (memberships): in, not
     * suspended there (64a), and the space not closed (62a). With none, it
     * can do nothing but join one by a code. App admins act anywhere.
     */
    const { active } = await standingOf(store, me);
    if (!iAmAdmin && !active.length && !JOINS.has(action) && !STRANDED_MAY.has(action)) {
      return json({ error: memberOf(me).some((id) => suspensionIn(me, id)) ? "suspended" : "space-closed" }, 403);
    }

    /* The org this request acts in (B3): for a member, the one named by
       x-org when they may act there, else the first they may; for an App
       admin, the one named by x-org when it exists. From here on the
       readers answer null for anything in another org — except in the few
       actions that read across every space the caller is in (WIDE). */
    await ensureMain(store);
    await sweepStudentMySpace(store);
    const asked = String(req.headers.get("x-org") || "");
    let acting = orgOf(me);
    if (iAmAdmin) {
      if (asked && (await readJson(store, K.org(asked)))) acting = asked;
    } else {
      acting = asked && active.includes(asked) ? asked : active[0] || orgOf(me);
    }
    const scope = orgScope.getStore();
    if (scope) {
      scope.org = acting;
      scope.self = mine;
      /* The App admin reads across their own spaces like any member
         (0.577); in a space they only try, that space alone. */
      scope.orgs = iAmAdmin ? (memberOf(me).includes(acting) ? active : [acting]) : active;
      scope.wide = WIDE.has(action);
    }
    /* Who runs the space this request acts in (0.544): its space admins,
       acting in their own space, and App admins anywhere. A space admin is
       never an App admin: everything that was the App admin's alone stays
       so unless it is named for space admins below. */
    const actingOrgDoc = await readJson(store, K.org(acting));
    const iRunThis = !!actingOrgDoc && active.includes(acting) && (actingOrgDoc.admins || []).includes(mine);
    const iManage = iAmAdmin || iRunThis;
    /* The App admin in a space their account is not in tries it as a
       learner (0.574): every course there is dealt to them, and no roster
       or membership changes. */
    const trying = iAmAdmin && !memberOf(me).includes(acting);
    /** Names for handles whose accounts were deleted (0.544): what they made keeps their name. */
    async function nameTheGone(/** @type {Record<string, string>} */ nameOf, /** @type {string[]} */ handles) {
      for (const h of [...new Set(handles)]) {
        if (!h || (nameOf[h] && nameOf[h] !== h)) continue;
        const g = await readJson(store, K.gone(h));
        if (g && g.displayName) nameOf[h] = g.displayName;
      }
    }
    /** Rows read straight off an index, with another org's blanked (kept in place, so ids still line up). */
    const here = (/** @type {any[]} */ rows) => rows.map((r) => (r && inScope(r) ? r : null));

    /* Stamped where a teaching action has gone through, never where one was
       merely attempted: a save refused as not-yours is not work done. Which
       is why this is called at each one's success rather than once up here
       off a list of action names — the list would be right about what was
       asked for and wrong about what happened. Every action that writes a
       card or a deck ends with it. */
    const taught = () => touch(store, me, "lastTaught", [acting]);

    /* The app's word that a session was practiced. Learning happens on the
       device and syncs as an opaque document, so this is the only way the
       server can know it happened at all. Sent at most once every few
       minutes, so it is one small write however long the session runs.
       The app says which spaces the session's cards came from; a build
       older than memberships doesn't, and its practice counts where the
       request acts. */
    if (action === "practiced") {
      const said = Array.isArray(body.orgs) ? body.orgs.map(String) : null;
      const where = said ? said.filter((/** @type {string} */ o) => memberOf(me).includes(o)) : [acting];
      await touch(store, me, "lastLearned", where);
      return json({ ok: true });
    }

    /* Closing your own account: everything the server holds about you,
       including the decks you made. Cards on the device are the person's
       own business and stay there until they clear them. The same walk an
       administrator removing somebody does, which is why it is one
       function rather than two that drifted. */
    if (action === "delete-account") {
      await wipeAccount(store, mine);
      return json({ ok: true });
    }

    if (action === "rename") {
      const displayName = String(body.displayName || "").trim().slice(0, 40);
      if (!displayName) return json({ error: "name-required" }, 400);
      /* Conditional, so a membership written at the same moment is kept (0.580). */
      await updateJson(store, K.user(mine), (/** @type {any} */ cur) => (cur ? { ...cur, displayName } : null));
      return json({ ok: true, displayName });
    }

    /*
     * "Something about this question is wrong."
     *
     * Anyone signed in may send one: the people who meet a bad card are
     * the students, and a student who has to find a teacher to tell is a
     * student who does not tell. The reporter's name is copied in beside
     * their handle, so the report still says who sent it after the account
     * is gone.
     */
    if (action === "report-flag") {
      const kind = String(body.kind || "");
      if (!FLAG_KINDS.includes(kind)) return json({ error: "bad-flag" }, 400);
      const note = String(body.note || "").trim().slice(0, FLAG_NOTE_MAX);
      /* "Something else" is the option that says nothing by itself. Sent
         empty it is a report nobody can act on, so it is refused here as
         well as disabled in the app. */
      if (kind === "other" && !note) return json({ error: "note-required" }, 400);

      /* The card as it stood when the flag was sent, so that reading the
         report later can say whether it has moved since. Its revision, not
         a copy: what an administrator needs to know is "is this still the
         card they were looking at", and one number answers that.

         `cardKnown` is whether the site held the card at all when the
         report arrived. A card already gone by then and one deleted since
         are both missing when the report is read, and only one of them is
         news to whoever is reading it. */
      const cardId = cardIdOf(String(body.cardId || "").slice(0, 64));
      const flagged = cardId ? await readCard(store, cardId) : null;
      /* A card in My space is its owner's to fix, not to report (0.545).
         Read unscoped (0.557): to anyone but its owner a My space card reads
         as missing, and a missing card is otherwise reportable. */
      const raw = cardId && !flagged ? await readJson(store, K.card(cardId)) : flagged;
      if (raw && raw.personal) return json({ error: "not-reportable" }, 400);

      const flag = {
        id: randomBytes(8).toString("hex"),
        /* The card's own space: a learner's report reads across all of
           theirs (memberships), so the space it goes to is the card's. */
        org: flagged ? orgOf(flagged) : acting,
        kind,
        note,
        handle: mine,
        handleName: me.displayName || mine,
        cardId,
        cardKnown: !!flagged,
        cardRev: flagged ? flagged.rev || 1 : 0,
        exercise: String(body.exercise || "").slice(0, 40),
        subId: body.subId ? String(body.subId).slice(0, 64) : null,
        language: String(body.language || "").slice(0, 20),
        prompt: String(body.prompt || "").slice(0, 200),
        meaning: String(body.meaning || "").slice(0, 200),
        /* Where the card reached the learner from, so a bad batch can be
           found by the deck rather than one report at a time. Empty on a
           card the learner made, and on every report sent by a build older
           than this. */
        courseId: String(body.courseId || "").slice(0, 64),
        deckId: String(body.deckId || "").slice(0, 64),
        /* What they put and what the app made of it. "It marked me wrong"
           cannot be acted on without the answer it marked; with it, most
           reports name their own bug.

           The verdict is checked against the list rather than stored as
           sent: an unknown word here would reach the export as a word
           nothing can read, exactly as an open `kind` would. */
        answer: String(body.answer || "").slice(0, 200),
        verdict: FLAG_VERDICTS.includes(String(body.verdict)) ? String(body.verdict) : "",
        expected: String(body.expected || "").slice(0, 200),
        release: String(body.release || "").slice(0, 40),
        /* Which filled sentence it was, where the card is a frame — the
           fingerprint its review is kept in, so a teacher reading this can
           strike that one sentence and nothing else. See review.ts. */
        ...(isSentenceKey(body.sentence) ? { sentence: body.sentence } : {}),
        /* What the learner was looking at (0.612): the question as shown,
           the phrase, the answers offered, the nouns a counted number had
           to choose from. Plain text, kept only where sent. */
        ...Object.fromEntries(
          ["shown", "phrase", "options", "nouns"]
            .map((k) => [k, String(body[k] || "").slice(0, 400)])
            .filter(([, v]) => v),
        ),
        at: Date.now(),
      };
      await writeJson(store, K.flag(flag.id), flag);

      /* Newest last, the way every other index here grows. Trimmed on the
         way in rather than on the way out, so the list an administrator
         reads is never one the server would have refused to keep. */
      /** @type {string[]} */
      let dropped = [];
      await updateJson(store, K.index("flags"), (/** @type {string[] | null} */ cur) => {
        const ids = (cur || []).filter((x) => x !== flag.id).concat([flag.id]);
        dropped = ids.slice(0, Math.max(0, ids.length - MAX_FLAGS));
        return ids.slice(dropped.length);
      });
      for (const id of dropped) await store.delete(K.flag(id)).catch(() => {});
      return json({ ok: true, id: flag.id });
    }

    /*
     * Feedback about the app (0.552), from the You menu. Anyone signed in
     * may send it; only the App admin reads it, in Super admin → Reports —
     * a space admin never sees it. It carries the space and where in the
     * app it was sent from. Both kinds need words.
     */
    if (action === "send-feedback") {
      const kind = String(body.kind || "");
      if (!FEEDBACK_KINDS.includes(kind)) return json({ error: "bad-feedback" }, 400);
      const note = String(body.note || "").trim().slice(0, FLAG_NOTE_MAX);
      if (!note) return json({ error: "note-required" }, 400);
      const item = {
        id: randomBytes(8).toString("hex"),
        org: acting,
        kind,
        note,
        handle: mine,
        handleName: me.displayName || mine,
        screen: String(body.screen || "").slice(0, 80),
        release: String(body.release || "").slice(0, 40),
        at: Date.now(),
      };
      await writeJson(store, K.feedback(item.id), item);
      /** @type {string[]} */
      let dropped = [];
      await updateJson(store, K.index("feedback"), (/** @type {string[] | null} */ cur) => {
        const ids = (cur || []).filter((x) => x !== item.id).concat([item.id]);
        dropped = ids.slice(0, Math.max(0, ids.length - MAX_FLAGS));
        return ids.slice(dropped.length);
      });
      for (const id of dropped) await store.delete(K.feedback(id)).catch(() => {});
      return json({ ok: true, id: item.id });
    }

    /* One-time promotion, so the first admin can exist at all. */
    if (action === "claim-admin") {
      if (!process.env.ADMIN_KEY || String(body.adminKey || "") !== process.env.ADMIN_KEY) {
        return json({ error: "not-allowed" }, 401);
      }
      await updateJson(store, K.user(mine), (/** @type {any} */ cur) => (cur ? { ...cur, admin: true } : null));
      return json({ ok: true });
    }

    /* ================= decks ================= */

    if (action === "create-deck") {
      const title = String(body.title || "").trim().slice(0, 60);
      if (!title) return json({ error: "title-required" }, 400);
      /* My space (0.545): anyone may make a personal deck; a deck of the
         space is made by its teachers, space admins and App admins (33a). */
      /* Since 0.550, students make nothing at all: My space too is for those
         who teach or run the space. */
      const personal = body.personal === true;
      if (!iManage && !(await everyCourse(store)).some((c) => isTeacher(c, mine))) {
        return json({ error: "not-teaching" }, 403);
      }
      const id = `d${randomBytes(6).toString("hex")}`;
      const deck = {
        id,
        org: acting,
        ...(personal ? { personal: true, practise: true } : {}),
        owner: mine,
        title,
        description: String(body.description || "").slice(0, 300),
        lang: String(body.lang || "").slice(0, 20),
        version: 1,
        courses: [],
        cardIds: [],
        updated: Date.now(),
      };
      await writeJson(store, K.deck(id), deck);
      await indexAdd(store, "decks", id);
      await taught();
      return json({ ok: true, deck });
    }

    /* ---- cards, owned by whoever made them ---- */

    /* ================= cards =================

       A card belongs to whoever made it, not to a deck. Decks hold ids,
       so one card can sit in several without being copied — which is
       what makes a library rather than a pile of duplicates. */

    /** @param {string} id */
    async function loadCard(id) {
      return readCard(store, id);
    }

    /* Which decks hold a card. Kept on the card itself (inDecks) so that
       saving or deleting one card touches only the decks it is actually in,
       instead of reading every deck on the site. Cards saved before the
       index existed are found the slow way once, and gain it on their next
       save. */
    /**
     * @param {Card} card
     * @returns {Promise<string[]>}
     */
    async function decksHolding(card) {
      if (Array.isArray(card.inDecks)) return card.inDecks;
      const deckIds = await readIndex(store, "decks");
      const rows = await readManyJson(store, deckIds.map((id) => K.deck(id)));
      return rows.filter((d) => d && (d.cardIds || []).includes(card.id)).map((d) => d.id);
    }

    /* Take a card out of the decks that hold it. One read-modify-write per
       deck, grouped so deleting twenty cards from one deck is one write. */
    /** @param {Map<string, Set<string>>} removals deckId -> the cards to take out */
    async function pullFromDecks(removals) {
      for (const [did, cardIds] of removals) {
        /* Against whatever the deck holds at the moment of writing, so a
           card added to it while this was running is not carried off by a
           deletion that never knew about it — see updateJson. */
        await updateJson(store, K.deck(did), (d) => {
          if (!d) return null;
          const next = (d.cardIds || []).filter((/** @type {string} */ x) => !cardIds.has(x));
          if (next.length === (d.cardIds || []).length) return null;
          return {
            ...d,
            cardIds: next,
            cardCount: next.length,
            version: (d.version || 1) + 1,
            updated: Date.now(),
          };
        });
      }
    }

    /*
     * Say that this person's values have changed.
     *
     * A card that fills a variable belongs to no deck — that is the point
     * of it: it is borrowed by whichever phrase has a hole of that name —
     * so writing one moves nothing a student's device compares against.
     * This is what moves, and my-material folds it into the version it
     * hands out.
     * @param {string} owner
     */
    async function bumpFills(/** @type {string} */ owner) {
      if (!owner) return;
      const at = (await readJson(store, K.fillsRev(owner))) || {};
      await writeJson(store, K.fillsRev(owner), {
        rev: (Number(at.rev) || 0) + 1,
        updated: Date.now(),
      });
    }

    /**
     * Which systems one person has, by kind and language.
     *
     * A tiny index beside the systems themselves, because every question
     * anybody asks is "the numbers of this language, by this teacher" and
     * answering it by reading every system on the site would be reading
     * the whole shelf to find one book.
     * @param {string} owner
     */
    async function systemIndex(owner) {
      const held = (await readJson(store, K.mySystems(owner))) || {};
      return {
        numbers: (held.numbers && typeof held.numbers === "object") ? held.numbers : {},
        times: (held.times && typeof held.times === "object") ? held.times : {},
        /* Whether the old number cards have already been read. A stamp
           rather than a thing to work out, because every student's device
           asks this question on every poll and the honest answer costs a
           read of the teacher's whole collection. */
        seeded: !!held.seeded,
      };
    }

    /**
     * @param {string} owner
     * @param {string[]} langs
     */
    async function systemsOf(owner, langs) {
      const index = await systemIndex(owner);
      /** @type {string[]} */
      const keys = [];
      for (const lang of langs) {
        if (index.numbers[lang]) keys.push(K.numSys(index.numbers[lang]));
        if (index.times[lang]) keys.push(K.timeSys(index.times[lang]));
      }
      if (!keys.length) return [];
      const rows = await readManyJson(store, keys, EVENTUAL);
      return rows.filter(Boolean);
    }

    /**
     * Which of each deck's number parts its students would get nothing
     * from, keyed by deck id — the parts as the deck stores them.
     *
     * A deck names its parts and a student's device builds them out of the
     * teachers' numbers, so a part whose words are not all written yet is a
     * part that sends nothing: no question on it, and none of the words it
     * would have brought. The deck went on saying "5 number parts" all the
     * same, and a deck of numbers nobody had written read as full while its
     * students were told there was nothing to practise.
     *
     * Read the way the device reads it: the numbers of everyone whose
     * material reaches a student of a course that holds the deck — the
     * deck's owner, and each such course's teachers and the owners of its
     * other decks — in the deck's language, each with its clock, and a part
     * open where rangeChecks opens it in any of them. A part stored under
     * its old name is ready only when every part it became is.
     * @param {Deck[]} decks
     * @param {Course[]} courses  Every course on the site.
     * @returns {Promise<Map<string, string[]>>}
     */
    async function partsWaiting(decks, courses) {
      /** @type {Map<string, string[]>} */
      const out = new Map();
      const withParts = decks.filter((d) => (d.parts || []).length);
      if (!withParts.length) return out;
      /* A deck's owner, for the decks beside these in their courses that
         are not in this list. */
      const ownerOf = new Map(decks.map((d) => [d.id, d.owner]));
      const beside = courses.filter((c) => withParts.some((d) => (c.decks || []).includes(d.id)));
      const unknown = [...new Set(beside.flatMap((c) => c.decks || []))].filter((id) => !ownerOf.has(id));
      (await readManyJson(store, unknown.map((id) => K.deck(id)))).forEach((d, i) => {
        if (d) ownerOf.set(unknown[i], d.owner);
      });

      /** @type {Map<string, Promise<Set<string>>>} */
      const openFor = new Map();
      /** What one person's numbers, in one language, open. */
      const opens = (/** @type {string} */ owner, /** @type {string} */ lang) => {
        const at = `${owner} ${lang}`;
        const held = openFor.get(at);
        if (held) return held;
        const work = (async () => {
          const index = await systemIndex(owner);
          const [numbers, times] = await Promise.all([
            index.numbers[lang] ? readJson(store, K.numSys(index.numbers[lang])) : null,
            index.times[lang] ? readJson(store, K.timeSys(index.times[lang])) : null,
          ]);
          const sys = numbers ? readNumberSystem(numbers) : null;
          const clock = times ? readTimeSystem(times) : null;
          return new Set(
            rangeChecks(
              composerFor(lang),
              sys,
              timeComposerFor(lang),
              clock && sys && clock.numberSystemId === sys.id ? clock : null,
            )
              .filter((c) => c.open)
              .map((c) => c.range.id),
          );
        })();
        openFor.set(at, work);
        return work;
      };

      for (const d of withParts) {
        const holding = courses.filter((c) => (c.decks || []).includes(d.id));
        const lang = d.lang || (holding[0] && holding[0].language) || "";
        /* The one person whose numbers the deck uses (0.541): its own
           choice, or its owner. Every teacher's used to count, which sent
           students each number once per teacher. */
        const whose = [d.numbersFrom || d.owner].filter(Boolean);
        /** @type {Set<string>} */
        const open = new Set();
        for (const ids of await Promise.all(whose.map((h) => opens(h, lang)))) for (const id of ids) open.add(id);
        out.set(
          d.id,
          (d.parts || []).filter((p) => {
            const now = partsNow([p]);
            return !now.length || !now.every((id) => open.has(id));
          }),
        );
      }
      return out;
    }

    /**
     * Build a system out of somebody's old number cards, once per language.
     * @param {string} owner
     */
    async function seedSystems(owner) {
      if (!owner) return;
      /* Once per person, ever. It used to run only where a teacher opened
         the screen, and then a class whose teacher never did would keep a
         shelf of number cards and no system to build a range out of. It
         runs from the students' own poll as well now, so the stamp is
         what keeps that poll from reading a whole collection every time. */
      if ((await systemIndex(owner)).seeded) return;
      /** @type {string[]} */
      const ids = (await readJson(store, K.myCards(owner))) || [];
      await updateJson(store, K.mySystems(owner), (current) => {
        const held = current && typeof current === "object" ? current : {};
        return held.seeded ? null : { ...held, seeded: true };
      });
      if (!ids.length) return;
      const rows = (await readManyJson(store, ids.map((id) => K.card(id)))).filter(Boolean);
      /** @type {Map<string, any[]>} */
      const byLang = new Map();
      for (const card of rows) {
        /* A part was a card with a value on it, and nothing else ever
           carried one — see the old numbers module. */
        if (typeof card.value !== "number" || !card.lang) continue;
        const held = byLang.get(card.lang);
        if (held) held.push(card);
        else byLang.set(card.lang, [card]);
      }
      if (!byLang.size) return;

      const index = await systemIndex(owner);
      for (const [lang, cards] of byLang) {
        if (index.numbers[lang]) continue;
        const composer = composerFor(lang);
        if (!composer) continue;
        const id = `n${randomBytes(6).toString("hex")}`;
        const now = Date.now();
        const built = migrateCards(
          cards.sort((a, b) => (a.created || 0) - (b.created || 0)),
          composer,
          emptyNumberSystem(id, owner, lang, now, composer.version),
        );
        if (!built.filled && !built.written) continue;
        await writeJson(store, K.numSys(id), { ...built.system, rev: 1, updated: now });
        await updateJson(store, K.mySystems(owner), (current) => {
          const held = current && typeof current === "object" ? current : {};
          const slot = { ...(held.numbers && typeof held.numbers === "object" ? held.numbers : {}) };
          if (slot[lang]) return null;
          slot[lang] = id;
          return { ...held, numbers: slot };
        });
        /* And the cards it was built from are marked as having been read.
           They are not deleted: a card carries recordings and somebody's
           progress, and clearing a box was never a way of asking for
           either to be thrown away. A later release takes them. */
        for (const cardId of built.fromCards) {
          await updateJson(store, K.card(cardId), (card) =>
            card && !card.derived ? { ...card, derived: true } : null,
          );
        }
      }
    }

    /**
     * Fold a person's subtype-named custom tags into the subtype, once —
     * and, since 0.411, tick "keeps its capital letters" on the cards the
     * old list of words kept a capital on (see tickCapitals), once.
     *
     * A lift in the mould of seedSystems: stamped per person, run from the
     * teacher's own screen and from their students' polls, and it deletes
     * nothing but the tag. What the rule is — which card takes which
     * subtype — is liftSubtypeTags's, shared with the device. Every card it
     * changes moves the decks it is in and the owner's fills revision, so
     * a student's device fetches the corrected cards rather than keeping
     * the ones it had.
     * @param {string} owner
     */
    async function liftTags(owner) {
      if (!owner) return;
      const done = await readJson(store, K.tagLift(owner));
      /* 2: and the tick for the capitals, on the cards the old list of
         words kept a capital on — see tickCapitals. A teacher whose tags
         were folded at 1 has this pass run once more for it; folding
         them again changes nothing. */
      if (done && done.v >= 2) return;
      /** @type {string[]} */
      const ids = (await readJson(store, K.myCards(owner))) || [];
      /** @type {Set<string>} */
      const decks = new Set();
      let moved = false;
      for (const id of ids) {
        let changed = null;
        await updateJson(store, K.card(id), (card) => {
          const lifted = card ? liftSubtypeTagsIn(card, card.lang) : null;
          changed = tickCapitals(lifted || card) || lifted;
          return changed;
        });
        if (!changed) continue;
        moved = true;
        for (const did of /** @type {any} */ (changed).inDecks || []) decks.add(String(did));
      }
      for (const did of decks) {
        await updateJson(store, K.deck(did), (deck) =>
          deck ? { ...deck, version: (deck.version || 1) + 1, updated: Date.now() } : null,
        );
      }
      if (moved) await bumpFills(owner);
      /* Stamped after rather than before, so a pass cut short runs again.
         Two polls racing through it both find the same cards and write
         the same answer: the lift changes nothing the second time. */
      await writeJson(store, K.tagLift(owner), { v: 2, at: Date.now() });
    }

    /* Delete cards the person may delete. Returns what happened to each id,
       so a batch can report partial success rather than stopping at the
       first card that isn't theirs. */
    /** @param {string[]} ids */
    async function deleteCards(ids) {
      /** @type {{ deleted: string[], refused: string[], missing: string[] }} */
      const result = { deleted: [], refused: [], missing: [] };
      /** @type {Map<string, Set<string>>} */
      const removals = new Map();
      /** @type {Map<string, string[]>} owner -> ids, for their mycards lists */
      const owned = new Map();
      /** @type {Set<string>} whose values changed, if any of these was one */
      const filledOwners = new Set();
      for (const id of ids) {
        const card = await loadCard(id);
        if (!card) {
          result.missing.push(id);
          continue;
        }
        if (card.owner !== mine && !iManage) {
          result.refused.push(id);
          continue;
        }
        for (const did of await decksHolding(card)) {
          let goneFrom = removals.get(did);
          if (!goneFrom) removals.set(did, (goneFrom = new Set()));
          goneFrom.add(id);
        }
        /* A card from before owners were recorded has no per-owner list to
           prune, so there is nothing to remember it under. */
        if (card.owner) {
          let theirs = owned.get(card.owner);
          if (!theirs) owned.set(card.owner, (theirs = []));
          theirs.push(id);
        }
        /* A value that has gone has to reach the devices holding it, and
           nothing else about it moves — see bumpFills. Through fillsOf, so
           a card that filled a blank by the kind of word it is counts as
           one of them, the same way the bundling counts it. */
        if (fillsOf(card).length) filledOwners.add(card.owner || "");
        result.deleted.push(id);
      }
      await pullFromDecks(removals);
      for (const id of result.deleted) await store.delete(K.card(id)).catch(() => {});
      for (const [owner, gone] of owned) {
        /* Likewise: a card written while this delete was running stays
           written, rather than being dropped from the list nothing else
           would find it by. */
        await updateJson(store, K.myCards(owner), (list) =>
          (list || []).filter((/** @type {string} */ x) => !gone.includes(x)));
      }
      for (const owner of filledOwners) await bumpFills(owner);
      return result;
    }

    /**
     * @param {Deck} deck
     * @returns {Promise<string[]>}
     */
    async function deckCardIds(deck) {
      /* Decks made before the library existed kept their cards inline.
         Move them across the first time they are read. */
      if (Array.isArray(deck.cardIds) && deck.cardIds.length) return deck.cardIds;
      const legacy = (await readJson(store, K.cards(deck.id))) || [];
      if (!legacy.length) return [];
      /** @type {string[]} */
      const ids = [];
      for (const c of legacy) {
        const id = `k${randomBytes(6).toString("hex")}`;
        await writeJson(store, K.card(id), {
          ...c,
          id,
          org: orgOf(deck),
          owner: deck.owner,
          lang: deck.lang || "",
          rev: 1,
          inDecks: [deck.id],
        });
        ids.push(id);
      }
      /* Added to the owner's list as it stands rather than to the copy
         this read before making the cards, which is a stretch of time long
         enough for a save of their own to land in between. */
      await updateJson(store, K.myCards(deck.owner), (list) => (list || []).concat(ids));
      await updateJson(store, K.deck(deck.id), (fresh) => ({
        ...(fresh || deck),
        cardIds: ids,
        cardCount: ids.length,
      }));
      await store.delete(K.cards(deck.id)).catch(() => {});
      return ids;
    }

    if (action === "my-cards") {
      await liftTags(mine);
      /** @type {string[]} */
      const ids = (await readJson(store, K.myCards(mine))) || [];
      const deckIds = await readIndex(store, "decks");
      const courseIds = await readIndex(store, "courses");
      const [cardRows, deckRows, courseRows] = await Promise.all([
        readManyJson(store, ids.map((id) => K.card(id))).then(here),
        readManyJson(store, deckIds.map((id) => K.deck(id))).then(here),
        readManyJson(store, courseIds.map((id) => K.course(id))).then(here),
      ]);

      /* The decks I may work on: mine, plus every deck in a course I teach.
         The cards in them are mine to see and correct too — a co-teacher who
         can open the deck but not its cards can't do the job. */
      const teaching = new Set(
        courseRows.filter((c) => c && isTeacher(c, mine)).flatMap((c) => c.decks || [])
      );
      /* A space admin looks after every deck in the space (6a), except
         anyone's My space. */
      const editable = deckRows.filter((d) => d && (d.owner === mine || teaching.has(d.id) || (iManage && !d.personal)));

      /** @type {Record<string, string[]>} */
      const holding = {};
      for (const d of editable) {
        for (const cid of d.cardIds || []) (holding[cid] = holding[cid] || []).push(d.id);
      }

      /* Cards I own, plus any card sitting in a deck I look after. */
      const have = new Set(ids);
      const extraIds = Object.keys(holding).filter((id) => !have.has(id));
      const extra = await readManyJson(store, extraIds.map((id) => K.card(id)));
      /* A co-teacher's card whose owner's pass has not run yet is shown as
         it will be once it has, so the editor never offers the tag it is
         about to lose. Saving it stores it that way. */
      const cards = cardRows.concat(extra).filter(Boolean)
        .map((c) => liftSubtypeTagsIn(c, c.lang) || c)
        .map((c) => tickCapitals(c) || c);
      /* As a teacher's screens see a card: the version they work on, with
         its status — see teacherView. */
      /* And which of their recordings the server does not hold, so the
         teacher hears about it — and a device that still has one can send
         it again. */
      const missingClips = await clipsMissing(store, cards.flatMap(clipsOfCard));
      return jsonTagged(req, { ok: true, cards: cards.map((c) => ({ ...teacherView(c), decks: holding[c.id] || [] })), missingClips });
    }

    if (action === "save-card") {
      const sent = body.card || {};
      const id = String(sent.id || "").replace(/[^A-Za-z0-9_-]/g, "");

      /** @type {Record<string, any>} */
      let saved;
      /** @type {string[]} */
      let current = [];
      /* Whether this card was a value before this save, so that turning one
         back into an ordinary card reaches the devices holding it too. */
      let wasFilling = false;
      /** @type {Card | null} */
      let existing = null;
      /* Asked once per deck per request: each answer reads every course. */
      /** @type {Map<string, Promise<boolean>>} */
      const editable = new Map();
      /** @param {Deck | null} d */
      const mayEditDeck = (d) => {
        if (!d) return Promise.resolve(false);
        if (!editable.has(d.id)) editable.set(d.id, canEditDeck(store, d, mine, iManage));
        return /** @type {Promise<boolean>} */ (editable.get(d.id));
      };
      if (id) {
        existing = await loadCard(id);
        if (!existing) return json({ error: "no-card" }, 404);
        wasFilling = fillsOf(existing).length > 0;
        current = await decksHolding(existing);
        if (existing.owner !== mine && !iManage) {
          /* A card in a deck I teach is mine to correct — a deck it is
             actually in, not one the request happens to name. */
          let allowed = false;
          for (const did of current) {
            const d = await readDeck(store, did);
            if (await mayEditDeck(d)) {
              allowed = true;
              break;
            }
          }
          if (!allowed) return json({ error: "not-yours" }, 403);
        }
      }

      /*
       * Which parts of the card this save is about, and where it goes.
       *
       * `touched` names the fields that changed — a tag on a card picked
       * from a list, a blank narrowed — and everything else is kept as it
       * stands now rather than as the sender last read it. Without it a
       * whole card goes up, and a teacher's copy of a published card with
       * changes waiting *is* the changes: tagging it would publish them. A
       * sender that names nothing (the card screen, an older build) sends
       * the whole card, as it always did.
       *
       * `into: "changes"` is the card screen, and any save asking for a
       * status (an import): on a published card, what it
       * saves goes into the card's unpublished changes. Every other save —
       * the Pronouns screen, tagging a selection, an older build — writes
       * the published card as it always did, and the same fields are put
       * into the changes where there are any, so that publishing them
       * later does not take back what was saved.
       *
       * `walk` is a rename or a tag taken off the collection, reaching this
       * card from another one: it rewrites both versions here, because a
       * blank has to find the name in what students have as well as in
       * the draft.
       */
      const touched = Array.isArray(body.touched) && existing
        ? [...new Set(body.touched.map((/** @type {unknown} */ k) => String(k)))]
        : null;
      /* The status a save asks for: Draft (a card made on the card
         screen) or Ready for review (an import). Asked of an existing
         card, it is the status of what this save writes — the card, where
         it has never been published, or else its changes. */
      const asked = body.status === "draft" || body.status === "review" ? body.status : null;
      const intoChanges = body.into === "changes" || !!asked;
      const walk = body.walk && typeof body.walk === "object" && existing ? body.walk : null;
      /** The working version, which a save naming its fields is laid over. */
      const base = existing ? workingOf(existing) : null;
      /** @param {Record<string, any>} from */
      const pick = (from) =>
        Object.fromEntries((touched || []).filter((k) => k in from).map((k) => [k, from[k]]));
      /* The card this save describes: the whole of what was sent, or what
         it touched laid over the card as it stands. */
      const card = touched && base ? { ...base, ...pick(sent) } : sent;
      /* The ID the teacher gave it, which is the other name a blank can
         ask for — one card rather than a group of them. Read through the
         same answer the app reads it through, so what the editor checked
         for uniqueness and what is stored here are the same string. */
      const answersTo = cardRef(card);
      /* Whether anything on this card leaves a hole. Asked of the forms
         because that is where a card's words live, and asked at all
         because a card with a hole in it is a sentence — see `sentence`
         below, which is the one place this is used. */
      /** @param {Record<string, any>} c */
      function holed(c) {
        return formsOf(c).some((/** @type {any} */ f) => slotsOf(f).length > 0);
      }
      /* The card as it is stored: what a save may write, narrowed and
         capped. A function, because a save that writes the published card
         and the changes beside it narrows each of them. */
      /** @param {Record<string, any>} card */
      const fieldsFor = (card) => {
        /* Which blanks this card says it fills, through the one answer to
           that — see fillNames, which narrows each name to the shape a
           slot can have, lowers it, and caps how many one card may carry. */
        const filling = fillNames(card);
        const ownRef = cardRef(card);
        return {
          /* What to call the card in a list, where its own words do not name
             it — a verb saved as the form a dictionary lists. Stored as given
             and capped like every other line of text here: the server does
             not know one language from another, and a name is the teacher's
             words rather than anything it can check. */
          name: String(card.name || "").slice(0, 120),
          /* What the teacher says the word is — a noun, a verb, a name.
             Narrowed to the shape an id can take, like every other id on
             this document: which categories exist is the language pack's
             business, and the server does not know one language from
             another. Stored as "" where nobody has said, which is what
             every card written before the question existed carries. */
          category: idish(card.category),
          /* Which column of the verb table a pronoun is — see the Pronouns
             screen. An id like the category, and absent rather than empty
             on every other card; undefined rather than left out, because
             this object is spread over the card as it stood. */
          person: idish(card.person) || undefined,
          /* And what a pronoun reads as in English with *to be* — "I am" —
             and as a question — "am I". The teacher's words, capped like
             every other line of text; absent where none was written, which
             reads as the reading the app makes of the pronoun's English. */
          enIs: String(card.enIs || "").trim().slice(0, 120) || undefined,
          enAsk: String(card.enAsk || "").trim().slice(0, 120) || undefined,
          /* Which meaning this card is, for a question another card shares
             its prompt with — "the plant" on صَبِر = cactus. The teacher's
             words, capped like every other line of text; absent where none
             was written, which reads as the other card's answer ruled out.
             See clueFor in src/meanings.ts. */
          clue: String(card.clue || "").trim().slice(0, 80) || undefined,
          /* The examples a verb's subjunctive is practised in — see
             VerbExample. At most three, each the teacher's words capped like
             every other line of text, and whose wish it is narrowed like an
             id. Absent where there are none, and undefined rather than left
             out, because this object is spread over the card as it stood
             and a verb whose examples were all taken away must lose them. */
          examples: storedExamples(card.examples),
          /* Whether its English keeps the capitals it was typed with — the
             teacher's tick. Kept as false as well as true, because an
             answer of no is what stops the one-time tick (see capitals.ts)
             putting it back; absent where nobody has answered, which is
             every card the editor does not ask. */
          capitals: typeof card.capitals === "boolean" ? card.capitals : undefined,
          /* Which card this one was split out of, where it was — see
             splitByMeaning. Written once, by the save that makes the card,
             and kept through every later save, which does not send it: so
             only ever set here, never cleared by saying nothing. */
          ...(idish(card.splitFrom) ? { splitFrom: idish(card.splitFrom) } : {}),
          /* And the teacher's answer that its meanings are learnt together,
             where they gave one. Kept the same way: an editor that does not
             ask the question does not undo the answer. */
          ...(typeof card.together === "boolean" ? { together: card.together } : {}),
          /* No `value` here, and none taken from a save.
             It was what made a card one of the parts a number was built out
             of, and there are no parts any more: a language's numbers are
             one document now, and the cards under it are written by the app
             out of that. So a value that arrives is dropped, like any other
             field nobody writes. A value already *stored* is kept — it comes
             through the spread of the card as it stood — because it is the
             one record of which box an old card fills and it is what the
             lift reads. Stripping it on the next save would be pulling the
             mapping out from under the migration. Kept the way a retired
             grammar axis is kept, and read in `seedSystems`. */
          note: String(card.note || "").slice(0, 500),
          lang: String(card.lang || "").slice(0, 12),
          /* Which blanks this card fills, where it is a value rather than
             something to learn. A list since a word may stand in more than
             one kind of hole; a card written when it was one name arrives as
             a string and is stored as the list of one it always meant.
             Absent where it fills none rather than stored empty, which is
             what `fills` has always been on an ordinary card and what every
             reader of it still tests for — and undefined rather than left
             out, because this object is spread over the card as it stood and
             a missing key would keep whatever it used to fill. JSON drops
             the undefined on the way to disk. */
          fills: filling.length ? filling : undefined,
          /* The ID the teacher gave this card, so another card's blank can
             ask for this one by name. Absent where it has none — a card
             written before the ID was asked for — rather than stored empty,
             and undefined rather than left out, because this object is
             spread over the card as it stood and a missing key would keep
             whatever it used to answer to. JSON drops the undefined on the
             way to disk. */
          ref: ownRef || undefined,
          /* Whether this card is a sentence — a frame other cards are
             dropped into — which is the teacher's answer rather than
             something read off the braces. Stored as a boolean either way
             rather than only when true, for the reason `drill` is: a card
             turned from a sentence back into a word must come back as a
             word, and an absent field would leave every reader falling back
             to the old reading of its braces for ever. A card written before
             this carries nothing and is read that old way, which is exactly
             what it meant — see isSentence, which is the reading this goes
             through rather than a fourth copy of it.

             Saying nothing is not the same as saying no. Reading an absent
             answer as `false` pinned every card an older build sent — and a
             build from before 0.176 says nothing about this by definition —
             so a sentence saved from a stale tab, or pasted in, came back a
             word with its own braces in it: lent into other cards' holes,
             drawn as a word, and refused by the editor on every later save
             until somebody deleted the braces.

             And a card with a hole in it is a sentence whoever says
             otherwise. That is the invariant the rest of this rests on —
             only a sentence may have a blank — and it is worth more than any
             one client's answer, so it is settled by reading rather than by
             refusing: an old client goes on saving its cards, and what it
             saves is true. A conversation is left alone, being neither. */
          sentence: !isDialog(card) && (isSentence(card) || holed(card)),
          /* Whether it is practised in its own right. Stored as a boolean
             either way rather than only when false: a card that has been
             turned off and on again must come back as on, and an absent field
             would leave the client reading the last value it synced. */
          drill: card.drill !== false,
          /*
           * The card's own word first, then every other form of it.
           *
           * One list, and one description of what a form may carry — which
           * is the whole of what the shape bought. The card's word used to be
           * written out here as fields of the card and its other forms again
           * inside `subs`, so a field that belonged to a form was described
           * twice and the two drifted: a sub-form had no id for three
           * releases, and a form switched off needed its own separate answer
           * for the card's word.
           *
           * The cap is a guard against a runaway client rather than a limit
           * anybody should meet: eight persons across three tenses is
           * twenty-four boxes before a teacher has added a plural.
           */
          forms: formsOf(card)
            .slice(0, 65)
            .map((/** @type {Record<string, any>} */ f) => ({
              /* What this form is called, for as long as anything points at
                 it — a cell of the table it carries, and a student's
                 schedule for it. Stored where the client sends one and
                 absent where it does not, so a card saved by an older build
                 is unchanged by passing through here. Narrowed to the shape
                 an id can take, like every other id on this document. */
              ...(idish(f.id) ? { id: idish(f.id) } : {}),
              ar: String(f.ar || "").slice(0, 400),
              en: String(f.en || "").slice(0, 400),
              lat: String(f.lat || "").slice(0, 400),
              /* Whatever grammatical values the form carries. The server does
                 not know which language uses which; it stores what it is
                 given, so a card is never stripped by passing through here. */
              ...Object.fromEntries(
                grammarFields().map((g) => [g, String(f[g] || "").slice(0, 40)])
              ),
              /* Which tenses this form's blanks ask their verbs for, where
                 it is a sentence that has narrowed one. A map from the
                 blank's name to the rows it admits — the names narrowed the
                 way every name that goes between braces is, and the rows to
                 the shape an id can take, because which rows a language has
                 is the language's business and the server does not know one
                 language from another. Absent where nothing is narrowed,
                 which is every card written before the teacher was asked
                 and every frame that wants any tense. */
              ...slotTenses(f),
              /* And which blank each of its blanks agrees with, where the
                 teacher linked any — see slotLinks in src/verbs.ts, which
                 this is read through. Absent where nothing is linked. */
              ...slotAgrees(f),
              /* And whose wish each verb blank's `{{verb-to}}` reads
                 against, where the teacher chose — see CardForm.wish. A
                 blank's name and a column, each narrowed to the shape a
                 name or an id can take. Absent where nobody chose. */
              ...slotWish(f),
              /* Where this form sits in the card's verb table, when it is a
                 cell of one. Stored as given, like the grammar values above
                 and for the same reason: which rows and columns a language
                 has is the language's business, and the server does not
                 know one language from another. Narrowed to the shape an
                 id can take so what comes back is what a pack can name. */
              ...cellAt(f),
              /* Whether this form is asked about. Stored only where it is
                 off, because the whole list is rewritten on every save —
                 there is no older value here to be left standing, and a
                 card saved by a build that knows nothing of this passes
                 through unchanged. */
              ...(f.ask === false ? { ask: false } : {}),
              /* And whether it may be lent to a card with a blank in it,
                 which is the other half of the same question and since
                 0.179 a separate answer — see `lend` in src/types.ts.
                 Stored only where the client has an answer to store: absent
                 means whatever `ask` says, which is what every card written
                 before this meant. */
              ...(typeof f.lend === "boolean" ? { lend: f.lend } : {}),
              answers: storedAnswers(f),
              clips: clipList(f.clips),
              slowClips: clipList(f.slowClips),
              /* The pictures on this form — see imageList. Absent rather than
                 empty on a form with none, which is every form written before
                 a card could carry one. */
              ...(imageList(f.images).length ? { images: imageList(f.images) } : {}),
            })),
          /* Which word cards this one teaches by containing them. A phrase
             the teacher recorded is a context for the words inside it, and
             this is the teacher's confirmation of which those are — never the
             app's guess, which is only ever a suggestion in the editor.

             Ids, cleaned the same way a card id is: they are written straight
             into a document and read back as identity. */
          uses: Array.isArray(card.uses)
            ? [...new Set(card.uses.map((/** @type {unknown} */ x) => String(x || "").replace(/[^A-Za-z0-9_-]/g, "")))]
                .filter(Boolean)
                .slice(0, 24)
            : [],
          /* A conversation, where the card is one: who is in it, which part
             the learner takes, and the turns in order. A line is a form with
             a speaker on it, so it is stored the way a form is — and, like a
             form, it may name the word cards it contains.

             Capped at a dozen turns and four speakers for the same reason
             everything above is capped: this is written into a document that
             is handed to every student in the course. A card with no lines
             stores none, so an ordinary word is unchanged by passing
             through here. */
          speakers: Array.isArray(card.speakers) && !isText(card)
            ? card.speakers.slice(0, 4).map((/** @type {unknown} */ n) => String(n || "").slice(0, 40))
            : [],
          /* Which part the learner takes, or null where the teacher left it
             open — most conversations are worth holding up from either end,
             and the question picks a side when the card names none. Stored
             as null rather than 0 because 0 is a real answer: "the one who
             speaks first", which is the opposite of no answer at all. */
          you:
            card.you === null || card.you === undefined || card.you === "" || isText(card)
              ? null
              : Math.max(0, Math.min(3, Math.round(Number(card.you) || 0))),
          /* Which kind of scene it is, where it is one: a text, or — saying
             nothing — the conversation every scene was before texts. Absent
             rather than "conversation", so a conversation saved here is
             byte for byte what it was. Undefined rather than left out,
             because this object is spread over the card as it stood and a
             text turned back into a conversation must stop being a text. */
          sceneKind: isDialog(card) && isText(card) ? TEXT : undefined,
          lines: Array.isArray(card.lines)
            ? card.lines.slice(0, 12).map((/** @type {Record<string, any>} */ ln) => ({
                /* What this turn is called, for as long as anything points
                   at it. A turn is drilled in its own right, with its own
                   recordings and its own progress, and it was the one kind
                   of form in the app with nothing to name it — so on a
                   student's device it was known by its position, and a
                   teacher removing a turn from the middle of a scene handed
                   every turn below it the progress of the one above. Forms
                   were named for that reason in 0.131 and table cells in
                   0.145; this is the third and last of them. */
                ...(idish(ln.id) ? { id: idish(ln.id) } : {}),
                /* Nobody says a line of a text, so every one is the first
                   speaker's, which is what a scene with no speakers reads. */
                who: isText(card) ? 0 : Math.max(0, Math.min(3, Math.round(Number(ln.who) || 0))),
                /* The sentence card this turn was picked from, where it was
                   picked rather than typed — an id, cleaned the way every card
                   id is. Its words are the sentence's, refreshed below and
                   again on the way to every student. */
                ...(cardIdish(ln.from) ? { from: cardIdish(ln.from) } : {}),
                /* Which member of the scene's cast each of its blanks plays,
                   where one plays somebody other than the member named after
                   it. Each name narrowed here; which of them the turn keeps
                   is settled once its words are final — see below — because
                   a picked turn's blanks are its sentence's, not the copy's. */
                ...rolesOf(ln),
                /* And which forms its blanks take — a tense, or a pronoun on
                   the end — the narrowing a sentence's form carries, read the
                   same way. A picked turn brings its sentence's. */
                ...slotTenses(ln),
                ar: String(ln.ar || "").slice(0, 400),
                en: String(ln.en || "").slice(0, 400),
                lat: String(ln.lat || "").slice(0, 400),
                clips: clipList(ln.clips),
                slowClips: clipList(ln.slowClips),
                uses: Array.isArray(ln.uses)
                  ? [...new Set(ln.uses.map((/** @type {unknown} */ x) => String(x || "").replace(/[^A-Za-z0-9_-]/g, "")))]
                      .filter(Boolean)
                      .slice(0, 24)
                  : [],
              }))
            : [],
        };
      };
      const fields = fieldsFor(card);

      /*
       * What the whitelist above cut, in the teacher's own terms.
       *
       * Every cap here is a guard against a runaway client rather than a
       * limit anybody should meet, and each of them did its work in
       * silence: a teacher who wrote a thirteenth turn, or a fifth
       * speaker, got "Saved" and a card with twelve turns in it. Nothing
       * on any screen said which, and the only way to find out was to
       * notice what was gone.
       *
       * Counted by comparing what arrived against what is being stored,
       * rather than by repeating the numbers: the caps live once, in the
       * whitelist, and a cap added there is reported by this without
       * being told about. Named things rather than a count, because "one
       * of your recordings" and "one of your turns" are not the same
       * news.
       */
      const trimmedOf = () => {
        /** @type {string[]} */
        const cut = [];
        /** @param {number} had @param {number} kept @param {string} one @param {string} many */
        const note = (had, kept, one, many) => {
          if (had > kept) cut.push(`${had - kept} ${had - kept === 1 ? one : many}`);
        };
        const sentForms = formsOf(card);
        note(sentForms.length, fields.forms.length, "form", "forms");
        note(
          Array.isArray(card.lines) ? card.lines.length : 0,
          fields.lines.length,
          "turn",
          "turns",
        );
        note(
          Array.isArray(card.speakers) && !isText(card) ? card.speakers.length : 0,
          fields.speakers.length,
          "speaker",
          "speakers",
        );
        /* Recordings, over the forms that were kept: the ones on a form
           that went are already counted by the line above it. */
        /** @param {Record<string, any>[]} list */
        const clipsIn = (list) =>
          list.reduce(
            (n, f) =>
              n +
              (Array.isArray(f.clips) ? f.clips.length : 0) +
              (Array.isArray(f.slowClips) ? f.slowClips.length : 0),
            0,
          );
        note(
          clipsIn(sentForms.slice(0, fields.forms.length)),
          clipsIn(fields.forms),
          "recording",
          "recordings",
        );
        /** @param {Record<string, any>[]} list */
        const imagesIn = (list) =>
          list.reduce((n, f) => n + (Array.isArray(f.images) ? f.images.length : 0), 0);
        note(
          imagesIn(sentForms.slice(0, fields.forms.length)),
          imagesIn(fields.forms),
          "image",
          "images",
        );
        /* And a word cut off at the end of a field, which is the one that
           does not read as a count. */
        const longest = (/** @type {Record<string, any>[]} */ list) =>
          list.reduce(
            (n, f) => Math.max(n, ...["ar", "en", "lat"].map((k) => String(f[k] || "").length)),
            0,
          );
        if (longest(sentForms) > longest(fields.forms)) cut.push("the end of a long field");
        return cut;
      };
      const trimmed = trimmedOf();

      /* What each accepted answer is, one entry per answer.
         Read through answersOf rather than trusted as sent, so a client
         that omits it — an older build, or a card pasted in — still stores
         the answers its delimited fields describe, and one that sends
         something odd stores what the language will actually accept. The
         `ar` and `lat` strings stay beside it: they are what the wire and
         every export have always carried, and what a client on the old
         build still reads. */
      /** @param {Record<string, any>} form */
      function storedAnswers(form) {
        return answersOf(form, answerFields())
          .slice(0, 12)
          /* An answer's recordings go through the same sieve a form's do:
             a name a clip cannot have is a name nothing can fetch, and
             twelve is the cap either way. Dropped rather than refused,
             like every other narrowing here — and a list left empty is
             left out, because an answer nobody recorded should store
             nothing rather than two empty arrays that ride along through
             every save from here on. */
          .map(({ at: _at, clips, slowClips, ...answer }) => {
            const made = clipList(clips);
            const slow = clipList(slowClips);
            return {
              ...answer,
              ...(made.length ? { clips: made } : {}),
              ...(slow.length ? { slowClips: slow } : {}),
            };
          });
      }

      /* Where a sub-form sits in its card's verb table, when it sits in one.
         Both halves or neither: one without the other places nothing, and a
         form carrying half a position would read as a cell of a row with no
         column. Which rows and columns exist is the language's business, so
         nothing is checked against a list here — only that what comes back
         is the shape a pack can name, which is the shape of an id.

         Spread into the sub-form, so a form that is not a cell gains no
         fields at all rather than two empty ones. */
      /** @param {Record<string, any>} form */
      function cellAt(form) {
        const row = idish(form.row);
        const col = idish(form.col);
        /* And whose table it is a cell of: a form's name, or nothing at all
           for the card's own word. A word's plural takes the same pronouns
           on its end and has a table of its own, so a cell that did not say
           which form it belonged to would be two cells in one place. */
        const of = idish(form.of);
        return row && col ? { row, col, ...(of ? { of } : {}) } : {};
      }

      /* And which tenses a sentence's blanks ask their verbs for, when it
         has narrowed any. Read through the same answer the app reads it
         through — see slotRows in src/verbs.ts, which narrows each row and
         reads an empty list as every tense — so a blank stored here and a
         blank filled on a device cannot come to disagree. The names are
         narrowed like every other name that goes between braces, and the
         whole thing is capped for the reason everything else here is: this
         is written into a document handed to every student in the course.

         Spread into the form, so a form that has narrowed nothing gains no
         field at all rather than an empty map. */
      /** @param {Record<string, any>} form */
      function slotTenses(form) {
        /** @type {Record<string, string[]>} */
        const out = {};
        const said = form && typeof form.tenses === "object" ? form.tenses : null;
        for (const name of Object.keys(said || {}).slice(0, MAX_FILLS)) {
          const slot = slotName(name);
          if (!slot) continue;
          /* Through slotRows, which is what the app reads the list with,
             and then each row narrowed to the shape a pack can name — the
             way a cell's row is above, and for the same reason. Filed
             under the narrowed name on the way in, because that is the
             name the braces in the card's own words are matched on. */
          const one = { tenses: { [slot]: said[name] } };
          const rows = [...new Set(slotRows(one, slot).map(idish))].filter(Boolean).slice(0, 24);
          if (rows.length) out[slot] = rows;
        }
        return Object.keys(out).length ? { tenses: out } : {};
      }

      /* Which blank a sentence's blanks agree with, through the answer the
         app reads it through, every name narrowed like the names between
         braces and the whole capped like the tenses above. */
      /** @param {Record<string, any>} form */
      function slotWish(form) {
        const said = form && form.wish;
        if (!said || typeof said !== "object" || Array.isArray(said)) return {};
        /** @type {Record<string, string>} */
        const out = {};
        for (const [name, who] of Object.entries(said).slice(0, MAX_FILLS)) {
          const slot = slotName(name);
          const col = idish(who);
          if (slot && col) out[slot] = col;
        }
        return Object.keys(out).length ? { wish: out } : {};
      }

      /** @param {unknown} list */
      function storedExamples(list) {
        if (!Array.isArray(list)) return undefined;
        const out = [];
        for (const one of list) {
          if (!one || typeof one !== "object") continue;
          const ex = /** @type {Record<string, unknown>} */ (one);
          const ar = String(ex.ar || "").trim().slice(0, 400);
          const lat = String(ex.lat || "").trim().slice(0, 400);
          const en = String(ex.en || "").trim().slice(0, 400);
          if (!ar && !lat && !en) continue;
          const wish = idish(ex.wish);
          const as = idish(ex.as);
          out.push({ ar, ...(lat ? { lat } : {}), en, ...(wish ? { wish } : {}), ...(as ? { as } : {}) });
          if (out.length >= 3) break;
        }
        return out.length ? out : undefined;
      }

      /** @param {Record<string, any>} form */
      function slotAgrees(form) {
        /** @type {Record<string, string>} */
        const out = {};
        for (const [name, to] of Object.entries(slotLinks(form)).slice(0, MAX_FILLS)) {
          const slot = slotName(name);
          const target = to === NO_PARTNER ? NO_PARTNER : slotName(to);
          if (slot && target && target !== slot) out[slot] = target;
        }
        return Object.keys(out).length ? { agrees: out } : {};
      }

      /*
       * Which of the three kinds of card this one is — taken from the card
       * as it is stored, never from the request.
       *
       * A card is a word, a sentence or a conversation, and that is
       * settled when it is made and never again: it is what a student's
       * whole record hangs on, what every other card's blanks are written
       * against, and the three are asked, dealt and filled in three
       * different ways. The editor asks the question once, while the card
       * is being written and nothing can be lost by any answer — see
       * shapeChoices — and this is the same rule where it cannot be worked
       * around: by a build that has not caught up, by a card pasted in, or
       * by a save queued on a device before the rule existed.
       *
       * Kept rather than refused, because a refusal would lock an older
       * client out of cards it can otherwise edit perfectly well — and
       * because the failure this replaces was silent in the other
       * direction: a client that said nothing about `sentence` turned
       * every sentence it saved into a word.
       *
       * Read through isDialog and isSentence, which are the app's own two
       * answers, so this and the editor cannot come to disagree. Writing
       * the answer out also pins the kind of a card written before there
       * was anything to pin: until then a sentence was recognised by the
       * braces in its words, and taking the braces out made it a word.
       */
      /**
       * @param {Record<string, any>} was @param {Record<string, any>} sent
       * @returns {Record<string, any>}
       */
      function keptKind(was, sent) {
        if (isDialog(was)) {
          /* Its turns are the lesson, so they are the teacher's to edit —
             but never to empty, which is the one edit that would stop it
             being a scene. Whether it is a conversation or a text is the
             teacher's to change, the way a word's subtype is: it moves
             which questions it is asked and leaves every line's progress
             where it was. */
          const lines = sent.lines.length ? sent.lines : was.lines;
          /* And saying nothing about it is not saying "conversation": a
             build from before texts sends no subtype, and must not turn a
             text back into a conversation by saving it. A text has nobody
             in it, whoever sent the speakers. */
          const said = card.sceneKind;
          const text = said === undefined || said === null || said === "" ? isText(was) : said === TEXT;
          return text
            ? {
                sentence: false,
                sceneKind: TEXT,
                speakers: [],
                you: null,
                lines: lines.map((/** @type {Record<string, any>} */ l) => ({ ...l, who: 0 })),
              }
            : { sentence: false, sceneKind: undefined, lines };
        }
        return { sentence: isSentence(was), speakers: [], you: null, lines: [], sceneKind: undefined };
      }

      /* A turn's cast, each entry narrowed to a blank's name and a
         member's, and capped like every other list here. */
      /** @param {Record<string, any>} ln */
      function rolesOf(ln) {
        const said = ln && ln.roles && typeof ln.roles === "object" ? ln.roles : {};
        /** @type {Record<string, string>} */
        const out = {};
        for (const name of Object.keys(said).slice(0, MAX_FILLS)) {
          const slot = slotName(name);
          const member = memberName(said[name]);
          if (slot && member && member !== slot) out[slot] = member;
        }
        return Object.keys(out).length ? { roles: out } : {};
      }

      /* A card's id, cleaned the way a card id is everywhere on this
         document — it is read back as identity. */
      /** @param {unknown} x */
      function cardIdish(x) {
        return String(x || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
      }

      /* The shape an id can take, which is all the server checks of one:
         which rows, columns and forms a card names is the client's
         business, and this only makes sure what comes back is nameable. */
      /** @param {unknown} x */
      function idish(x) {
        return String(x || "")
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "")
          .slice(0, 24);
      }

      /*
       * An ID is the one name that reaches one card, so no two cards may
       * answer to it.
       *
       * The editor refuses a taken name while the teacher is still looking
       * at it, which is where it belongs and where it says something
       * useful. This is the same refusal for the saves that never went
       * through that screen — a stale tab, a queued draft from before the
       * rule, a script — because two cards answering to one `{{x}}` is
       * precisely what an ID exists to prevent, and neither of them can be
       * pointed at afterwards.
       *
       * Only when the name is new or has changed, so an ordinary save
       * costs nothing: an ID is typed once and read a hundred times, and
       * this is the once. A collision already on disk is left alone and
       * read exactly as it always was — this refuses the making of one,
       * not the having of one.
       */
      if (answersTo && answersTo !== cardRef(existing || {})) {
        const owner = (existing && existing.owner) || mine;
        const ids = (await readJson(store, K.myCards(owner))) || [];
        const rows = await readManyJson(store, ids.map((/** @type {string} */ x) => K.card(x)), EVENTUAL);
        const clash = rows.find((/** @type {any} */ c) => c && c.id !== id && cardRef(c) === answersTo);
        if (clash) return json({ error: "ref-taken", ref: answersTo }, 409);
      }

      if (existing) {
        /* created is whatever it already was. A card saved before this
           field existed has none, and must not acquire today's date by
           being edited — the reader falls back to `updated`, which for a
           card never edited is exactly when it was made and for one that
           has been is at least an upper bound. */
        /* And the shape a card was stored in before 0.138 goes, rather
           than being left underneath the new one. The word used to live on
           the card with its other forms in `subs` beside it; `fields`
           writes one `forms` list and said nothing about the old fields,
           so spreading `existing` first kept a stale copy of the word, its
           recordings and its answers on every card ever written — for
           ever, on the wire as well as on disk. Two shapes for one card is
           what 0.138 set out to remove, and a reader that picks the wrong
           half is not a hypothetical: the card editor read the word off
           the card until this release. JSON drops an undefined. */
        /** @param {Record<string, any>} on @param {Record<string, any>} f */
        const written = (on, f) => ({ ...on, ...RETIRED_CARD_FIELDS, ...f, ...keptKind(on, f) });
        /** A rename or a tag taken off the collection, on one version. */
        /** @param {Record<string, any>} one */
        const walked = (one) => {
          let out = one;
          for (const r of Array.isArray(walk && walk.renames) ? walk.renames : []) {
            out = renamedIn(out, String((r && r.from) || ""), String((r && r.to) || "")) || out;
          }
          for (const name of Array.isArray(walk && walk.drops) ? walk.drops : []) {
            out = droppedIn(out, String(name || "")) || out;
          }
          return out;
        };
        const { pending: was, ...live } = existing;
        /** What students will have after this save. */
        /** @type {Record<string, any>} */
        let nextLive;
        /** And the unpublished changes, where the card keeps any. */
        /** @type {Record<string, any> | null} */
        let nextWork = null;
        if (walk) {
          nextLive = walked(live);
          nextWork = was ? walked(withVersion(live, was.card || {})) : null;
        } else if (!isPublished(existing)) {
          /* Never published: the card is its own draft, and is written as
             any card always was. */
          nextLive = written(live, fields);
          if (asked) nextLive.status = asked;
        } else if (intoChanges) {
          /* The card screen, on a published card. The header is the one
             part of it that is not a version — see VERSIONED_KEYS — so it
             goes to the card itself; the rest waits in the changes. */
          nextLive = { ...live, fills: fields.fills, ref: fields.ref };
          nextWork = written(base || live, fields);
        } else {
          /* Anything else writes what students have, as it always did. */
          nextLive = written(live, touched ? fieldsFor({ ...live, ...pick(sent) }) : fields);
          if (was) {
            /* And the same change into the changes, so that publishing
               them later does not undo it. Where the sender named what it
               changed, that is laid over the changes; where it sent the
               whole card, whatever moved on the published card moves in
               the changes too. */
            const after = versionOf(nextLive);
            const before = versionOf(live);
            const moved = VERSIONED_KEYS.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
            nextWork = touched
              ? written(base || live, fields)
              : withVersion(base || live, Object.fromEntries(moved.map((k) => [k, after[k]])));
          }
        }
        saved = {
          ...nextLive,
          /* Undefined where the changes come to nothing — the teacher put
             back what students have — so a card with nothing waiting says
             so. JSON drops it. */
          pending: nextWork && !sameVersion(nextLive, nextWork)
            ? {
                status: asked || (was && was.status) || "draft",
                card: versionOf(nextWork),
                updated: Date.now(),
                by: mine,
              }
            : undefined,
          rev: (existing.rev || 1) + 1,
          /* Its org, whatever the rebuild above kept: a card that lost it
             would fall back into Main. */
          ...(existing.org ? { org: existing.org } : {}),
          updated: Date.now(),
        };
      } else {
        const newId = `k${randomBytes(6).toString("hex")}`;
        const now = Date.now();
        if (body.personal === true && !iManage && !(await everyCourse(store)).some((c) => isTeacher(c, mine))) {
          return json({ error: "not-teaching" }, 403);
        }
        saved = {
          id: newId,
          org: acting,
          /* Personal or not is decided here, once (0.545). */
          ...(body.personal === true ? { personal: true } : {}),
          owner: mine,
          ...fields,
          /* The card screen makes every card a draft, and an import makes
             it Ready for review: nobody sees it until it is published. A
             card made anywhere else — the Pronouns screen, a split, an
             older build — is published as it always was. */
          ...(asked ? { status: asked } : {}),
          rev: 1,
          created: now,
          updated: now,
        };
        /* Added to whatever the list holds when the write lands. Read and
           written whole, two cards made at once cost one of them its place
           in it — and a card missing from here is a card that is on disk
           and in nobody's collection. */
        await updateJson(store, K.myCards(mine), (list) => (list || []).concat([newId]));
      }
      /* Save and publish: what was just written goes out to students in
         the same step, as card-status "published" would put it — a draft
         loses its status, and changes waiting on a published card become
         the card. One request rather than a save and then a status, so a
         save kept on a device offline is published when it goes up, and a
         dropped connection cannot leave it saved but not out. A walk is
         another card's rename reaching this one, and publishes nothing. */
      if (body.publish === true && !walk) {
        const { pending: waiting, ...out } = saved;
        saved = waiting ? withVersion(out, waiting.card || {}) : out;
        delete saved.status;
      }

      /* Which decks it belongs to travels with the card. Older clients sent
         this as deckIds, so both names are honoured rather than silently
         leaving the card in no deck at all. */
      const wantedDecks = Array.isArray(body.decks)
        ? body.decks
        : Array.isArray(body.deckIds)
        ? body.deckIds
        : null;

      /* Only the decks that gain or lose the card are read and written. A
         deck that keeps it is still bumped when the card's content changed,
         so the version a student's device compares against moves too. */
      /*
       * Membership as a change, not a list (0.580, audit finding 11).
       *
       * A screen that sends `decksWere` — the decks it believed the card
       * was in — is saying what it added and what it took away. That is
       * laid over the decks the card is in now, read again here, so a
       * screen that was out of date does not put back a deck somebody else
       * removed or take away one they added. Without it, the list sent is
       * the list, as older builds expect.
       */
      const decksWere = Array.isArray(body.decksWere) ? body.decksWere.map(String) : null;
      const takesDecks = wantedDecks && !(touched && !touched.includes("decks")) && !walk;
      if (takesDecks && decksWere && id) {
        const now = await loadCard(id);
        if (now) current = await decksHolding(now);
      }
      const wanted = takesDecks
        ? decksWere
          ? (() => {
              const asked = new Set(wantedDecks.map(String));
              const were = new Set(decksWere);
              const add = [...asked].filter((x) => !were.has(x));
              const remove = new Set([...were].filter((x) => !asked.has(x)));
              return new Set([...current, ...add].filter((x) => !remove.has(x)));
            })()
          : new Set(wantedDecks)
        : new Set(current);
      /* Whether what students have of this card moved, which is what makes
         their devices fetch it again. A change to a draft, or to a
         published card's unpublished changes, moves nothing of theirs. */
      const liveMoved = seenByStudents(existing || { status: "draft" }) !== seenByStudents(saved);
      const reached = new Set([...current, ...wanted]);
      /** @type {string[]} */
      const final = [];
      const deckRecords = [];
      /** @type {{ id: string, title: string }[]} */
      const refusedLocked = [];
      for (const did of reached) {
        const d = await readDeck(store, did);
        if (!d) continue;
        const has = current.includes(did);
        const want = wanted.has(did);
        if (want !== has && !(await mayEditDeck(d))) {
          /* Not this person's deck to change: leave it as it was. */
          if (has) final.push(did);
          continue;
        }
        /* A personal card stays in My space (0.545): never into a deck of
           the space — that is what copying a deck is for. */
        if (want && !has && saved.personal && !d.personal) continue;
        /* A locked deck's cards stay as they are, whoever asks. Left as it
           was and named in the answer, so a save queued offline before the
           lock still lands its words and the teacher is told which deck
           did not take the change. */
        if (want !== has && d.locked && DECK_LOCKS) {
          if (has) final.push(did);
          refusedLocked.push({ id: d.id, title: d.title });
          continue;
        }
        const ids = await deckCardIds(d);
        const next = want
          ? ids.includes(saved.id)
            ? ids
            : ids.concat([saved.id])
          : ids.filter((x) => x !== saved.id);
        if (want) final.push(did);
        const changedMembership = next.length !== ids.length;
        if (!changedMembership && !(id && liveMoved)) continue;
        /*
         * This one card in or out of whatever the deck holds when the
         * write lands, rather than a whole list worked out beforehand.
         *
         * Two teachers filing cards into one deck at the same moment each
         * read its membership, each added their own card to the copy they
         * held, and the second wrote over the first: a card saved, stored,
         * and in no deck. The card being saved is the only one this
         * request has anything to say about, so it is the only one the
         * write changes.
         */
        const record = await updateJson(store, K.deck(did), (fresh) => {
          /* A deck deleted while this save ran stays deleted: writing it
             back from the copy read above would bring it back with no
             place in the index (0.580). */
          if (!fresh) return null;
          const base = fresh;
          const held = Array.isArray(base.cardIds) && base.cardIds.length ? base.cardIds : ids;
          const now = want
            ? held.includes(saved.id) ? held : held.concat([saved.id])
            : held.filter((/** @type {string} */ x) => x !== saved.id);
          return {
            ...base,
            cardIds: now,
            cardCount: now.length,
            version: (base.version || 1) + 1,
            updated: Date.now(),
          };
        });
        if (record) deckRecords.push(record);
        else if (want) final.splice(final.indexOf(did), 1);
      }
      /*
       * A turn picked from a sentence card carries that sentence's words,
       * as they are now.
       *
       * The editor copied them when the teacher picked it, and copies them
       * again whenever the scene is opened; this is the same step where it
       * cannot be skipped, so what is stored is never older than the save.
       * A sentence that has gone, or that is no longer a sentence, leaves
       * the turn as the words it last had, typed into the scene — which is
       * what it now is — and reviewed with the scene's own turns.
       */
      /* Each version from the sentence's own version: what students have
         from what students have of it, and the changes from what the
         teacher sees of it. A sentence nobody has published yet is left
         where it was on the published scene rather than cut loose from it
         — it is coming, and the turn should follow it when it does. */
      /**
       * @param {Record<string, any>} one
       * @param {boolean} published
       */
      const refreshLines = async (one, published) => {
        let lines = linesOf(one);
        if (lines.some((l) => pickedFrom(l))) {
          const ids = [...new Set(lines.map((l) => pickedFrom(l)).filter(Boolean))];
          const rows = await readManyJson(store, ids.map((x) => K.card(x)), EVENTUAL);
          /** @type {Map<string, any>} */
          const sources = new Map();
          /** @type {Set<string>} */
          const coming = new Set();
          ids.forEach((x, i) => {
            const row = rows[i];
            const c = row && (published ? row : workingOf(row));
            if (!c || isDialog(c) || !isSentence(c)) return;
            if (published && !isPublished(row)) coming.add(x);
            else sources.set(x, c);
          });
          lines = lines.map((l) => {
            const from = pickedFrom(l);
            if (!from || coming.has(from)) return l;
            const source = sources.get(from);
            if (!source) {
              const { from: _gone, ...typed } = l;
              return typed;
            }
            return pickedLine(l, source);
          });
        }
        /* And the cast kept only for blanks each turn actually has, now
           that its words are final. */
        if (lines.some((l) => l.roles)) {
          lines = lines.map((l) => {
            const { roles: _was, ...rest } = /** @type {any} */ (l);
            const roles = cleanRoles(l);
            return roles ? { ...rest, roles } : rest;
          });
        }
        return lines;
      };
      if (linesOf(saved).length) saved.lines = await refreshLines(saved, isPublished(saved));
      if (saved.pending && Array.isArray(saved.pending.card.lines) && saved.pending.card.lines.length) {
        const lines = await refreshLines(withVersion(saved, saved.pending.card), false);
        saved.pending = { ...saved.pending, card: { ...saved.pending.card, lines } };
      }

      /*
       * A sentence nobody has read is not shown.
       *
       * A card that makes sentences — a frame with blanks, a verb's own
       * sentence, a conversation with a blank in a turn — starts with an
       * empty review when it is made, and a card from before review existed
       * gets one the first time the words it is filled into change: the
       * sentences it makes then are new sentences, and wait for a teacher
       * exactly as a new card's do. See review.ts.
       *
       * Only ever started here, never cleared or filled: what a teacher
       * approved is theirs to change, through review-card. Approval is kept
       * as fingerprints of the words shown, so an edit needs nothing done
       * to a review that exists — the changed sentences are simply not on
       * it. A card that makes no sentences is left without one.
       */
      /* Asked of the version the teacher works on: the review is one list
         for both versions — an approval is of the words shown, whichever
         version shows them — and the changes are where new sentences are
         written. */
      if (!reviewOf(saved) && holedParts(workingOf(saved)).length) {
        const framed = (/** @type {any} */ c) =>
          JSON.stringify(holedParts(c).map((f) => [f.ar, f.lat, f.en, f.tenses || null, f.row || "", f.agrees || null]));
        if (!existing || framed(workingOf(existing)) !== framed(workingOf(saved))) {
          saved.review = { ok: [], no: [], at: Date.now(), by: mine };
        }
      }
      saved.inDecks = final;
      /*
       * Two saves of one card at once keep both edits (0.580, audit
       * findings 4 and 11).
       *
       * `saved` was worked out from the card as this request read it. If
       * the card moved since — another tab, another teacher, a status
       * change — only what this request changed is laid over the card as
       * it stands now, field by top-level field. Two people changing the
       * same field at the same moment still leaves the later one's; see
       * DECISIONS.md. The decks are this request's change to the card's
       * membership laid over the membership it has now.
       */
      const before = existing;
      const decksAdded = final.filter((x) => !current.includes(x));
      const decksRemoved = current.filter((x) => !final.includes(x));
      const wrote = /** @type {Record<string, any>} */ (await updateJson(store, K.card(saved.id), (/** @type {any} */ fresh) => {
        if (!fresh || !before || (fresh.rev || 1) === (before.rev || 1)) return saved;
        /** @type {Record<string, any>} */
        const was = before;
        const changed = Object.keys({ ...was, ...saved }).filter(
          (k) => JSON.stringify(was[k]) !== JSON.stringify(saved[k]),
        );
        /** @type {Record<string, any>} */
        const merged = { ...fresh };
        for (const k of changed) {
          if (saved[k] === undefined) delete merged[k];
          else merged[k] = saved[k];
        }
        merged.rev = (fresh.rev || 1) + 1;
        const held = Array.isArray(fresh.inDecks) ? fresh.inDecks : current;
        merged.inDecks = [...new Set([...held, ...decksAdded])].filter((x) => !decksRemoved.includes(x));
        return merged;
      }));
      saved = wrote;
      /* Through the same answer the bundling uses, so a card that fills a
         blank only by the kind of word it is moves the revision too. */
      /* And a sentence moves it too, because a scene may have picked it:
         the scene's decks are not this card's, and it is this teacher's
         revision that tells their students' devices to fetch the scene's
         lines again. */
      if (liveMoved && (fillsOf(saved).length || wasFilling || isSentence(saved))) await bumpFills(saved.owner || "");
      await taught();
      /* `trimmed` only where something was — an ordinary save says nothing,
         and the client has nothing to report. */
      return json({
        ok: true,
        card: { ...teacherView(saved), decks: saved.inDecks || final },
        /* The screen folds these over the decks it holds, so they say
           which courses hold them the way my-decks does. */
        decks: await withLinks(store, deckRecords),
        ...(trimmed.length ? { trimmed } : {}),
        ...(refusedLocked.length ? { locked: refusedLocked } : {}),
      });
    }

    /*
     * Whether this person may change a card: its owner, an administrator,
     * or a teacher of a course one of its decks is in. The same rule a
     * save is held to, for the actions that change a card without saving
     * its words.
     */
    /** @param {Card} card */
    async function mayEditCard(card) {
      if (!card) return false;
      if (card.owner === mine || iManage) return true;
      for (const did of await decksHolding(card)) {
        if (await canEditDeck(store, await readDeck(store, did), mine, iManage)) return true;
      }
      return false;
    }

    /*
     * A teacher's say on the sentences a card makes.
     *
     * `ok` are fingerprints approved, `no` are fingerprints struck, and
     * `clear` are ones to forget either way — see review.ts. Merged into
     * what the card already carries rather than replacing it, so two
     * teachers working through one card at once each keep what they did,
     * and a report struck from the reports list does not undo a review
     * somebody else has open.
     *
     * A card's words are not touched and its revision does not move — a
     * review is not an edit, and a report filed against the card still
     * reads as being about the card as it stands. The decks holding it do
     * move, because that is what tells a student's device to fetch.
     */
    if (action === "review-card") {
      const id = String(body.cardId || "").replace(/[^A-Za-z0-9_-]/g, "");
      const card = id ? await loadCard(id) : null;
      if (!card) return json({ error: "no-card" }, 404);
      if (!(await mayEditCard(card))) return json({ error: "not-yours" }, 403);
      /** @param {unknown} list */
      const keysIn = (list) => (Array.isArray(list) ? list : []).filter(isSentenceKey).slice(0, MAX_REVIEWED);
      const ok = keysIn(body.ok);
      const no = keysIn(body.no);
      const clear = keysIn(body.clear);
      const next = await updateJson(store, K.card(id), (/** @type {any} */ c) => {
        if (!c) return null;
        const was = reviewOf(c) || {};
        const okSet = new Set(Array.isArray(was.ok) ? was.ok : []);
        const noSet = new Set(Array.isArray(was.no) ? was.no : []);
        for (const k of clear) {
          okSet.delete(k);
          noSet.delete(k);
        }
        for (const k of ok) {
          noSet.delete(k);
          okSet.delete(k);
          okSet.add(k);
        }
        for (const k of no) {
          okSet.delete(k);
          noSet.delete(k);
          noSet.add(k);
        }
        /* Newest kept where a list outgrows the cap: fingerprints of
           sentences a frame no longer makes are what falls off first, and
           losing one of those costs nothing. */
        return {
          ...c,
          review: {
            ok: [...okSet].slice(-MAX_REVIEWED),
            no: [...noSet].slice(-MAX_REVIEWED),
            at: Date.now(),
            by: mine,
          },
        };
      });
      const holding = await decksHolding(next || card);
      for (const did of holding) {
        await updateJson(store, K.deck(did), (/** @type {any} */ d) =>
          d ? { ...d, version: (d.version || 1) + 1, updated: Date.now() } : null,
        );
      }
      /* A sentence's review is also the review of every scene turn picked
         from it, and those scenes are in other decks — so its teacher's
         revision moves, as it does when the sentence is saved. */
      if (isSentence(next || card)) await bumpFills((next || card).owner || "");
      await taught();
      return json({ ok: true, card: { ...teacherView(next || card), decks: holding } });
    }

    /*
     * A card's status: Draft, Ready for review, or Published — and, on a
     * published card, the status of its unpublished changes.
     *
     * `to` is one of:
     *   draft, review   the card's status, or its changes' where it is
     *                   published and has some
     *   published       publish the card, or publish its changes over
     *                   what students have
     *   discard         throw the changes away; students' card stands
     *   unpublish       take the card away from students. What the
     *                   teacher was working on is kept, as a draft —
     *                   their changes where there were any — and every
     *                   student's progress on it is set aside on their
     *                   device the way a withdrawn card's is, and comes
     *                   back if it is published again.
     *
     * Whoever may change the card may do any of these, including publish
     * their own changes: "Ready for review" changes nothing yet but what
     * the card says about itself.
     */
    if (action === "card-status") {
      const id = String(body.cardId || "").replace(/[^A-Za-z0-9_-]/g, "");
      const to = String(body.to || "");
      const card = id ? await loadCard(id) : null;
      if (!card) return json({ error: "no-card" }, 404);
      if (!(await mayEditCard(card))) return json({ error: "not-yours" }, 403);
      if (![...CARD_STATUSES, "discard", "unpublish"].includes(to)) return json({ error: "bad-status" }, 400);
      /* Worked out from the card as it stands when the write lands, not as
         it was read above, so a save that landed in between keeps its
         words (0.580, audit finding 11). */
      /**
       * @param {any} c
       * @returns {{ error: string } | { next: Record<string, any> }}
       */
      const statusOf = (c) => {
        /** @type {Record<string, any>} */
        let next;
        const { pending, ...live } = c;
        if (!isPublished(c)) {
          if (to === "discard" || to === "unpublish") return { error: "not-published" };
          next = to === "published" ? { ...live, status: undefined } : { ...live, status: to };
        } else if (to === "unpublish") {
          next = { ...workingOf(c), status: pending && pending.status === "review" ? "review" : "draft" };
        } else if (!pending) {
          if (to !== "published") return { error: "no-changes" };
          next = c;
        } else if (to === "discard") {
          next = live;
        } else if (to === "published") {
          next = withVersion(live, pending.card || {});
        } else {
          next = { ...c, pending: { ...pending, status: to } };
        }
        return { next: { ...next, rev: (c.rev || 1) + 1, updated: Date.now() } };
      };
      const first = statusOf(card);
      if ("error" in first) return json({ error: first.error }, 400);
      /** @type {any} */
      let was = card;
      /** @type {string | null} */
      let refused = null;
      const next = /** @type {Record<string, any>} */ (await updateJson(store, K.card(id), (/** @type {any} */ fresh) => {
        if (!fresh) {
          refused = "no-card";
          return null;
        }
        const c = fresh;
        const r = statusOf(c);
        was = c;
        if ("error" in r) {
          refused = r.error;
          return null;
        }
        refused = null;
        return r.next;
      }));
      if (refused) return json({ error: refused }, refused === "no-card" ? 404 : 400);
      const holding = await decksHolding(was);
      if (seenByStudents(was) !== seenByStudents(next)) {
        for (const did of holding) {
          await updateJson(store, K.deck(did), (/** @type {any} */ d) =>
            d ? { ...d, version: (d.version || 1) + 1, updated: Date.now() } : null,
          );
        }
        if (fillsOf(was).length || fillsOf(next).length || isSentence(was) || isSentence(next)) {
          await bumpFills(next.owner || "");
        }
      }
      await taught();
      return json({ ok: true, card: { ...teacherView(next), decks: holding } });
    }

    /*
     * The reports learners have sent, for an administrator working in the
     * teaching space — with the card, so the screen can open its review
     * without a second request, and with what has become of it since, the
     * way the administrator's list says.
     *
     * From 0.246 to 0.411 these went to every teacher who could change the
     * card. The owner asked in 0.412 for reports to be the administrator's
     * alone: a report is a learner's word about the course, sometimes about
     * its teacher. Anyone else gets an empty list rather than a refusal, so
     * an older build still on a teacher's device simply shows none.
     */
    if (action === "my-reports") {
      if (!iManage) return json({ ok: true, flags: [], cards: [] });
      const flagIds = await readIndex(store, "flags");
      const rows = here(await readManyJson(store, flagIds.map((x) => K.flag(x)))).filter(Boolean);
      /** @type {Map<string, any>} */
      const cardsById = new Map();
      /** @type {Map<string, boolean>} */
      const allowed = new Map();
      const out = [];
      for (const f of rows) {
        const cid = cardIdOf(f.cardId);
        if (!cid) continue;
        if (!cardsById.has(cid)) cardsById.set(cid, await loadCard(cid));
        const card = cardsById.get(cid);
        if (!allowed.has(cid)) {
          let may = card ? await mayEditCard(card) : false;
          if (!may && !card && f.deckId) {
            may = await canEditDeck(store, await readDeck(store, String(f.deckId)), mine, iManage);
          }
          allowed.set(cid, may);
        }
        if (!allowed.get(cid)) continue;
        const cardState = !card ? "gone" : (card.rev || 1) > (f.cardRev || 0) && f.cardRev ? "edited" : "here";
        out.push({ ...f, cardId: cid, cardState });
      }
      const cards = [...cardsById.entries()]
        .filter(([cid, c]) => c && allowed.get(cid))
        .map(([, c]) => c);
      return json({ ok: true, flags: out.reverse(), cards });
    }

    /* A report read and dealt with, from the teaching space. Only an
       administrator's dismissal counts — see my-reports. The Flags list
       loses it too: there is one report, and it has been answered. */
    if (action === "dismiss-reports") {
      if (!iManage) return json({ ok: true, deleted: 0 });
      const wanted = new Set((Array.isArray(body.flagIds) ? body.flagIds : []).map(String).slice(0, 100));
      if (!wanted.size) return json({ ok: true, deleted: 0 });
      const ids = await readIndex(store, "flags");
      /** @type {string[]} */
      const gone = [];
      for (const fid of ids) {
        if (!wanted.has(fid)) continue;
        const f = await readJson(store, K.flag(fid));
        if (!f || !inScope(f)) continue;
        const card = await loadCard(cardIdOf(f.cardId));
        const may = card
          ? await mayEditCard(card)
          : !!f.deckId && (await canEditDeck(store, await readDeck(store, String(f.deckId)), mine, iManage));
        if (!may) continue;
        await store.delete(K.flag(fid)).catch(() => {});
        gone.push(fid);
      }
      if (gone.length) {
        await updateJson(store, K.index("flags"), (/** @type {any} */ list) =>
          (list || []).filter((/** @type {string} */ x) => !gone.includes(x)),
        );
      }
      return json({ ok: true, deleted: gone.length });
    }

    if (action === "delete-cards") {
      const ids = (Array.isArray(body.cardIds) ? body.cardIds : [])
        .map((/** @type {unknown} */ x) => String(x || ""))
        .filter(Boolean)
        .slice(0, 100);
      if (!ids.length) return json({ error: "no-card" }, 400);
      const result = await deleteCards(ids);
      if (result.deleted.length) await taught();
      return json({ ok: true, ...result });
    }

    if (action === "delete-card") {
      const id = String(body.cardId || "");
      const result = await deleteCards([id]);
      if (result.missing.length) return json({ error: "no-card" }, 404);
      if (result.refused.length) return json({ error: "not-yours" }, 403);
      await taught();
      return json({ ok: true });
    }

    if (action === "my-decks") {
      const ids = await readIndex(store, "decks");
      const rows = here(await readManyJson(store, ids.map((id) => K.deck(id)))).filter(Boolean);

      /* Mine, plus every deck in a course I teach — those are mine to work on
         too, and hiding them meant a co-teacher could not find the material
         they had been brought in to look after. */
      const courses = await everyCourse(store);
      const teaching = new Set(courses.filter((c) => isTeacher(c, mine)).flatMap((c) => c.decks || []));

      /* With the courses that hold each one read off those courses, which
         is what the course screen, Manage decks and a deck's settings all
         show — see linksOf. */
      const shown = rows.filter((d) => d.owner === mine || teaching.has(d.id) || (iManage && !d.personal));
      /* And which of its number parts reach nobody yet — see partsWaiting. */
      const waiting = await partsWaiting(shown, courses);
      const decks = shown.map((d) => ({
        ...d,
        courses: linksOf(d, courses),
        cardCount: (d.cardIds || []).length,
        mine: d.owner === mine,
        ...(waiting.has(d.id) ? { partsWaiting: waiting.get(d.id) } : null),
      }));
      return jsonTagged(req, { ok: true, decks });
    }

    if (action === "rename-deck") {
      const deck = await readDeck(store, String(body.deckId || ""));
      if (!deck) return json({ error: "no-deck" }, 404);
      if (!(await canEditDeck(store, deck, mine, iManage)))
        return json({ error: "not-yours" }, 403);
      const title = String(body.title || "").trim().slice(0, 60);
      if (!title) return json({ error: "title-required" }, 400);
      /* The title onto the deck as it is now, not onto the copy read above:
         written whole, that copy undid whatever landed in between — a card
         filed into it, a course it was added to. The same for every change
         to a deck below. */
      await updateJson(store, K.deck(deck.id), (/** @type {Deck | null} */ fresh) =>
        fresh ? { ...fresh, title, updated: Date.now() } : null
      );
      await taught();
      return json({ ok: true, title });
    }

    /*
     * Locking a deck: its cards stay exactly the ones it has until it is
     * unlocked. Anyone who may change the deck may lock or unlock it.
     * What the cards say is not locked — only which cards are in it.
     */
    if (action === "lock-deck") {
      const deck = await readDeck(store, String(body.deckId || ""));
      if (!deck) return json({ error: "no-deck" }, 404);
      if (!(await canEditDeck(store, deck, mine, iManage)))
        return json({ error: "not-yours" }, 403);
      const locked = !!body.locked;
      await updateJson(store, K.deck(deck.id), (/** @type {Deck | null} */ fresh) => {
        if (!fresh) return null;
        const { locked: _was, ...rest } = fresh;
        return { ...(locked ? { ...rest, locked: true } : rest), updated: Date.now() };
      });
      await taught();
      return json({ ok: true, locked });
    }

    /*
     * Which parts of the teacher's numbers a deck holds — 0 to 10, counting
     * things 3 to 10, telling the hour — by the range's id.
     *
     * Numbers are one document per language and not cards, so a deck
     * cannot list them the way it lists its cards: it names the parts, and
     * each student's device files the matching skill and the words it is
     * built of under the deck. A part in no deck reaches nobody. Locked
     * like the cards are, because it is the same question: what the deck
     * holds.
     */
    if (action === "set-deck-parts") {
      const deck = await readDeck(store, String(body.deckId || ""));
      if (!deck) return json({ error: "no-deck" }, 404);
      if (!(await canEditDeck(store, deck, mine, iManage)))
        return json({ error: "not-yours" }, 403);
      if (deck.locked && DECK_LOCKS) return json({ error: "deck-locked" }, 409);
      const asked = Array.isArray(body.parts) ? body.parts : [];
      const parts = [
        ...new Set(
          asked
            .map((/** @type {unknown} */ p) => String(p || "").trim())
            .filter((/** @type {string} */ p) => /^(numbers|time):[a-z0-9+-]{1,40}$/.test(p))
        ),
      ].slice(0, 50);
      const next = await updateJson(store, K.deck(deck.id), (/** @type {Deck | null} */ fresh) => {
        if (!fresh) return null;
        const { parts: _was, ...rest } = fresh;
        return { ...rest, ...(parts.length ? { parts } : null), updated: Date.now() };
      });
      await taught();
      /* And which of them reach nobody yet, so the deck can say so at once. */
      const waiting = next ? (await partsWaiting([next], await everyCourse(store))).get(next.id) : null;
      return json({ ok: true, parts, partsWaiting: waiting || [] });
    }

    /*
     * Whose numbers a deck uses (0.541).
     *
     * A deck holding number parts is filled from one person's numbers and
     * clock: its own choice, or its owner's. number-sources lists who may be
     * chosen — the owner and every teacher with a number system in the
     * deck's language — and set-deck-numbers records the choice.
     */
    async function numberSources(/** @type {Deck} */ deck) {
      const courses = await everyCourse(store);
      const holding = courses.filter((c) => (c.decks || []).includes(deck.id));
      const lang = deck.lang || (holding[0] && holding[0].language) || "";
      const handles = [...new Set([deck.owner].concat(courses.flatMap((c) => c.teachers || [])).filter(Boolean))];
      const out = [];
      for (const h of handles) {
        const index = await systemIndex(h);
        if (!index.numbers[lang]) continue;
        const u = await readUser(store, h);
        out.push({ handle: h, displayName: (u && u.displayName) || h, numbers: true, times: !!index.times[lang] });
      }
      const owner = out.filter((x) => x.handle === deck.owner);
      const rest = out.filter((x) => x.handle !== deck.owner).sort((a, b) => a.displayName.localeCompare(b.displayName));
      return owner.concat(rest);
    }

    if (action === "number-sources") {
      const deck = await readDeck(store, url.searchParams.get("deck") || "");
      if (!deck) return json({ error: "no-deck" }, 404);
      if (!(await canEditDeck(store, deck, mine, iManage))) return json({ error: "not-yours" }, 403);
      return json({ ok: true, sources: await numberSources(deck), chosen: deck.numbersFrom || deck.owner });
    }

    if (action === "set-deck-numbers") {
      const deck = await readDeck(store, String(body.deckId || ""));
      if (!deck) return json({ error: "no-deck" }, 404);
      if (!(await canEditDeck(store, deck, mine, iManage))) return json({ error: "not-yours" }, 403);
      const from = String(body.from || "");
      if (!(await numberSources(deck)).some((x) => x.handle === from)) return json({ error: "bad-source" }, 400);
      const next = await updateJson(store, K.deck(deck.id), (/** @type {Deck | null} */ fresh) => {
        if (!fresh) return null;
        const { numbersFrom: _was, ...rest } = /** @type {any} */ (fresh);
        return {
          ...rest,
          ...(from === fresh.owner ? null : { numbersFrom: from }),
          version: (fresh.version || 1) + 1,
          updated: Date.now(),
        };
      });
      await taught();
      const waiting = next ? (await partsWaiting([next], await everyCourse(store))).get(next.id) : null;
      return json({ ok: true, numbersFrom: from, partsWaiting: waiting || [] });
    }

    /* ================= My space (0.545) ================= */

    /* "Practise this myself" on one of your own personal decks (59b). */
    if (action === "set-deck-practise") {
      const deck = await readDeck(store, String(body.deckId || ""));
      if (!deck || !deck.personal || deck.owner !== mine) return json({ error: "not-yours" }, 403);
      const practise = !!body.practise;
      await updateJson(store, K.deck(deck.id), (/** @type {any} */ f) =>
        f ? { ...f, practise, version: (f.version || 1) + 1, updated: Date.now() } : null
      );
      return json({ ok: true, practise });
    }

    /*
     * A My space deck into the space (0.549; 15a, 2a, 9b, 10a): copied —
     * a new deck of the space with copies of your cards, the original kept
     * — or moved — the deck itself and your cards in it become the space's,
     * nothing left behind. Either way it can go straight onto any of the
     * courses you may put decks on. Course cards it borrowed are already
     * the space's and stay as they are.
     */
    if (action === "copy-to-space") {
      const deck = await readDeck(store, String(body.deckId || ""));
      if (!deck || !deck.personal || deck.owner !== mine) return json({ error: "not-yours" }, 403);
      if (!iManage && !(await everyCourse(store)).some((c) => isTeacher(c, mine))) return json({ error: "not-teaching" }, 403);
      const move = body.move === true;
      const courses = (await everyCourse(store)).filter(
        (c) => (Array.isArray(body.courses) ? body.courses.map(String) : []).includes(c.id) && (iManage || isTeacher(c, mine))
      );
      let landed;
      if (move) {
        for (const cid of deck.cardIds || []) {
          await updateJson(store, K.card(cid), (/** @type {any} */ c) => {
            if (!c || !c.personal || c.owner !== mine) return null;
            const { personal: _p, ...rest } = c;
            return { ...rest, updated: Date.now() };
          });
        }
        landed = await updateJson(store, K.deck(deck.id), (/** @type {any} */ d) => {
          if (!d) return null;
          const { personal: _p, practise: _q, ...rest } = d;
          return { ...rest, version: (d.version || 1) + 1, updated: Date.now() };
        });
      } else {
        const newDeck = `d${randomBytes(6).toString("hex")}`;
        /** @type {string[]} */
        const ids = [];
        /** @type {string[]} */
        const madeIds = [];
        for (const cid of deck.cardIds || []) {
          const c = await loadCard(cid);
          if (!c) continue;
          if (!c.personal) {
            ids.push(cid);
            continue;
          }
          const copyId = `k${randomBytes(6).toString("hex")}`;
          const { personal: _p, inDecks: _d, ...rest } = /** @type {any} */ (c);
          await writeJson(store, K.card(copyId), { ...rest, id: copyId, org: acting, owner: mine, rev: 1, inDecks: [newDeck], created: Date.now(), updated: Date.now() });
          ids.push(copyId);
          madeIds.push(copyId);
        }
        if (madeIds.length) await updateJson(store, K.myCards(mine), (/** @type {any} */ cur) => (cur || []).concat(madeIds));
        const { personal: _p, practise: _q, ...deckRest } = /** @type {any} */ (deck);
        landed = {
          ...deckRest, id: newDeck, org: acting, owner: mine, title: String(body.title || deck.title).slice(0, 60),
          courses: [], cardIds: ids, cardCount: ids.length, version: 1, updated: Date.now(),
        };
        await writeJson(store, K.deck(newDeck), landed);
        await updateJson(store, K.index("decks"), (/** @type {any} */ cur) => (cur || []).concat([newDeck]));
      }
      for (const c of courses) {
        /* A path unit goes onto the path as well, as a draft (A1). */
        await updateJson(store, K.course(c.id), (/** @type {any} */ fresh) =>
          fresh && !(fresh.decks || []).includes(landed.id)
            ? { ...fresh, decks: (fresh.decks || []).concat([landed.id]), ...(landed.unit ? { path: (fresh.path || []).concat([landed.id]) } : {}) }
            : null
        );
      }
      await taught();
      return json({ ok: true, deck: landed, courses: courses.map((c) => c.id) });
    }

    /*
     * One My space card into a deck of the space (0.549, 3a): a copy, or the
     * card itself. A moved card stays in any of your My space decks that
     * held it, where it now reads as a borrowed course card.
     */
    if (action === "card-to-space") {
      const card = await loadCard(String(body.cardId || ""));
      if (!card || !card.personal || card.owner !== mine) return json({ error: "not-yours" }, 403);
      const deck = await readDeck(store, String(body.deckId || ""));
      if (!deck || deck.personal || !(await canEditDeck(store, deck, mine, iManage))) return json({ error: "not-yours" }, 403);
      let id = card.id;
      if (body.move === true) {
        await updateJson(store, K.card(card.id), (/** @type {any} */ c) => {
          if (!c) return null;
          const { personal: _p, ...rest } = c;
          return { ...rest, inDecks: [...new Set((c.inDecks || []).concat([deck.id]))], updated: Date.now() };
        });
      } else {
        id = `k${randomBytes(6).toString("hex")}`;
        const { personal: _p, inDecks: _d, ...rest } = /** @type {any} */ (card);
        await writeJson(store, K.card(id), { ...rest, id, org: acting, owner: mine, rev: 1, inDecks: [deck.id], created: Date.now(), updated: Date.now() });
        await updateJson(store, K.myCards(mine), (/** @type {any} */ cur) => (cur || []).concat([id]));
      }
      await updateJson(store, K.deck(deck.id), (/** @type {any} */ d) => {
        if (!d) return null;
        const ids = [...new Set((d.cardIds || []).concat([id]))];
        return { ...d, cardIds: ids, cardCount: ids.length, version: (d.version || 1) + 1, updated: Date.now() };
      });
      await taught();
      return json({ ok: true, cardId: id });
    }

    /* The deck goes; the cards it held stay in the library. A locked deck
       is unlocked first: deleting it is the largest change there is to
       which cards it holds. */
    if (action === "delete-deck") {
      const deck = await readDeck(store, String(body.deckId || ""));
      if (!deck) return json({ error: "no-deck" }, 404);
      if (!(await canEditDeck(store, deck, mine, iManage)))
        return json({ error: "not-yours" }, 403);
      if (deck.locked && DECK_LOCKS) return json({ error: "deck-locked" }, 409);

      await dropFromCourses(store, deck.id);
      await store.delete(K.deck(deck.id)).catch(() => {});
      await store.delete(K.cards(deck.id)).catch(() => {});
      await updateJson(store, K.index("decks"), (/** @type {string[] | null} */ cur) =>
        (cur || []).includes(deck.id) ? (cur || []).filter((x) => x !== deck.id) : null);
      await taught();
      return json({ ok: true });
    }

    /*
     * Adding a deck to a course, and taking it away again.
     *
     * Both records are changed as they stand when the write lands. They
     * used to be read here and written back whole, so two of these at once
     * — or one of these and somebody joining the course — each wrote over
     * the other: a deck taken out came back on the course while the deck
     * itself no longer said so, and students went on being sent what the
     * teacher's screen said was gone. The course first, because it is the
     * one students are sent and the one every screen reads — see linksOf.
     */
    if (action === "attach-deck" || action === "detach-deck") {
      const deck = await readDeck(store, String(body.deckId || ""));
      const course = await readCourse(store, String(body.courseId || ""));
      if (!deck || !course) return json({ error: "not-found" }, 404);
      if (!(await canEditDeck(store, deck, mine, iManage)))
        return json({ error: "not-yours" }, 403);
      if (!isTeacher(course, mine) && !iManage) return json({ error: "not-teaching" }, 403);
      if (deck.personal) return json({ error: "personal-deck" }, 400);

      const adding = action === "attach-deck";
      /* Whether the course held it before this, which decides whether the
         deck's date is a new one: a deck the course already had keeps the
         day it was first added. */
      let held = false;
      const nextCourse = await updateJson(store, K.course(course.id), (/** @type {Course | null} */ fresh) => {
        if (!fresh) return null;
        held = (fresh.decks || []).includes(deck.id);
        if (adding === held) {
          /* A unit the course holds but whose path lost it is put back at
             the end; one taken out leaves nothing of itself on the path. */
          if (deck.unit && adding && !(fresh.path || []).includes(deck.id)) return { ...fresh, path: (fresh.path || []).concat([deck.id]) };
          if (!adding && onPath(fresh, deck.id)) return offPath(fresh, deck.id);
          return null;
        }
        /* A path unit is always on the path of every course it is in (A1),
           and starts there as a draft; taken away, it leaves that course's
           path, publication and opening early, and no other course's. */
        if (adding) {
          const decks = (fresh.decks || []).concat([deck.id]);
          return deck.unit
            ? { ...fresh, decks, path: (fresh.path || []).filter((x) => x !== deck.id).concat([deck.id]) }
            : { ...fresh, decks };
        }
        return offPath({ ...fresh, decks: fresh.decks.filter((d) => d !== deck.id) }, deck.id);
      });
      if (!nextCourse) return json({ error: "not-found" }, 404);
      const now = Date.now();
      const nextDeck = await updateJson(store, K.deck(deck.id), (/** @type {Deck | null} */ fresh) => {
        if (!fresh) return null;
        const others = (fresh.courses || []).filter((l) => l.courseId !== course.id);
        const mineNow = (fresh.courses || []).find((l) => l.courseId === course.id);
        if (!adding) return mineNow ? { ...fresh, courses: others } : null;
        if (mineNow && held) return null;
        /* Held already but not noted on the deck: the day is not known, and
           a guess would be printed as a fact on the course screen. */
        const link = held ? { courseId: course.id } : { courseId: course.id, addedAt: now };
        return { ...fresh, courses: others.concat([link]) };
      });
      if (!nextDeck) return json({ error: "not-found" }, 404);
      await taught();
      const [shown] = await withLinks(store, [nextDeck]);
      return json({ ok: true, deck: shown, course: nextCourse });
    }

    /* ================= a course's path (0.613) =================

       A path unit is a deck with `unit: true`, on the path of every course
       that holds it. Everything about the path is per course — its order,
       which units are published there and which are opened early — and
       every rule is in src/path.ts. Each of these changes the course as it
       stands when the write lands (updateJson), so two teachers at once
       cannot write over each other. */

    /** The course, if this person teaches it or runs the space; else an answer to send. */
    async function pathCourse() {
      const course = await readCourse(store, String(body.courseId || ""));
      if (!course) return { refused: json({ error: "not-found" }, 404) };
      if (!isTeacher(course, mine) && !iManage) return { refused: json({ error: "not-teaching" }, 403) };
      return { course };
    }

    if (action === "create-unit") {
      const { course, refused } = await pathCourse();
      if (refused) return refused;
      const title = String(body.title || "").trim().slice(0, 60);
      if (!title) return json({ error: "title-required" }, 400);
      const id = `d${randomBytes(6).toString("hex")}`;
      const now = Date.now();
      const deck = {
        id,
        org: orgOf(course),
        owner: mine,
        title,
        description: "",
        lang: course.language || "",
        unit: true,
        version: 1,
        courses: [{ courseId: course.id, addedAt: now }],
        cardIds: [],
        updated: now,
      };
      await writeJson(store, K.deck(id), deck);
      await indexAdd(store, "decks", id);
      const next = await updateJson(store, K.course(course.id), (/** @type {Course | null} */ fresh) =>
        fresh ? { ...fresh, decks: (fresh.decks || []).concat([id]), path: (fresh.path || []).concat([id]) } : null
      );
      await taught();
      return json({ ok: true, deck, course: next });
    }

    if (action === "move-unit") {
      const { course, refused } = await pathCourse();
      if (refused) return refused;
      const deckId = String(body.deckId || "");
      if (!(course.path || []).includes(deckId)) return json({ error: "not-on-path" }, 404);
      const to = Math.floor(Number(body.to));
      if (!Number.isFinite(to)) return json({ error: "bad-position" }, 400);
      const next = await updateJson(store, K.course(course.id), (/** @type {Course | null} */ fresh) => {
        if (!fresh || !(fresh.path || []).includes(deckId)) return null;
        const rest = (fresh.path || []).filter((x) => x !== deckId);
        const at = Math.max(0, Math.min(rest.length, to));
        const path = rest.slice(0, at).concat([deckId], rest.slice(at));
        return path.join() === (fresh.path || []).join() ? null : { ...fresh, path };
      });
      await taught();
      return json({ ok: true, course: next || (await readCourse(store, course.id)) });
    }

    if (action === "publish-unit") {
      const { course, refused } = await pathCourse();
      if (refused) return refused;
      const deckId = String(body.deckId || "");
      if (!(course.path || []).includes(deckId)) return json({ error: "not-on-path" }, 404);
      if (isLiveIn(course, deckId)) return json({ ok: true, course });
      const problems = await unitCheck(course, deckId);
      if (problems.length) return json({ error: "unit-not-ready", problems }, 409);
      const next = await updateJson(store, K.course(course.id), (/** @type {Course | null} */ fresh) =>
        fresh && (fresh.path || []).includes(deckId) && !isLiveIn(fresh, deckId)
          ? { ...fresh, pathLive: { ...(fresh.pathLive || {}), [deckId]: Date.now() } }
          : null
      );
      await taught();
      return json({ ok: true, course: next || (await readCourse(store, course.id)) });
    }

    if (action === "open-unit") {
      const { course, refused } = await pathCourse();
      if (refused) return refused;
      const deckId = String(body.deckId || "");
      if (!isLiveIn(course, deckId)) return json({ error: "unit-draft" }, 409);
      const open = body.open === true;
      const next = await updateJson(store, K.course(course.id), (/** @type {Course | null} */ fresh) => {
        if (!fresh) return null;
        const was = fresh.opened || [];
        if (open === was.includes(deckId)) return null;
        const opened = open ? was.concat([deckId]) : was.filter((x) => x !== deckId);
        const { opened: _o, ...rest } = fresh;
        return opened.length ? { ...rest, opened } : rest;
      });
      await taught();
      return json({ ok: true, course: next || (await readCourse(store, course.id)) });
    }

    /**
     * The publishing checklist of one unit in one course, judged on what
     * its students would actually receive: published cards only, as they
     * are sent. What may count toward a blank's five is the cards of this
     * unit and the published units before it here, every card never asked
     * on its own in the libraries of the unit's owner and the course's
     * teachers, and the number values of the parts those units hold — see
     * countingCards in path.ts.
     * @param {Course} course
     * @param {string} deckId
     */
    async function unitCheck(course, deckId) {
      const decks = (await readManyJson(store, (course.path || []).map((id) => K.deck(id)))).filter(Boolean);
      const unitDeck = decks.find((d) => d.id === deckId);
      if (!unitDeck) return [{ kind: "few-sentences", have: 0, need: 5 }];
      const from = drawsFrom(course, decks, deckId);
      /** @type {Map<string, string[]>} */
      const decksOf = new Map();
      for (const d of decks) {
        if (!from.has(d.id)) continue;
        for (const id of await deckCardIds(d)) decksOf.set(id, (decksOf.get(id) || []).concat([d.id]));
      }
      const ids = [...decksOf.keys()];
      const rows = await readManyJson(store, ids.map((id) => K.card(id)));
      /** @type {Map<string, any>} */
      const byId = new Map();
      rows.forEach((c, i) => {
        if (c && inScope(c) && isPublished(c)) byId.set(ids[i], studentView(c));
      });
      const owners = [...new Set([unitDeck.owner, ...(course.teachers || [])])].filter(Boolean);
      for (const owner of owners) {
        /** @type {string[]} */
        const lib = (await readJson(store, K.myCards(owner))) || [];
        const libRows = await readManyJson(store, lib.filter((id) => !byId.has(id)).map((id) => K.card(id)));
        for (const c of libRows) {
          if (c && inScope(c) && isPublished(c) && neverAskedAlone(c) && !byId.has(c.id)) byId.set(c.id, studentView(c));
        }
      }
      const lang = LANGUAGES[/** @type {import("../../src/types.ts").LangId} */ (unitDeck.lang || course.language || "")] || null;
      /* The number values a blank may be filled with, from the system the
         unit's numbers come from — counted with that teacher's nouns, as
         the teacher's own screen counts them. */
      const numLang = unitDeck.lang || course.language || "";
      const numOwner = unitDeck.numbersFrom || unitDeck.owner;
      const index = await systemIndex(numOwner);
      const sysRow = index.numbers[numLang] ? await readJson(store, K.numSys(index.numbers[numLang])) : null;
      const sys = sysRow ? readNumberSystem(sysRow) : null;
      /** @type {any[]} */
      let fillers = [];
      if (sys) {
        /** @type {string[]} */
        const lib = (await readJson(store, K.myCards(numOwner))) || [];
        const nounRows = (await readManyJson(store, lib.map((id) => K.card(id)))).filter((c) => c && inScope(c));
        fillers = fillerCards(composerFor(numLang), withNouns(sys, countedNouns(nounRows, numLang)));
      }
      const all = [...byId.values()];
      const counting = countingCards({
        course, decks, unitId: deckId, cards: all,
        deckIdsOf: (c) => decksOf.get(String(c.id)) || [],
        fillers,
      });
      const own = (await deckCardIds(unitDeck)).map((id) => byId.get(id)).filter(Boolean);
      return unitProblems({ cards: own, counting, lang });
    }

    /* ================= courses ================= */

    if (action === "create-course") {
      if (!iManage) return json({ error: "admin-only" }, 403);
      const title = String(body.title || "").trim().slice(0, 80);
      if (!title) return json({ error: "title-required" }, 400);
      const id = `c${randomBytes(6).toString("hex")}`;
      /* Two codes, because the two invitations are different acts. The
         student code is handed round a class; the teacher code gives
         someone authority over the material and should travel privately. */
      const code = makeCode();
      const teacherCode = makeCode();
      const course = {
        id,
        org: acting,
        title,
        description: String(body.description || "").slice(0, 400),
        /* The language the course teaches. Everything downstream leans on
           this: which script its decks and cards are written in, which
           keyboard the editor offers, how answers are marked. Dropping it
           here made every card default to the first language on the list. */
        language: String(body.language || "").slice(0, 20),
        teachers: [],
        students: [],
        decks: [],
        code,
        teacherCode,
        created: Date.now(),
      };
      await writeJson(store, K.course(id), course);
      await writeJson(store, K.code(code), id);
      await writeJson(store, K.code(teacherCode), id);
      await indexAdd(store, "courses", id);
      return json({ ok: true, course });
    }

    /*
     * A course's switches (0.627): which exercises its students are asked —
     * see src/course-practice.ts. One record on the course, `practice`,
     * written whole by the course page and never taken away once set: a
     * course going back to With translation keeps one saying so, which is
     * what keeps every student's cards where they stood (see standingKeys in
     * the app). No other write to a course touches it — each of them spreads
     * the course as it stands — and it is in the material version, so
     * students' devices fetch it when it changes.
     */
    if (action === "set-course-practice") {
      const course = await readCourse(store, String(body.courseId || ""));
      if (!course) return json({ error: "not-found" }, 404);
      if (!isTeacher(course, mine) && !iManage) return json({ error: "not-teaching" }, 403);
      const raw = body.practice && typeof body.practice === "object" ? body.practice : {};
      const mode = ["with", "little", "none", "custom"].includes(raw.mode) ? raw.mode : "with";
      const off = Array.isArray(raw.off)
        ? [...new Set(raw.off.map((/** @type {unknown} */ t) => String(t || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24)).filter(Boolean))].slice(0, 120)
        : [];
      const practice = { mode, off };
      const next = await updateJson(store, K.course(course.id), (/** @type {any} */ c) => (c ? { ...c, practice } : null));
      if (!next) return json({ error: "not-found" }, 404);
      return json({ ok: true, course: next });
    }

    /* Teaching a course and studying it are separate memberships, and someone
       may hold both — a teacher who also wants the cards in their own practice
       has to be enrolled as a student to get them. Assigning one no longer
       removes the other. */
    if (action === "assign-teacher" || action === "assign-student" || action === "remove-member") {
      if (!iManage) return json({ error: "admin-only" }, 403);
      const course = await readCourse(store, String(body.courseId || ""));
      const handle = String(body.handle || "");
      const target = await readUser(store, handle);
      if (!course || !target) return json({ error: "not-found" }, 404);

      /* Onto the course as it stands — a stale copy written back whole is
         how a deck taken off a course came back on it. The same for every
         change to a course below. */
      const only = action === "remove-member" ? body.role : null;
      const next = await updateJson(store, K.course(course.id), (/** @type {Course | null} */ c) => {
        if (!c) return null;
        if (action === "assign-teacher") {
          return c.teachers.includes(handle) ? null : { ...c, teachers: c.teachers.concat([handle]) };
        }
        if (action === "assign-student") {
          return c.students.includes(handle) ? null : { ...c, students: c.students.concat([handle]) };
        }
        return {
          ...c,
          teachers: only === "student" ? c.teachers : c.teachers.filter((h) => h !== handle),
          students: only === "teacher" ? c.students : c.students.filter((h) => h !== handle),
        };
      });
      if (!next) return json({ error: "not-found" }, 404);
      return json({ ok: true, course: next });
    }

    /*
     * Joining by a code, signed in (memberships): a course code, typed in
     * Learning, or a space's invitation, followed while signed in. Either
     * one may be another space's, which the account then joins — what used
     * to be refused as "other-space" and answered with "make a new account".
     * Which code was used decides what they become; studying is its own
     * membership, and a teacher may hold it too.
     */
    if (action === "join-course" || action === "join-space") {
      /* Trying a space is not joining it (0.574). */
      if (trying) return json({ error: "trying-space" }, 403);
      /* Codes are made lower-case; a copy can pick up capitals or stray
         spaces on its way from one screen to another. */
      const given = String(body.code || "").replace(/\s+/g, "").toLowerCase();
      const joined = await joinByCode(store, me, given);
      return json(joined.body, joined.status);
    }

    if (action === "my-courses") {
      const ids = await readIndex(store, "courses");
      const out = (await readManyJson(store, ids.map((id) => K.course(id))))
        .filter((c) => c && inScope(c) && (trying || inCourse(c, mine)))
        .map((c) => {
          /* Trying the space (0.574): every course, as a learner of it. */
          const teaching = !trying && isTeacher(c, mine);
          const studying = trying || isStudent(c, mine);
          const role = teaching ? "teacher" : "student";
          // Only a teacher hands out invitations, so only a teacher sees them.
          return {
            ...c,
            org: orgOf(c),
            role,
            teaching,
            studying,
            code: role === "teacher" ? c.code : undefined,
            teacherCode: role === "teacher" ? c.teacherCode : undefined,
          };
        });
      return jsonTagged(req, { ok: true, courses: out });
    }

    /* Everything a student holds, in one answer: the courses they study,
       those courses' decks, and the cards in them. The app used to fetch
       this as one request per course and then one per deck, every
       forty-five seconds. Now it sends the version it last saw, and if
       nothing has moved the answer is a few bytes.

       Reads here are eventual: a student can see a teacher's change a
       minute late without noticing, and the version converges with it. */
    /* ================= number and time systems =================

       A teacher's numbers are one document per language, and their clock
       is another. Whole-document last-write-wins, which is decided rather
       than inherited: a lexicon is one thing a person edits in one
       sitting, and merging two of them field by field would produce a
       lexicon neither teacher wrote. What that costs is said out loud —
       two teachers saving across each other lose the earlier save whole —
       and it is paid rather than hidden: a save that would go backwards
       is refused and the current document is handed back, so the editor
       can say what happened instead of silently winning. */

    if (action === "my-systems") {
      /*
       * A teacher who already filled in the old Numbers screen finds
       * their words here rather than an empty grid.
       *
       * A lift on read, in the mould every other migration in this app
       * is: it runs the first time the screen is opened, it builds a
       * system where there is none and never touches one that exists,
       * and it deletes nothing — the cards stay where they are, in their
       * decks, with their recordings and every student's progress on
       * them. Which card each box came from is written down, so a device
       * can hand a learner's year on *forty* to the card that replaces
       * it instead of starting them again.
       */
      await seedSystems(mine);
      const index = await systemIndex(mine);
      const keys = [
        ...Object.values(index.numbers).map((id) => K.numSys(String(id))),
        ...Object.values(index.times).map((id) => K.timeSys(String(id))),
      ];
      const rows = keys.length ? (await readManyJson(store, keys)).filter(Boolean) : [];
      /* And which version of each is signed off: a revision, null where
         nothing is yet, and absent where the system has not been edited
         since sign-off existed and is sent as it stands. */
      const signs = await readManyJson(store, rows.map((r) => K.sysSigned(String(r.id))));
      /** @type {Record<string, number | null>} */
      const signed = {};
      rows.forEach((r, i) => {
        if (signs[i]) signed[r.id] = signs[i].rev === null ? null : Number(signs[i].rev);
      });
      return json({ ok: true, systems: rows, signed });
    }

    if (action === "save-system") {
      const kind = body.kind === "times" ? "times" : "numbers";
      const read = kind === "times" ? readTimeSystem : readNumberSystem;
      /* Narrowed before anything is decided about it, so what is compared,
         stored and handed back is one shape and not three. */
      const wanted = read(body.system);
      if (!wanted) return json({ error: "not-a-system" }, 400);
      if (!wanted.languageId) return json({ error: "no-language" }, 400);

      const keyOf = kind === "times" ? K.timeSys : K.numSys;
      const index = await systemIndex(mine);
      const known = kind === "times" ? index.times : index.numbers;
      let id = String(known[wanted.languageId] || "");
      const existing = id ? await readJson(store, keyOf(id)) : null;

      /*
       * The refusal, and what it is keyed on.
       *
       * A save carries the revision it was *loaded from*, and is refused
       * if the site has moved past it — the same compare-and-set
       * `updateJson` does with an ETag, and for the same reason. **Not a
       * timestamp**: the stamp on a save is the editing device's clock,
       * and a device an hour slow would have every save after its first
       * refused for ever with nothing on the screen to explain it. A
       * revision is a number both sides have actually seen.
       *
       * Refusing rather than merging is the decision, and the cost is
       * real: two teachers editing one lexicon across a sync means the
       * later save is not made. It is answered with the document that is
       * there, so the editor can say so — which is the whole difference
       * between a cost and a mystery. The outbox treats an answered
       * request as decided, and it is: asking again would only ask again.
       */
      const held = Number((existing && existing.rev) || 0);
      if (existing && held > Number(wanted.rev || 0)) {
        return json({ error: "stale-system", system: existing }, 409);
      }

      if (!id) {
        id = `${kind === "times" ? "t" : "n"}${randomBytes(6).toString("hex")}`;
        await updateJson(store, K.mySystems(mine), (current) => {
          const now = current && typeof current === "object" ? current : {};
          const slot = { ...(now[kind] && typeof now[kind] === "object" ? now[kind] : {}) };
          slot[wanted.languageId] = id;
          return { ...now, [kind]: slot };
        });
      }

      const saved = {
        ...wanted,
        id,
        owner: mine,
        rev: held + 1,
        created: Number(existing && existing.created) || Date.now(),
        updated: Date.now(),
      };
      /*
       * A save is what students get.
       *
       * There used to be a second step — the teacher saved, then signed
       * the version off, and students were sent the signed one. Owners
       * found two buttons for one decision, and a saved change that
       * reached nobody until the second press was the one they forgot.
       * So a save signs its own version: the record is still written, and
       * still what my-material sends, so a device and a server from
       * before this read it exactly as they did.
       */
      await writeJson(store, keyOf(id), saved);
      await writeJson(store, K.sysSigned(id), { rev: saved.rev, at: Date.now(), by: mine, system: saved });
      await taught();
      return json({ ok: true, system: saved, signed: saved.rev });
    }

    /*
     * A teacher's sign-off on the version of a system they have checked.
     *
     * A language's numbers can run to millions, so nobody reads them all:
     * the numbers screen shows one of every shape a language can get
     * wrong, and signing off says the teacher has read those. The version
     * signed is kept whole and is what students are sent until the next
     * sign-off. Refused unless it is the version on disk, so what is
     * signed is what the teacher was looking at.
     *
     * A save now signs itself (see save-system) and the app no longer
     * asks for this; it is kept for a device still running a build that
     * does, whose press then finds its version already signed.
     */
    if (action === "sign-system") {
      const kind = body.kind === "times" ? "times" : "numbers";
      const languageId = String(body.languageId || "");
      const index = await systemIndex(mine);
      const id = String((kind === "times" ? index.times : index.numbers)[languageId] || "");
      if (!id) return json({ error: "no-system" }, 404);
      const current = await readJson(store, (kind === "times" ? K.timeSys : K.numSys)(id));
      if (!current) return json({ error: "no-system" }, 404);
      if (Number(current.rev) !== Number(body.rev)) return json({ error: "stale-system", system: current }, 409);
      await writeJson(store, K.sysSigned(id), { rev: Number(current.rev), at: Date.now(), by: mine, system: current });
      await taught();
      return json({ ok: true, id, signed: Number(current.rev) });
    }

    if (action === "delete-system") {
      const kind = body.kind === "times" ? "times" : "numbers";
      const languageId = String(body.languageId || "");
      if (!languageId) return json({ error: "no-language" }, 400);
      const index = await systemIndex(mine);
      const held = kind === "times" ? index.times : index.numbers;
      const id = String(held[languageId] || "");
      if (!id) return json({ error: "no-system" }, 404);
      await store.delete((kind === "times" ? K.timeSys : K.numSys)(id)).catch(() => {});
      await store.delete(K.sysSigned(id)).catch(() => {});
      await updateJson(store, K.mySystems(mine), (current) => {
        const now = current && typeof current === "object" ? current : {};
        const slot = { ...(now[kind] && typeof now[kind] === "object" ? now[kind] : {}) };
        delete slot[languageId];
        return { ...now, [kind]: slot };
      });
      return json({ ok: true, deleted: id });
    }

    if (action === "my-material") {
      const known = String(url.searchParams.get("version") || "");
      /** @type {string[]} */
      const courseIds = (await readJson(store, K.index("courses"), EVENTUAL)) || [];
      const allCourses = (
        await readManyJson(store, courseIds.map((id) => K.course(id)), EVENTUAL)
      ).filter((c) => c && inScope(c));
      /* Trying a space (0.574): every course of it is dealt, without a
         roster. For the App admin the scope is the acting space alone. */
      const courseRows = trying ? allCourses : allCourses.filter((c) => isStudent(c, mine));
      /* Whether the Teaching space exists for this person is answered here
         too, so the app needn't ask a second time on every launch. */
      /* Teaching is of the space this request acts in (memberships): a
         teacher in one space and a learner in another sees Teaching where
         they teach. */
      const teaches = allCourses.filter((c) => orgOf(c) === acting).some((c) => isTeacher(c, mine));
      /* And every space they teach in (0.610): this action reads across
         all of them, so Where you are can offer Teaching on each. */
      const teachesIn = [...new Set(allCourses.filter((c) => isTeacher(c, mine)).map((c) => orgOf(c)))];

      /* My space is no longer practised in Learning (0.550, 8b): nothing of
         it is sent here. */

      /* A deck in two of the person's courses is still one deck; listing
         it twice gave the app two cards with one id. First course wins. */
      const deckToCourse = new Map();
      for (const c of courseRows) for (const did of c.decks || []) {
        if (!deckToCourse.has(did)) deckToCourse.set(did, c);
      }
      let deckRows = (await readManyJson(store, [...deckToCourse.keys()].map((id) => K.deck(id)), EVENTUAL)).filter(
        Boolean
      );
      /* A path unit reaches a student only through a course where it is
         published (0.613, R26): a draft is invisible, its cards, its number
         parts and all. Where it is published in several of their courses,
         the first of those is the one it is sent under. */
      for (const d of deckRows) {
        if (!d.unit) continue;
        const live = courseRows.find((c) => (c.decks || []).includes(d.id) && isLiveIn(c, d.id));
        if (live) deckToCourse.set(d.id, live);
        else deckToCourse.delete(d.id);
      }
      deckRows = deckRows.filter((d) => deckToCourse.has(d.id));

      /* Whose values can reach this person: whoever owns a deck they hold,
         and whoever teaches a course they are in — the same two lists the
         bundling below reads from, so what is sent and what the version
         covers cannot come apart. Their revisions go into the version
         because a value belongs to no deck, and nothing else about it would
         move when one is written. */
      const teacherHandles = [
        ...new Set(
          deckRows
            .map((/** @type {any} */ d) => d.owner)
            .concat(courseRows.flatMap((/** @type {any} */ c) => c.teachers || []))
            /* And whoever a deck takes its numbers from (0.541), who may
               teach none of these courses. */
            .concat(deckRows.map((/** @type {any} */ d) => d.numbersFrom || ""))
            .filter(Boolean)
        ),
      ];
      const fillsRevs = await readManyJson(
        store,
        teacherHandles.map((h) => K.fillsRev(h)),
        EVENTUAL
      );
      /** @type {[string, number][]} */
      const fillsAt = teacherHandles.map((h, i) => [h, (fillsRevs[i] && fillsRevs[i].rev) || 0]);

      /*
       * And their numbers, in the languages this person is actually
       * learning.
       *
       * The languages come off the decks and the courses rather than off
       * the teacher, so a teacher who also teaches Hebrew somewhere else
       * does not post a Hebrew lexicon to a student of Arabic. Sent whole
       * and regenerated into cards on the device; each system's revision
       * goes into the version for the same reason a value's does.
       */
      const langs = [
        ...new Set(
          deckRows
            .map((/** @type {any} */ d) => d.lang)
            .concat(courseRows.map((/** @type {any} */ c) => c.language))
            .filter(Boolean)
        ),
      ];
      /* And a teacher who never opened the screen still has their words
         read across, because a student's own poll does it. Once per
         teacher, ever — see seedSystems, which stamps itself. */
      await Promise.all(teacherHandles.map((h) => seedSystems(h)));
      /* And their tags, before the cards below are read, so what is sent is
         already tidied. The version was taken a step earlier; where this
         moved anything it moves again, and the device fetches once more. */
      await Promise.all(teacherHandles.map((h) => liftTags(h)));
      /*
       * Each as its teacher last saved it, because a save is what students
       * get — see save-system.
       *
       * This used to send the version last signed off, and nothing at all
       * where nothing had been. Since Save publishes, every save signs
       * itself, so the two differ only for a system last saved before that
       * — under a Publish button that is gone. A system written then and
       * never published reached no student, with no button left to send
       * it and nothing on the teacher's screen to say so: a deck holding
       * only numbers was a deck with nothing in it, and its students were
       * told there was nothing to practise. The sign-off record is still
       * written, for a build that reads it; nothing here does.
       */
      const systems = (
        await Promise.all(teacherHandles.map((h) => systemsOf(h, langs)))
      ).flat();
      /** @type {[string, number][]} */
      const systemsAt = systems.map((/** @type {any} */ sys) => [sys.id, Number(sys.rev) || 0]);
      const version = materialVersion(courseRows, deckRows, fillsAt, systemsAt);
      const courses = courseRows.map((c) => ({
        ...c,
        /* Said outright, so the app never needs "absent means Main". */
        org: orgOf(c),
        code: undefined,
        teacherCode: undefined,
        role: "student",
        teaching: isTeacher(c, mine),
        studying: true,
      }));
      if (known && known === version) return json({ ok: true, unchanged: true, version, teaches, teachesIn });

      const ownerHandles = [...new Set(deckRows.map((d) => d.owner))];
      const owners = await readManyJson(store, ownerHandles.map((h) => K.user(h)), EVENTUAL);
      /** @type {Record<string, string>} */
      const nameOf = {};
      ownerHandles.forEach((h, i) => (nameOf[h] = owners[i] ? owners[i].displayName : h));
      await nameTheGone(nameOf, ownerHandles);

      const decks = [];
      for (const d of deckRows) {
        const course = deckToCourse.get(d.id);
        const link = (d.courses || []).find((/** @type {{ courseId: string }} */ c) => c.courseId === course.id);
        const cardIds = await deckCardIds(d);
        /* Which number system and clock fill this deck's number parts: the
           chosen person's, in the deck's language (0.541). null when that
           person has none, so the device files nothing rather than
           everything. */
        const numLang = d.lang || course.language || "";
        const numIndex = await systemIndex(d.numbersFrom || d.owner);
        decks.push({
          ...d,
          numbersSystemId: numIndex.numbers[numLang] || null,
          timeSystemId: numIndex.times[numLang] || null,
          cardIds,
          cardCount: cardIds.length,
          ownerName: nameOf[d.owner],
          addedAt: link ? link.addedAt : null,
          courseId: course.id,
          courseTitle: course.title,
          courseLanguage: course.language || "",
        });
      }
      decks.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

      const allCardIds = [...new Set(decks.flatMap((d) => d.cardIds))];
      const cardRows = await readManyJson(store, allCardIds.map((id) => K.card(id)), EVENTUAL);
      const cardById = new Map();
      /* Only what is published, and only the version that is: a draft, and
         a published card's unpublished changes, are the teacher's until
         they publish them. See isPublished. */
      allCardIds.forEach((id, i) => {
        const c = cardRows[i];
        if (c && inScope(c) && isPublished(c)) cardById.set(id, studentView(c));
      });
      /*
       * The values a deck's phrases need, sent with it.
       *
       * A card that fills a variable is in no deck: it is borrowed by
       * whichever phrase has a hole of its name, and asking a teacher to
       * file "Raphael" under Lesson 3 to make "My name is {{name}}" work
       * would be filing it where nobody would look for it. So the server
       * works out which variables a deck actually asks for and sends the
       * cards that answer them.
       *
       * From the teachers of the course the deck is in, in the deck's own
       * language: those are the people whose material reaches this student
       * at all, and a Vietnamese name in an Arabic frame is not a variation
       * on the sentence but a different sentence.
       *
       * Nothing is read here for a site that uses no variables — the first
       * line is a scan of cards already in hand.
       */
      /*
       * Each teacher's library, read once for the whole answer.
       *
       * It was read once per deck: ten decks in a course meant ten reads
       * of every card its teachers have ever written, and every one of
       * them parsed again — for one student, on every refresh that found
       * anything changed. What a card answers to is worked out on the way
       * past for the same reason, since that too was redone per deck.
       */
      /** @type {Map<string, { card: any, fills: string[] }[]>} */
      const libraries = new Map();
      /** @param {string} owner */
      async function libraryOf(owner) {
        const held = libraries.get(owner);
        if (held) return held;
        /** @type {string[]} */
        const ids = (await readJson(store, K.myCards(owner), EVENTUAL)) || [];
        const rows = await readManyJson(store, ids.map((id) => K.card(id)), EVENTUAL);
        const out = rows
          .filter((/** @type {any} */ c) => c && inScope(c) && isPublished(c))
          .map((/** @type {any} */ c) => studentView(c))
          .map((/** @type {any} */ c) => ({ card: c, fills: fillsOf(c) }));
        libraries.set(owner, out);
        return out;
      }

      /*
       * The sentences the scenes in these decks picked their turns from.
       *
       * A picked turn is sent with the sentence's words as they are now —
       * the copy on the scene is only as fresh as the scene's last save —
       * and with the sentence's review, which is the review that turn
       * answers to (see lineGate in review.ts). The sentence itself need
       * not be in any deck this student holds: it is the scene that is
       * being taught. Read once for the whole answer, like the libraries
       * below.
       */
      const pickedIds = [
        ...new Set(
          [...cardById.values()].flatMap((/** @type {any} */ c) =>
            isDialog(c) ? linesOf(c).map((l) => pickedFrom(l)).filter(Boolean) : [],
          ),
        ),
      ];
      const missing = pickedIds.filter((x) => !cardById.has(x));
      const extraRows = await readManyJson(store, missing.map((x) => K.card(x)), EVENTUAL);
      /** @type {Map<string, any>} */
      const sentenceById = new Map();
      for (const x of pickedIds) {
        const row = cardById.get(x) || extraRows[missing.indexOf(x)];
        const c = row && isPublished(row) ? studentView(row) : null;
        if (c && !isDialog(c) && isSentence(c)) sentenceById.set(x, c);
      }
      /** @param {any} c */
      const withSentences = (c) => {
        if (!isDialog(c) || !linesOf(c).some((l) => pickedFrom(l))) return c;
        return {
          ...c,
          lines: linesOf(c).map((l) => {
            const from = pickedFrom(l);
            if (!from) return l;
            const source = sentenceById.get(from);
            /* Gone, or no longer a sentence: a typed turn with the words it
               last had, reviewed with the scene's own — which is what the
               next save of the scene will make it. */
            if (!source) {
              const { from: _gone, ...typed } = /** @type {any} */ (l);
              return typed;
            }
            const review = reviewOf(source);
            return { ...pickedLine(l, source), ...(review ? { review } : {}) };
          }),
        };
      };

      const bundled = [];
      for (const d of decks) {
        const own = d.cardIds
          .map((/** @type {string} */ id) => cardById.get(id))
          .filter(Boolean)
          .map(withSentences);
        /* The blanks these cards leave — in their forms, and in the turns
           of a scene, which were left out until scenes could be cast and
           so sent a scene's blanks nothing to fill them with. */
        const wanted = new Set(
          own.flatMap((/** @type {any} */ c) =>
            formsOf(c)
              .flatMap((/** @type {any} */ f) => slotsOf(f))
              .concat(linesOf(c).flatMap((l) => slotsOf(l))),
          )
        );
        if (!wanted.size) {
          bundled.push({ deckId: d.id, cards: own });
          continue;
        }
        const course = deckToCourse.get(d.id);
        const from = [...new Set([d.owner, ...((course && course.teachers) || [])])].filter(Boolean);
        const held = new Set(own.map((/** @type {any} */ c) => c.id));
        const values = [];
        for (const owner of from) {
          for (const { card: c, fills } of await libraryOf(owner)) {
            /*
             * What a card answers to, through the one answer to that —
             * which is its group tags, the ID the teacher gave it, and the
             * kind of word it said it was.
             *
             * It used to be the tags alone, so two of the four ways a
             * blank is filled never reached a student: `{{colour-red}}`
             * and `{{noun}}` found nothing on the device, and the sentence
             * that asked for one was quietly never dealt — while the
             * teacher's own Examples list, which reads the whole library,
             * showed it working. The same call now answers on both sides.
             *
             * `{{word}}` is deliberately not among them: it is answered by
             * any word at all, so matching it here would send a student
             * every word their teachers have ever written. It is filled on
             * the device instead, out of the decks the student holds,
             * which is what it has always been filled from — see fillsOf,
             * which adds that name only for a caller that asks for it.
             */
            if (!fills.some((name) => wanted.has(name))) continue;
            if (d.lang && c.lang && c.lang !== d.lang) continue;
            if (held.has(c.id)) continue;
            held.add(c.id);
            values.push(c);
          }
        }
        bundled.push({ deckId: d.id, cards: own.concat(values) });
      }

      /* Which of their recordings the server does not hold: a student's
         device leaves those out of what it counts as still to download,
         since no download will ever bring them — see clipsMissing. */
      const missingClips = await clipsMissing(store, bundled.flatMap((b) => b.cards.flatMap(clipsOfOne)));
      const missingImages = await clipsMissing(
        store,
        bundled.flatMap((b) => b.cards.flatMap((/** @type {any} */ c) => formsOf(c).flatMap((/** @type {Record<string, any>} */ f) => (Array.isArray(f.images) ? f.images : [])))),
        "image",
      );
      return json({ ok: true, version, teaches, teachesIn, courses, decks, cards: bundled, systems, missingClips, missingImages });
    }

    /* Everything in a course is visible to everyone in it. */
    if (action === "course-decks") {
      const course = await readCourse(store, url.searchParams.get("course") || "");
      if (!course) return json({ error: "not-found" }, 404);
      if (!inCourse(course, mine) && !iManage) return json({ error: "not-in-course" }, 403);

      const rows = (await readManyJson(store, course.decks.map((id) => K.deck(id)))).filter(
        Boolean
      );
      const ownerHandles = [...new Set(rows.map((d) => d.owner))];
      const owners = await readManyJson(store, ownerHandles.map((h) => K.user(h)));
      /** @type {Record<string, string>} */
      const nameOf = {};
      ownerHandles.forEach((h, i) => (nameOf[h] = owners[i] ? owners[i].displayName : h));
      await nameTheGone(nameOf, ownerHandles);
      const decks = rows.map((d) => {
        const link = d.courses.find((/** @type {{ courseId: string }} */ c) => c.courseId === course.id);
        return {
          ...d,
          ownerName: nameOf[d.owner],
          addedAt: link ? link.addedAt : null,
          cardCount: (d.cardIds || []).length,
        };
      });
      decks.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
      /* Neither code, to anybody: whoever is asking is already in. The
         teacher code is the one that matters — it makes a teacher of
         whoever holds it, and this answer goes to students. Teachers and
         the administrator read both codes from my-courses and Admin. */
      return json({ ok: true, course: { ...course, code: undefined, teacherCode: undefined }, decks });
    }

    if (action === "deck-cards") {
      const deck = await readDeck(store, url.searchParams.get("deck") || "");
      if (!deck) return json({ error: "not-found" }, 404);

      /* Somebody in a course that lists it — the course's say, which is
         what sends it to them in the first place. */
      const allowed =
        deck.owner === mine ||
        iManage ||
        (await everyCourse(store)).some((c) => (c.decks || []).includes(deck.id) && inCourse(c, mine));
      if (!allowed) return json({ error: "no-access" }, 403);

      const cards = (
        await readManyJson(store, (deck.cardIds || []).map((id) => K.card(id)))
      )
        .filter((/** @type {any} */ c) => c && isPublished(c))
        .map((/** @type {any} */ c) => studentView(c));
      return json({ ok: true, version: deck.version, cards });
    }

    /* ================= a teacher's export =================

       A card, a few, a deck or several, as a file in the backup's own
       format: what the administrator's Restore reads, and plain enough to
       hand to anybody else who wants to read the cards. Fetched in chunks
       the way a backup is, because recordings are what make it large.

       Only what this teacher may already work on: their own cards, the
       decks they own or teach, and the cards in those decks — my-cards'
       and my-decks' rule. Clips and images are named by the hash of their
       bytes, which only a card already in the export can tell anyone. */

    /** What this teacher may put in an export. */
    async function exportable() {
      /** @type {string[]} */
      const own = (await readJson(store, K.myCards(mine))) || [];
      const courses = await everyCourse(store);
      const teaching = new Set(courses.filter((c) => isTeacher(c, mine)).flatMap((c) => c.decks || []));
      const deckRows = (await readManyJson(store, (await readIndex(store, "decks")).map((id) => K.deck(id))))
        .filter((d) => d && inScope(d));
      /* An administrator may take anything, as a backup would. */
      const admin = iManage;
      const decks = deckRows.filter((d) => admin || d.owner === mine || teaching.has(d.id));
      const cards = new Set(own.concat(decks.flatMap((d) => d.cardIds || [])));
      return { decks: new Map(decks.map((d) => [d.id, d])), cards, admin };
    }

    if (action === "export-plan") {
      const may = await exportable();
      /** @type {string[]} */
      const askedDecks = (Array.isArray(body.deckIds) ? body.deckIds : []).map(String);
      /** @type {string[]} */
      const askedCards = (Array.isArray(body.cardIds) ? body.cardIds : []).map(String);
      const deckIds = [...new Set(askedDecks)].filter((id) => may.decks.has(id));
      /* A deck goes with every card in it: a deck put back without them
         would be an empty deck that says it holds cards. */
      const wanted = new Set(askedCards.concat(deckIds.flatMap((id) => may.decks.get(id).cardIds || [])));
      const ids = [...wanted].filter((id) => may.admin || may.cards.has(id));
      const cards = here(await readManyJson(store, ids.map((id) => K.card(id)))).filter(Boolean);
      const withMedia = body.media !== false;
      const clips = withMedia ? [...new Set(cards.flatMap(clipsOfCard))] : [];
      const images = withMedia ? [...new Set(cards.flatMap(imagesOfCard))] : [];

      /* Who each card belongs to, so a restore lists it among its owner's
         cards again. Only these ids: the restore adds them to the list
         that is there rather than writing it over. */
      /** @type {Record<string, string[]>} */
      const lists = {};
      for (const c of cards) if (c.owner) (lists[K.myCards(c.owner)] = lists[K.myCards(c.owner)] || []).push(c.id);

      /** @type {{ id: string, kind: string, keys: string[] }[]} */
      const chunks = [];
      /** @type {(kind: string, keys: string[], size: number) => void} */
      const batch = (kind, keys, size) => {
        for (let i = 0; i < keys.length; i += size) {
          chunks.push({ id: `${kind}-${chunks.length}`, kind, keys: keys.slice(i, i + size) });
        }
      };
      batch("deck", deckIds.map(K.deck), 40);
      batch("card", cards.map((c) => K.card(c.id)), 25);
      batch("clip", clips.map(K.clip), 3);
      batch("image", images.map(K.image), 2);

      return json({
        ok: true,
        manifest: {
          version: 1,
          takenAt: Date.now(),
          by: mine,
          counts: {
            users: 0, courses: 0, decks: deckIds.length, cards: cards.length,
            systems: 0, flags: 0, clips: clips.length, images: images.length, keys: 0,
          },
          indexes: { decks: deckIds },
          chunks: chunks.map((c) => ({ id: c.id, kind: c.kind, keys: c.keys.length })),
          plan: chunks,
        },
        lists,
        /* What was asked for and is not this teacher's to take. */
        refused:
          askedCards.filter((id) => !may.admin && !may.cards.has(id)).length +
          askedDecks.filter((id) => !may.decks.has(id)).length,
      });
    }

    if (action === "export-chunk") {
      /** @type {string[]} */
      const keys = (Array.isArray(body.keys) ? body.keys.slice(0, 200) : []).map(String);
      if (!keys.length) return json({ error: "no-keys" }, 400);
      const may = await exportable();
      /* Checked again here rather than trusted from the plan: a chunk is
         just a list of keys, and anybody can write one. */
      const allowed = (/** @type {string} */ k) =>
        k.startsWith("deck:") ? may.decks.has(k.slice(5))
        : k.startsWith("card:") ? may.admin || may.cards.has(k.slice(5))
        : /^(clip|image):[a-f0-9]{64}$/.test(k);
      if (!keys.every(allowed)) return json({ error: "no-access" }, 403);
      const values = await Promise.all(
        keys.map((k) =>
          k.startsWith("clip:") || k.startsWith("image:")
            ? store.get(k, { type: "text" }).catch(() => null)
            : readJson(store, k)
        )
      );
      /* An administrator may take any card — in the org this request acts in. */
      if (values.some((v, i) => !keys[i].startsWith("clip:") && !keys[i].startsWith("image:") && v && !inScope(v))) {
        return json({ error: "no-access" }, 403);
      }
      /** @type {Record<string, any>} */
      const records = {};
      keys.forEach((k, i) => {
        if (values[i] !== null && values[i] !== undefined) records[k] = values[i];
      });
      return json({ ok: true, records, digest: sha(JSON.stringify(records)), found: Object.keys(records).length });
    }

    /* ================= clips ================= */

    if (action === "put-clip") {
      const hash = String(body.hash || "");
      const data = String(body.data || "");
      if (!/^[a-f0-9]{64}$/.test(hash)) return json({ error: "bad-hash" }, 400);
      if (!data || data.length > MAX_CLIP_BYTES) return json({ error: "bad-clip" }, 400);
      const existing = await store.get(K.clip(hash), { type: "text" });
      if (existing) return json({ ok: true, deduplicated: true });
      await store.set(K.clip(hash), data);
      CLIPS_HERE.add(hash);
      return json({ ok: true, deduplicated: false });
    }

    /*
     * How big the recordings and pictures named are, as their files.
     *
     * Asked by Account settings before a download, so the button can say
     * roughly how much it will take — on mobile data, or a phone that is
     * nearly full, that is the thing to know before tapping. Answered off
     * the directory, without reading anything; a hash the server does not
     * hold is left out. The bytes are of the file as stored, which is
     * text, so a little more than the device will keep.
     */
    if (action === "media-sizes") {
      const ok = (/** @type {unknown} */ h) => typeof h === "string" && /^[a-f0-9]{64}$/.test(h);
      const clipsAsked = (Array.isArray(body.clips) ? body.clips : []).filter(ok).slice(0, 5000);
      const imagesAsked = (Array.isArray(body.images) ? body.images : []).filter(ok).slice(0, 5000);
      /** @param {string[]} list @param {(h: string) => string} keyOf */
      const sizes = async (list, keyOf) => {
        /** @type {Record<string, number>} */
        const out = {};
        for (let i = 0; i < list.length; i += 50) {
          await Promise.all(list.slice(i, i + 50).map(async (h) => {
            const n = typeof store.size === "function"
              ? await store.size(keyOf(h))
              : ((await store.get(keyOf(h), { type: "text" })) || "").length || null;
            if (n) out[h] = n;
          }));
        }
        return out;
      };
      return json({ ok: true, clips: await sizes(clipsAsked, K.clip), images: await sizes(imagesAsked, K.image) });
    }

    if (action === "clip") {
      const hash = url.searchParams.get("hash") || "";
      if (!/^[a-f0-9]{64}$/.test(hash)) return json({ error: "bad-hash" }, 400);
      // Clips never change once written, so the edge copy is always right.
      const data = await store.get(K.clip(hash), { type: "text", consistency: "eventual" });
      if (!data) return json({ error: "not-found" }, 404);
      return json({ ok: true, hash, data }, 200, FOREVER);
    }

    /* ================= images =================
       A card's pictures, stored the way its recordings are: under the hash
       of their own bytes, as the data URL the editor sent, fetched by that
       hash and never changed once written. */

    if (action === "put-image") {
      const hash = String(body.hash || "");
      const data = String(body.data || "");
      if (!/^[a-f0-9]{64}$/.test(hash)) return json({ error: "bad-hash" }, 400);
      if (!data || data.length > MAX_IMAGE_BYTES || !IMAGE_DATA.test(data)) {
        return json({ error: "bad-image" }, 400);
      }
      const existing = await store.get(K.image(hash), { type: "text" });
      if (existing) return json({ ok: true, deduplicated: true });
      await store.set(K.image(hash), data);
      IMAGES_HERE.add(hash);
      return json({ ok: true, deduplicated: false });
    }

    if (action === "image") {
      const hash = url.searchParams.get("hash") || "";
      if (!/^[a-f0-9]{64}$/.test(hash)) return json({ error: "bad-hash" }, 400);
      const data = await store.get(K.image(hash), { type: "text", consistency: "eventual" });
      if (!data) return json({ error: "not-found" }, 404);
      return json({ ok: true, hash, data }, 200, FOREVER);
    }

    /* ================= one's own account in a space (0.544) ================= */

    /* "I've saved my key somewhere safe" (19b). */
    if (action === "key-saved") {
      await updateJson(store, K.user(mine), (/** @type {any} */ cur) => (cur ? { ...cur, keySaved: true } : null));
      return json({ ok: true });
    }

    /* Leaving the space (25a, 52a): suspended, with a record, until a space
       admin or the App admin reactivates. Never an App admin. */
    if (action === "leave-space") {
      /* The App admin leaves a space they added themselves to (0.575): the
         membership goes, with no Former members record. Never their first
         space, which is where they land. */
      if (iAmAdmin) {
        if (!memberOf(me).includes(acting) || acting === orgOf(me) || memberOf(me).length < 2) {
          return json({ error: "admin-stays" }, 400);
        }
        await removeMembership(store, mine, acting, { why: "left", by: mine, former: false });
        return json({ ok: true });
      }
      await suspend(me, "left", mine);
      return json({ ok: true });
    }

    /**
     * Suspend an account in the space this request acts in: off that
     * space's rosters, its courses kept to put back, and a Former members
     * record there. The person's other spaces are untouched (memberships).
     * Suspended (0.578) stays on the space's People list and is not a
     * former member; left and removed are.
     * @param {any} user @param {"left" | "removed" | "suspended"} why @param {string} by
     */
    async function suspend(user, why, by) {
      /* Suspended first and removed after: the courses they were on before
         either, so a return still puts them back. */
      const was = suspensionIn(user, acting);
      const courses = was && Array.isArray(was.courses) && was.courses.length ? was.courses : await coursesOf(store, user.handle);
      await dropFromRosters(store, user.handle);
      await updateJson(store, K.user(user.handle), (/** @type {any} */ cur) => {
        if (!cur) return null;
        const u = normalisedUser(cur);
        return { ...u, suspendedIn: { ...u.suspendedIn, [acting]: { at: Date.now(), by, why, courses } } };
      });
      if (why === "suspended") return;
      await noteFormer(store, acting, {
        handle: user.handle,
        displayName: user.displayName,
        joined: user.created || 0,
        left: Date.now(),
        courses,
        why,
        by,
      });
    }

    /* ================= admin ================= */

    if (action.startsWith("admin-")) {
      /* A space admin may use these, in their own space (0.544; B4); every
         other admin- action is the App admin's alone. */
      const SPACE_ADMIN_MAY = new Set([
        "admin-overview", "admin-create-user", "admin-reissue-key", "admin-rename-course",
        "admin-course-language", "admin-new-code", "admin-card", "admin-delete-flags",
        "admin-suspend-user", "admin-reactivate-user", "admin-new-invite", "admin-hand-over",
        "admin-purge-former", "admin-remove-member",
      ]);
      if (!iAmAdmin && !(iRunThis && SPACE_ADMIN_MAY.has(action))) return json({ error: "admin-only" }, 403);

      if (action === "admin-overview") {
        const userIds = await readIndex(store, "users");
        const courseIds = await readIndex(store, "courses");
        const deckIds = await readIndex(store, "decks");
        const flagIds = await readIndex(store, "flags");

        const [courseRows, userRows, deckRows, flagRows] = await Promise.all([
          readManyJson(store, courseIds.map((id) => K.course(id))).then(here),
          readManyJson(store, userIds.map((h) => K.user(h))).then(here),
          readManyJson(store, deckIds.map((id) => K.deck(id))).then(here),
          readManyJson(store, flagIds.map((id) => K.flag(id))).then(here),
        ]);
        const courses = courseRows.filter(Boolean);
        const users = [];
        for (const u of userRows) {
          if (!u) continue;
          const h = u.handle;
          /* This space's view of them (memberships): suspended here or not,
             and when they last practised or changed material here. Nothing
             in the row says they are anywhere else. */
          const safe = withoutMemberships(u);
          users.push({
            ...safe,
            suspended: suspensionIn(u, acting) || undefined,
            lastLearned: lastLearnedFor(u, acting),
            lastTaught: lastTaughtFor(u, acting),
            /* Title and language together: a course name on its own doesn't
               say what is being taught, and that is the thing that goes wrong
               quietly. */
            teaching: courses
              .filter((c) => isTeacher(c, h))
              .map((c) => ({ title: c.title, language: c.language || "" })),
            studying: courses
              .filter((c) => isStudent(c, h))
              .map((c) => ({ title: c.title, language: c.language || "" })),
          });
        }
        /** @type {Record<string, string>} */
      const nameOf = {};
        for (const u of userRows) if (u) nameOf[u.handle] = u.displayName;
        await nameTheGone(nameOf, deckRows.filter(Boolean).map((d) => d.owner));
        /* Which courses hold a deck, said by the courses — see linksOf —
           and which of its number parts reach nobody yet. */
        const waiting = await partsWaiting(deckRows.filter(Boolean), courses);
        const decks = deckRows.filter(Boolean).map((d) => {
          const courseLinks = linksOf(d, courses);
          return {
            ...d,
            courses: courseLinks,
            ...(waiting.has(d.id) ? { partsWaiting: waiting.get(d.id) } : null),
            cardCount: (d.cardIds || []).length,
            ownerName: nameOf[d.owner] || d.owner,
            courseTitles: courseLinks
              .map((l) => (courses.find((c) => c.id === l.courseId) || {}).title)
              .filter(Boolean),
          };
        });
        /*
         * What became of each flagged card, which decides what the report
         * is still worth: one edited since is probably already fixed, one
         * deleted since cannot be opened at all, and one the site did not
         * hold even when the report arrived is nobody here's to change.
         * Saying so on the report is the difference between a list to work
         * through and a list to guess at.
         *
         * Read once per card rather than once per flag: several reports
         * about one bad card is the normal case, and it is the whole reason
         * they are worth reading together.
         */
        const flaggedIds = [
          ...new Set(flagRows.filter(Boolean).map((f) => cardIdOf(f.cardId)).filter(Boolean)),
        ];
        const flaggedCards = await readManyJson(store, flaggedIds.map((id) => K.card(id)), EVENTUAL);
        const revOf = new Map();
        flaggedIds.forEach((id, i) => revOf.set(id, flaggedCards[i] ? flaggedCards[i].rev || 1 : null));

        /* Newest first: a flags list is read from the top, and what came in
           since the last look is the part worth reading. The reporter's
           current name wins over the one copied in when it was sent, so a
           person who has since been renamed is not two people here. */
        const flags = flagRows
          .filter(Boolean)
          .map((f) => {
            const cardId = cardIdOf(f.cardId);
            /* Where the card stands now, and where it stood when the report
               was sent. The second is missing from a report made before it
               was recorded, and worthless on one that recorded "no such
               card" and whose card the prefix above has since found — in
               both cases the number to compare against does not exist, and
               inventing one would mark every card past its first save as
               edited. Whether it is still there is the half that always
               answers, and it is the half that decides what can be
               opened. */
            const rev = cardId ? revOf.get(cardId) : null;
            const wasAt = f.cardKnown === false ? undefined : f.cardRev;
            let cardState;
            if (rev === null || rev === undefined) {
              /* Not there now. Was it there when this was sent? Never, for
                 a question the app made itself from a number system: no
                 card is ever stored for one, and calling it missing read
                 as though somebody had deleted it. */
              cardState = cardId.startsWith("sys:") ? "made" : f.cardKnown === false || !cardId ? "absent" : "gone";
            } else if (wasAt === undefined) {
              cardState = "here";
            } else {
              cardState = rev === wasAt ? "here" : "edited";
            }
            return {
              ...f,
              cardId,
              handleName: nameOf[f.handle] || f.handleName || f.handle,
              cardState,
            };
          })
          .sort((a, b) => (b.at || 0) - (a.at || 0));
        /* And who has left the space (30c). */
        const former = (await readJson(store, K.former(acting))) || [];
        /* And the space's invitation, for its admins to share (37a). */
        const invite = actingOrgDoc ? { code: actingOrgDoc.inviteCode, slug: actingOrgDoc.slug, name: actingOrgDoc.name, admins: actingOrgDoc.admins || [] } : null;
        return jsonTagged(req, { ok: true, users, courses, decks, flags, former, invite });
      }

      /* A lost key: the handle survives, so memberships and progress do too. */
      /* Making someone's account for them.
     
         The same as signing up, except the administrator does it and keeps
         the key to hand over. This is the only way to get a teacher onto
         the site without asking them to install the app first and read
         their handle back — which is the wrong way round when the person
         inviting them already knows who they are.
     
         The key is returned once and cannot be read back afterwards; if it
         is lost, issue a new one. */
      /* ================= backup =================

         Reading everything in one request would work in testing and fail the
         first time a course has real recordings in it: a function may only
         return about 6MB and may only run for a few seconds, and clips are
         base64 audio. So a backup is a manifest — which says exactly what
         exists and how it is divided — followed by chunks the browser fetches
         and reassembles into one file.

         The manifest is also what makes a backup checkable: every chunk
         carries a digest, so a file can be verified long after it was made,
         without a restore and without trusting that the download finished. */

      /*
       * A backup of the whole site, or (0.546; 63a) a backup of one space:
       * the same manifest, with everything outside that space left out. A
       * space's file holds its members' My space material made in that
       * space (0.583; docs/PLAN-space-backup.md, 2a — reversing 72a, since
       * a space put back without it would lose people's own work). The
       * manifest says which it is in `scope`, so a restore can tell a
       * space's file from the site's. Its chunks are fetched with
       * admin-backup-chunk like a backup's.
       */
      if (action === "admin-backup-manifest" || action === "admin-export-org-manifest" || action === "admin-org-usage") {
        const only = action === "admin-backup-manifest" ? "" : String(body.id || url.searchParams.get("id") || "");
        if (action !== "admin-backup-manifest" && !(await readJson(store, K.org(only)))) return json({ error: "no-space" }, 404);
        /* Personal decks and cards carry the space they were made in, so the
           space test alone keeps My space to this space. */
        const keep = (/** @type {any} */ rec) => !!rec && orgOf(rec) === only;
        /* A person belongs to every space they are a member of, not only
           their first, so a space's export keeps a teacher who joined it
           from elsewhere (0.580, audit finding 3). */
        const keepMember = (/** @type {any} */ rec) => !!rec && memberOf(rec).includes(only);
        const pick = async (
          /** @type {string[]} */ ids,
          /** @type {(id: string) => string} */ keyOf,
          /** @type {(rec: any) => boolean} */ test = keep,
        ) =>
          only ? (await readManyJson(store, ids.map(keyOf))).map((r, i) => (test(r) ? ids[i] : null)).filter((x) => x !== null) : ids;
        const handles = /** @type {string[]} */ (await pick(await readIndex(store, "users"), K.user, keepMember));
        /* Former accounts: their cards stay live for students, so they stay
           in the backup too, with their list of cards and their numbers
           (0.580, audit finding 2). For one space, those who left it. */
        const goneHandles = /** @type {string[]} */ (only
          ? (await Promise.all((await readIndex(store, "gone")).map(async (h) => ((await readJson(store, K.gone(h))) || {}).org === only ? h : null))).filter((h) => h !== null)
          : await readIndex(store, "gone"));
        const owners = [...new Set([...handles, ...goneHandles])];
        const courseIds = /** @type {string[]} */ (await pick(await readIndex(store, "courses"), K.course));
        const deckIds = /** @type {string[]} */ (await pick(await readIndex(store, "decks"), K.deck));
        /* Reports were the one thing on the site a backup did not hold, so
           a restore quietly threw away every problem anybody had reported
           and not yet fixed. They are small and they are somebody's words
           about a card that is in the file beside them. */
        const flagIds = /** @type {string[]} */ (await pick(await readIndex(store, "flags"), K.flag));
        /* And the spaces, with every address each has had (0.542). */
        const orgIds = only ? [only] : await readIndex(store, "orgs");
        const orgDocs = (await readManyJson(store, orgIds.map((id) => K.org(id)))).filter(Boolean);
        const slugNames = [...new Set(orgDocs.flatMap((o) => [o.slug].concat(o.formerSlugs || [])).filter(Boolean))];

        /* Card ids come from each owner's list rather than a global index,
           which is where they actually live — and, for one space, from its
           decks too, which can hold an App admin's card. */
        const cardLists = await readManyJson(store, owners.map((h) => K.myCards(h)));
        /* Every deck's cards, for the whole site as for one space: a card
           can be in a deck and on nobody's list. */
        const deckCards = (await readManyJson(store, deckIds.map((id) => K.deck(id)))).flatMap((d) => (d && d.cardIds) || []);
        const cardIds = /** @type {string[]} */ (await pick([...new Set(cardLists.flatMap((l) => l || []).concat(deckCards))], K.card));

        /* Clip hashes are only discoverable from the cards that use them, so
           the cards have to be read to know what a complete backup contains.
           Only the hashes are kept here; the bytes travel in their own
           chunks. */
        const cards = await readManyJson(store, cardIds.map((id) => K.card(id)));

        /* A teacher's numbers and their clock, which belong to no deck and
           are therefore reachable from nothing above. Their recordings are
           in the same position as a card's — only the thing that refers to
           them says they exist — so the systems have to be read here for
           the backup to be complete. */
        const systemKeyLists = await Promise.all(owners.map((h) => systemKeysOf(store, h)));
        const systemKeys = systemKeyLists.flat();
        const systems = systemKeys.length ? await readManyJson(store, systemKeys) : [];
        const clipHashes = [
          ...new Set(
            cards
              .filter(Boolean)
              .flatMap(clipsOfCard)
              .concat(systems.filter(Boolean).flatMap(clipsOfSystem))
          ),
        ];
        /* And the pictures, reachable the same way: only from the cards. */
        const imageHashes = [...new Set(cards.filter(Boolean).flatMap(imagesOfCard))];

        /* Key hashes, so that restoring a backup leaves everyone's existing
           sign-in key working. The keys themselves are not stored anywhere
           and cannot be part of a backup. */
        const users = await readManyJson(store, handles.map((h) => K.user(h)));
        const keyHashes = users.filter(Boolean).map((u) => u.keyHash).filter(Boolean);

        /* Each person's practice (0.583; docs/PLAN-space-backup.md, 3), and
           the recordings it names. Keyed by handle rather than by key, on
           purpose: a new key moves the document, and a restore has to find
           the person's current one. For a space's file, every member's
           whole document (17a): one person has one across all their spaces.
           A former account has none — deleting it removes it. Not read for
           a space's usage, which is about the space's own material. */
        /** @type {string[]} */
        const progressHandles = [];
        /** @type {{ handle: string, id: string }[]} */
        const practiceAudio = [];
        if (action !== "admin-org-usage") {
          for (const u of users) {
            if (!u || !u.keyHash) continue;
            const text = await readSyncDoc(u.keyHash).catch(() => null);
            if (text == null) continue;
            progressHandles.push(u.handle);
            /** @type {any} */
            let doc = null;
            try {
              doc = JSON.parse(text);
            } catch (e) {
              doc = null;
            }
            for (const id of recordingIdsOf(doc)) practiceAudio.push({ handle: u.handle, id });
          }
        }

        /* Records are small and clips are not, so they are batched
           differently. These sizes keep a chunk well under the response
           limit even for long cards or a minute of audio. */
        /** @type {{ id: string, kind: string, keys: string[] }[]} */
        const chunks = [];
        /** @type {(kind: string, keys: string[], size: number) => void} */
        const batch = (kind, keys, size) => {
          for (let i = 0; i < keys.length; i += size) {
            chunks.push({ id: `${kind}-${chunks.length}`, kind, keys: keys.slice(i, i + size) });
          }
        };
        batch("user", handles.map(K.user), 40);
        batch("keymap", keyHashes.map(K.keyOf), 60);
        batch("course", courseIds.map(K.course), 40);
        batch("deck", deckIds.map(K.deck), 40);
        batch("owncards", owners.map(K.myCards), 60);
        batch("card", cardIds.map(K.card), 25);
        batch("system", systemKeys, 10);
        batch("mysystems", owners.map(K.mySystems), 60);
        batch("flag", flagIds.map(K.flag), 60);
        batch("org", orgIds.map(K.org), 60);
        batch("former", orgIds.map(K.former), 60);
        batch("gone", goneHandles.map(K.gone), 100);
        batch("progress", progressHandles.map((h) => `progress:${h}`), 1);
        batch("paudio", practiceAudio.map((a) => `paudio:${a.handle}:${a.id}`), 3);

        /* How much a space holds (60a): the counts, and the bytes of the
           recordings and pictures its cards and numbers use. One shared by
           two spaces counts in both. */
        const sizeOf = async (/** @type {string} */ key) => {
          if (typeof store.size === "function") return (await store.size(key)) || 0;
          const v = await store.get(key, { type: "text" }).catch(() => null);
          return v ? String(v).length : 0;
        };
        if (action === "admin-org-usage") {
          let bytes = 0;
          for (const h of clipHashes) bytes += await sizeOf(K.clip(h));
          for (const h of imageHashes) bytes += await sizeOf(K.image(h));
          return json({
            ok: true,
            usage: {
              people: handles.length, courses: courseIds.length, decks: deckIds.length,
              cards: cardIds.length, recordings: clipHashes.length, pictures: imageHashes.length, bytes,
            },
          });
        }
        batch("slug", slugNames.map(K.slug), 100);
        batch("clip", clipHashes.map(K.clip), 3);
        batch("image", imageHashes.map(K.image), 2);

        /* How many bytes each kind takes as stored (0.584), so the backup
           screen can say how large each part will make the file before it
           is downloaded. Read off the directory entries, not the records;
           a file holds the same text, give or take its punctuation. */
        const keyHashOf = new Map(users.filter(Boolean).map((u) => [u.handle, u.keyHash]));
        /** @type {Record<string, number>} */
        const bytes = {};
        for (const c of chunks) {
          let n = 0;
          for (const k of c.keys) {
            if (c.kind === "progress" || c.kind === "paudio") {
              const [, handle, id] = k.split(":");
              n += await syncSize(keyHashOf.get(handle) || "", c.kind === "paudio" ? id : undefined).catch(() => 0);
            } else {
              n += await sizeOf(k).catch(() => 0);
            }
          }
          bytes[c.kind] = (bytes[c.kind] || 0) + n;
        }

        return json({
          ok: true,
          manifest: {
            version: 1,
            takenAt: Date.now(),
            /* What the file is a backup of (0.583). A file without this was
               made before it existed and is taken as the site's. */
            scope: only
              ? { kind: "space", space: only, slug: (orgDocs[0] && orgDocs[0].slug) || "", name: (orgDocs[0] && orgDocs[0].name) || "" }
              : { kind: "site" },
            counts: {
              users: handles.length,
              courses: courseIds.length,
              decks: deckIds.length,
              cards: cardIds.length,
              systems: systemKeys.length,
              flags: flagIds.length,
              clips: clipHashes.length,
              images: imageHashes.length,
              keys: keyHashes.length,
              orgs: orgIds.length,
              progress: progressHandles.length,
              practiceAudio: practiceAudio.length,
            },
            indexes: { users: handles, courses: courseIds, decks: deckIds, flags: flagIds, orgs: orgIds, gone: goneHandles },
            bytes,
            chunks: chunks.map((c) => ({ id: c.id, kind: c.kind, keys: c.keys.length })),
            /* Repeated so a chunk can be fetched without the client having to
               reconstruct which keys were in it. */
            plan: chunks,
          },
        });
      }

      if (action === "admin-backup-chunk") {
        const keys = Array.isArray(body.keys) ? body.keys.slice(0, 200) : [];
        if (!keys.length) return json({ error: "no-keys" }, 400);
        /* Clips are stored as plain text, not JSON. Parsing them as JSON
           silently dropped every recording from every backup. */
        /* Practice lives in the sync store, under a hash of the person's
           key: found here from their handle (0.583). Text, like a clip. */
        const fromSync = async (/** @type {string} */ k) => {
          const [kind, handle, id] = k.split(":");
          const u = await readJson(store, K.user(handle || ""));
          if (!u || !u.keyHash) return null;
          return kind === "progress" ? readSyncDoc(u.keyHash) : readSyncAudio(u.keyHash, id || "");
        };
        const values = await Promise.all(
          keys.map((/** @type {string} */ k) =>
            k.startsWith("progress:") || k.startsWith("paudio:")
              ? fromSync(k)
              : k.startsWith("clip:") || k.startsWith("image:")
              ? store.get(k, { type: "text" }).catch(() => null)
              : readJson(store, k)
          )
        );
        /** @type {Record<string, any>} */
        const records = {};
        keys.forEach((/** @type {string} */ k, /** @type {number} */ i) => {
          if (values[i] !== null && values[i] !== undefined) records[k] = values[i];
        });
        /* A digest of what this chunk actually contains, so a finished file
           can be checked against its own manifest later. */
        const digest = sha(JSON.stringify(records));
        return json({ ok: true, records, digest, found: Object.keys(records).length });
      }

      /* Putting a backup back (0.583; docs/PLAN-space-backup.md, B5): the
         whole site's file or one space's, through one engine. Each record
         is decided from the site as it is when it is written — never from
         what a preview said a moment before — and only ever added: a
         record already here is left exactly as it is, and a list gains
         what it lacks. Every record not written comes back with why. The
         app sends the file in its own order, people first, and the
         indexes last. */
      if (action === "admin-restore-chunk") {
        const records =
          body.records && typeof body.records === "object" && !Array.isArray(body.records)
            ? body.records
            : {};
        const keys = Object.keys(records).slice(0, 200);
        if (!keys.length) return json({ error: "no-keys" }, 400);
        const options = restoreOptions(body.options);
        const fileUsers = keys
          .filter((k) => k.startsWith("user:") && records[k] && typeof records[k] === "object")
          .map((k) => ({ ...records[k], handle: k.slice(5) }));
        const verdicts = await restoreVerdicts(store, fileUsers, options);
        let written = 0;
        let merged = 0;
        /** @type {{ key: string, why: string }[]} */
        const skipped = [];
        let skippedMore = 0;
        const skip = (/** @type {string} */ key, /** @type {string} */ why) => {
          if (skipped.length < 500) skipped.push({ key, why });
          else skippedMore += 1;
        };
        for (const k of keys) {
          /** @type {Outcome} */
          let r;
          try {
            r = await restoreOne(store, k, records[k], { options, verdicts, into: acting });
          } catch (e) {
            console.error(`restore: ${k}: ${String((e && /** @type {any} */ (e).message) || e)}`);
            r = { outcome: "skipped", why: "error" };
          }
          if (r.outcome === "written") written += 1;
          else if (r.outcome === "merged") merged += 1;
          else skip(k, r.why || "exists");
          for (const a of r.also || []) skip(a.key, a.why);
        }
        return json({ ok: true, written, merged, skipped, skippedMore });
      }

      /* What a restore would do, before anything is written (B6): who it
         leaves alone, who it re-creates, whose names come off restored
         courses, which spaces it makes, and how much material it adds. It
         writes nothing. The app sends only the fields named here, never
         the file's records whole. */
      if (action === "admin-restore-preview") {
        const options = restoreOptions(body.options);
        const list = (/** @type {any} */ v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
        const fileUsers = list(body.users).filter((u) => typeof u.handle === "string" && u.handle);
        const verdicts = await restoreVerdicts(store, fileUsers, options);
        const nameOf = new Map(fileUsers.map((u) => [u.handle, String(u.displayName || u.handle)]));
        /** @type {Record<string, any[]>} */
        const people = { kept: [], notMember: [], deleted: [], recreate: [], otherPerson: [] };
        for (const [handle, v] of verdicts) {
          const who = { handle, displayName: nameOf.get(handle) || handle };
          if (v.kind === "kept") people.kept.push(who);
          else if (v.kind === "not-member") people.notMember.push(who);
          else if (v.kind === "deleted") people.deleted.push({ ...who, at: v.at });
          else if (v.kind === "recreate") people.recreate.push({ ...who, orgs: v.orgs });
          else people.otherPerson.push(who);
        }
        /* Rosters a restored course would lose names from: anyone who will
           not be a member of the course's space, counting the people this
           restore re-creates as members-to-be. */
        /** @type {Map<string, any>} */
        const usersNow = new Map();
        const staysOn = async (/** @type {string} */ h, /** @type {string} */ org) => {
          const v = verdicts.get(h);
          if (v && v.kind === "recreate") return v.orgs.includes(org);
          if (v && v.kind === "other-person") return false;
          if (!usersNow.has(h)) usersNow.set(h, await readJson(store, K.user(h)));
          return memberHere(usersNow.get(h), org);
        };
        /** @type {{ course: string, title: string, dropped: string[] }[]} */
        const rosters = [];
        for (const c of list(body.courses)) {
          const id = String(c.id || "");
          if (!id || (await store.has(K.course(id)))) continue;
          const org = orgOf(c);
          /** @type {string[]} */
          const dropped = [];
          for (const h of [].concat(Array.isArray(c.teachers) ? c.teachers : [], Array.isArray(c.students) ? c.students : [])) {
            if (!(await staysOn(String(h), org)) && !dropped.includes(String(h))) dropped.push(String(h));
          }
          if (dropped.length) rosters.push({ course: id, title: String(c.title || ""), dropped });
        }
        /** @type {any[]} */
        const spaces = [];
        /** @type {string[]} */
        const blockers = [];
        for (const o of list(body.orgs)) {
          const id = String(o.id || "");
          if (!id) continue;
          const here = await readJson(store, K.org(id));
          const slug = String(o.slug || "");
          const owner = slug ? await readJson(store, K.slug(slug)) : null;
          const slugTaken = !here && !!owner && owner !== id;
          const takenBy = slugTaken ? ((await readJson(store, K.org(String(owner)))) || {}).name || String(owner) : "";
          let newSlugProblem = "";
          if (slugTaken) {
            const wanted = options.newSlugs[id] || "";
            if (!wanted) newSlugProblem = "missing";
            else if (slugProblem(wanted)) newSlugProblem = "invalid";
            else if (await readJson(store, K.slug(wanted))) newSlugProblem = "taken";
            if (newSlugProblem) {
              blockers.push(`The address “${slug}” of ${String(o.name || id)} now belongs to ${takenBy}. Give it a new address to go on.`);
            }
          }
          spaces.push({
            id, name: here ? here.name : String(o.name || ""), slug: here ? here.slug : slug,
            exists: !!here, slugTaken, takenBy, newSlugProblem,
          });
        }
        const keysOf = (/** @type {any} */ v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x) : []);
        const k = body.keys && typeof body.keys === "object" ? body.keys : {};
        /** @type {Record<string, { add: number, have: number }>} */
        const material = {};
        for (const [what, recordOf] of /** @type {[string, (id: string) => string][]} */ ([
          ["cards", K.card], ["decks", K.deck], ["courses", K.course], ["flags", K.flag],
        ])) {
          let have = 0;
          const ids = [...new Set(keysOf(k[what]))];
          for (const id of ids) if (await store.has(recordOf(id))) have += 1;
          material[what] = { add: ids.length - have, have };
        }
        if (people.otherPerson.length) {
          blockers.unshift(
            `${people.otherPerson.map((p) => p.displayName).join(", ")}: the name now belongs to someone else on the site, so nothing of theirs can be put back.`
          );
        }
        const scope = options.scope;
        if (scope.kind === "space" && body.fileScope && typeof body.fileScope === "object" && body.fileScope.space && body.fileScope.space !== scope.space) {
          blockers.push("This file is a backup of a different space.");
        }
        return json({ ok: true, people, rosters, spaces, material, blockers });
      }

      /* ================= clearing =================

         The other end of a restore, and the only endpoint on the site that
         removes things wholesale. Two locks, because being signed in as an
         administrator is a thing a borrowed phone is: the account has to be
         an administrator, and the request has to carry the deploy's own
         admin key — the same secret that makes someone an administrator in
         the first place, which lives in the environment and not on the
         site.

         The acting administrator's own account is kept even when people are
         being cleared. Deleting it mid-request would leave the site with no
         way in but a fresh signup, and the whole point of asking for the
         key is that the person holding it meant this. One account is easy
         to remove afterwards from People; a site nobody can sign in to is
         not easy to do anything with. */
      if (action === "admin-clear") {
        if (!me.admin) return json({ error: "admin-only" }, 403);
        if (!process.env.ADMIN_KEY || String(body.adminKey || "") !== process.env.ADMIN_KEY) {
          return json({ error: "bad-key" }, 403);
        }
        const want = new Set(
          (Array.isArray(body.parts) ? body.parts : []).map((/** @type {unknown} */ p) => String(p))
        );
        if (!want.size) return json({ error: "nothing-chosen" }, 400);

        const handles = await readIndex(store, "users");
        const courseIds = await readIndex(store, "courses");
        const deckIds = await readIndex(store, "decks");
        const cardLists = await readManyJson(store, handles.map((h) => K.myCards(h)));
        const cardIds = [...new Set(cardLists.flatMap((l) => l || []))];

        /** @type {Record<string, number>} */
        const removed = { users: 0, courses: 0, decks: 0, cards: 0, systems: 0, flags: 0, clips: 0, progress: 0 };

        /* Read before anything is deleted, for the same reason the cards
           are: a system's recordings are only reachable through it. */
        const systemKeyLists = await Promise.all(handles.map((h) => systemKeysOf(store, h)));
        const systemKeys = systemKeyLists.flat();

        /* Reports go on their own say-so rather than with the cards they
           are about: a report outlives its card by design — that is why it
           carries a copy of the question — and clearing the cards to start
           a site again should not silently take the list of what was wrong
           with the last one. */
        if (want.has("flags")) {
          for (const id of await readIndex(store, "flags")) {
            await store.delete(K.flag(id));
            removed.flags += 1;
          }
          await writeJson(store, K.index("flags"), []);
        }

        /* A recording is only reachable through the cards that use it, so
           they are read before anything is deleted — clearing cards first
           would strand every clip on the site with nothing left pointing
           at it. */
        if (want.has("clips")) {
          const cards = await readManyJson(store, cardIds.map((id) => K.card(id)));
          const systems = systemKeys.length ? await readManyJson(store, systemKeys) : [];
          const hashes = [
            ...new Set(
              cards
                .filter(Boolean)
                .flatMap(clipsOfCard)
                .concat(systems.filter(Boolean).flatMap(clipsOfSystem))
            ),
          ];
          for (const h of hashes) {
            await store.delete(K.clip(h));
            CLIPS_HERE.delete(h);
            removed.clips += 1;
          }
          /* The pictures go with the recordings: both are a card's media,
             reachable only from the cards, and cleared before them. */
          for (const h of [...new Set(cards.filter(Boolean).flatMap(imagesOfCard))]) {
            await store.delete(K.image(h));
            IMAGES_HERE.delete(h);
          }
        }

        if (want.has("cards")) {
          for (const id of cardIds) {
            await store.delete(K.card(id));
            removed.cards += 1;
          }
          /* The lists that say who owns what are part of the cards, not of
             the people: without them a card is unreachable anyway. */
          for (const h of handles) await store.delete(K.myCards(h));
        }

        /* The numbers a teacher wrote go with the cards, because that is
           what they are: the material, minus the decks it is filed in. */
        if (want.has("cards")) {
          for (const key of systemKeys) {
            await store.delete(key).catch(() => {});
            removed.systems += 1;
          }
          for (const h of handles) await store.delete(K.mySystems(h)).catch(() => {});
          /* And the stamp saying their tags were tidied, so cards written
             after a clear are looked at again. */
          for (const h of handles) await store.delete(K.tagLift(h)).catch(() => {});
        }

        if (want.has("decks")) {
          for (const id of deckIds) {
            await store.delete(K.deck(id));
            removed.decks += 1;
          }
          await writeJson(store, K.index("decks"), []);
        }

        if (want.has("courses")) {
          const courses = await readManyJson(store, courseIds.map((id) => K.course(id)));
          /* The join codes with them: a code is a key of its own pointing at
             a course, and one left behind would point at nothing. */
          for (const c of courses) {
            if (!c) continue;
            if (c.code) await store.delete(K.code(c.code));
            if (c.teacherCode) await store.delete(K.code(c.teacherCode));
          }
          for (const id of courseIds) {
            await store.delete(K.course(id));
            removed.courses += 1;
          }
          await writeJson(store, K.index("courses"), []);
        }

        /* People's practice (0.583): the one place on the site that removes
           it, behind the same two locks. Before people, whose key hashes
           are what finds it. */
        if (want.has("progress")) {
          for (const u of await readManyJson(store, handles.map((h) => K.user(h)))) {
            if (!u || !u.keyHash || (await readSyncDoc(u.keyHash).catch(() => null)) == null) continue;
            await forgetSyncDoc(u.keyHash);
            removed.progress += 1;
          }
        }

        if (want.has("people")) {
          const users = await readManyJson(store, handles.map((h) => K.user(h)));
          for (const u of users) {
            if (!u || u.handle === mine) continue;
            if (u.keyHash) await store.delete(K.keyOf(u.keyHash));
            await store.delete(K.user(u.handle));
            await store.delete(K.myCards(u.handle));
            removed.users += 1;
          }
          await writeJson(store, K.index("users"), handles.includes(mine) ? [mine] : []);
        }

        return json({ ok: true, removed, kept: want.has("people") ? mine : "" });
      }

      /* Suspending someone (64a) and reactivating them (67a): a space
         admin for people in their space, but never another space admin or
         an App admin — those are the App admin's (70a). */
      if (action === "admin-suspend-user" || action === "admin-reactivate-user" || action === "admin-remove-member") {
        const handle = String(body.handle || "");
        const target = await readUser(store, handle);
        if (!target) return json({ error: "no-user" }, 404);
        if (handle === mine) return json({ error: "not-yourself" }, 400);
        if (target.admin) return json({ error: "admin-only" }, 403);
        if (!iAmAdmin && (actingOrgDoc.admins || []).includes(handle)) return json({ error: "admin-only" }, 403);
        /* In this space only (memberships): the person's other spaces are
           untouched either way. */
        /* Suspended: still listed in the space, the admin's to lift
           (0.578). Removed: off the list, under Former members, back with an
           invitation or a code. */
        if (action === "admin-suspend-user") {
          if (suspensionIn(target, acting)) return json({ ok: true });
          await suspend(target, "suspended", mine);
          return json({ ok: true });
        }
        if (action === "admin-remove-member") {
          const was = suspensionIn(target, acting);
          if (was && was.why !== "suspended") return json({ ok: true });
          await suspend(target, "removed", mine);
          return json({ ok: true });
        }
        if (!suspensionIn(target, acting)) return json({ ok: true });
        /* Back on their courses here, off Former members: the same walk a
           rejoin takes. */
        await addMembership(store, handle, acting);
        return json({ ok: true });
      }

      /* A new invitation link for the space (37a): the old one stops working. */
      if (action === "admin-new-invite") {
        const code = makeCode();
        const old = actingOrgDoc.inviteCode;
        await updateJson(store, K.org(acting), (/** @type {any} */ o) => (o ? { ...o, inviteCode: code } : null));
        await writeJson(store, K.code(code), `org:${acting}`);
        if (old) await store.delete(K.code(old)).catch(() => {});
        return json({ ok: true, inviteCode: code });
      }

      /* A former member's material, handed to someone still here (31a, 85a):
         every deck and card they made for the space, never their numbers
         (79a) — decks keep using those. */
      if (action === "admin-hand-over") {
        const from = String(body.from || "");
        const to = String(body.to || "");
        const former = (await readJson(store, K.former(acting))) || [];
        if (!former.some((/** @type {any} */ r) => r.handle === from)) return json({ error: "not-former" }, 400);
        const heir = await readUser(store, to);
        if (!heir || suspensionIn(heir, acting)) return json({ error: "not-in-space" }, 400);
        const deckIds = await readIndex(store, "decks");
        const decks = here(await readManyJson(store, deckIds.map((id) => K.deck(id)))).filter(
          (d) => d && d.owner === from && !d.personal
        );
        for (const d of decks) {
          await updateJson(store, K.deck(d.id), (/** @type {any} */ f) => (f ? { ...f, owner: to, updated: Date.now() } : null));
        }
        const theirs = (await readJson(store, K.myCards(from))) || [];
        const cards = here(await readManyJson(store, theirs.map((/** @type {string} */ id) => K.card(id)))).filter(
          (c) => c && c.owner === from && !c.personal
        );
        for (const c of cards) {
          await updateJson(store, K.card(c.id), (/** @type {any} */ f) => (f ? { ...f, owner: to } : null));
        }
        const moved = new Set(cards.map((c) => c.id));
        await updateJson(store, K.myCards(from), (/** @type {any} */ cur) => (cur || []).filter((/** @type {string} */ x) => !moved.has(x)));
        await updateJson(store, K.myCards(to), (/** @type {any} */ cur) => [...new Set((cur || []).concat([...moved]))]);
        return json({ ok: true, decks: decks.length, cards: cards.length });
      }

      /* Taking one record off Former members, by hand, when asked (A5). */
      if (action === "admin-remove-former") {
        if (!iAmAdmin) return json({ error: "admin-only" }, 403);
        const handle = String(body.handle || "");
        await updateJson(store, K.former(acting), (/** @type {any} */ cur) =>
          (cur || []).filter((/** @type {any} */ r) => r.handle !== handle)
        );
        return json({ ok: true });
      }

      /*
       * Deleting a former member for good (0.552), from Former members, by
       * a space admin or the App admin. Someone who left or was removed is
       * only suspended: their account goes now, the way admin-delete-user
       * takes it. Then everything they made in this space — decks and
       * cards, the space's as well as their own — and last their entry on
       * the list. Reports they sent stay, under the name they carry.
       */
      if (action === "admin-purge-former") {
        const handle = String(body.handle || "");
        if (!handle || handle === mine) return json({ error: "no-user" }, 400);
        const list = (await readJson(store, K.former(acting))) || [];
        if (!list.some((/** @type {any} */ r) => r.handle === handle)) return json({ error: "not-former" }, 404);
        /* An account is deleted only from Super admin → People (0.578):
           here, only what is left of someone whose account is gone. */
        if (await readJson(store, K.user(handle))) return json({ error: "account-exists" }, 400);
        /* Their decks first, off every course that holds them. */
        const deckIds = await readIndex(store, "decks");
        const theirDecks = here(await readManyJson(store, deckIds.map((id) => K.deck(id))))
          .filter((d) => d && d.owner === handle);
        for (const d of theirDecks) {
          await dropFromCourses(store, d.id);
          await store.delete(K.deck(d.id)).catch(() => {});
          await store.delete(K.cards(d.id)).catch(() => {});
        }
        if (theirDecks.length) {
          const goneDecks = new Set(theirDecks.map((d) => d.id));
          await updateJson(store, K.index("decks"), (/** @type {any} */ cur) =>
            (cur || []).filter((/** @type {string} */ x) => !goneDecks.has(x))
          );
        }
        /* Then their cards, out of whatever decks of others still hold them. */
        const cardIds = (await readJson(store, K.myCards(handle))) || [];
        let cards = 0;
        for (let i = 0; i < cardIds.length; i += 100) {
          cards += (await deleteCards(cardIds.slice(i, i + 100))).deleted.length;
        }
        /* Their list of cards goes with them, unless they are in another
           space whose cards it also lists (memberships): deleteCards has
           already taken this space's out of it. */
        const listOwner = await readJson(store, K.user(handle));
        if (!listOwner || memberOf(listOwner).length < 2) await store.delete(K.myCards(handle)).catch(() => {});
        /* The account itself, where it is still there (left or removed) —
           or, for someone also in another space, only their place in this
           one (memberships): the rest of the account is not this space's. */
        const still = await readUser(store, handle);
        if (still && memberOf(still).length > 1) {
          await removeMembership(store, handle, acting, { why: "deleted-by-admin", by: mine, former: false });
        } else if (still) {
          await wipeAccount(store, handle, { by: mine });
        }
        await updateJson(store, K.former(acting), (/** @type {any} */ cur) =>
          (cur || []).filter((/** @type {any} */ r) => r.handle !== handle)
        );
        if (theirDecks.length || cards) await taught();
        return json({ ok: true, decks: theirDecks.length, cards });
      }

      /* Dismissing feedback about the app (0.552): the App admin's alone. */
      if (action === "admin-delete-feedback") {
        const wanted = new Set((Array.isArray(body.ids) ? body.ids : []).map(String));
        if (!wanted.size) return json({ ok: true, deleted: 0 });
        const ids = await readIndex(store, "feedback");
        for (const id of ids) if (wanted.has(id)) await store.delete(K.feedback(id)).catch(() => {});
        await updateJson(store, K.index("feedback"), (/** @type {string[] | null} */ cur) =>
          (cur || []).filter((id) => !wanted.has(id)));
        return json({ ok: true, deleted: ids.filter((id) => wanted.has(id)).length });
      }

      /*
       * A new space, with its first space admin (65a), whose key is
       * returned once — the way admin-create-user hands one over.
       */
      if (action === "admin-create-org") {
        const name = String(body.name || "").trim().slice(0, 60);
        if (!name) return json({ error: "name-required" }, 400);
        const slug = String(body.slug || "").trim().toLowerCase();
        const problem = slugProblem(slug);
        if (problem) return json({ error: problem }, 400);
        /* The App admin as the new space's admin (0.552): no account to
           make and no key to hand over. */
        const selfAdmin = body.selfAdmin === true;
        const adminName = String(body.adminName || "").trim().slice(0, 40);
        if (!selfAdmin && !adminName) return json({ error: "name-required" }, 400);
        const id = `o${randomBytes(6).toString("hex")}`;
        /* The address first: taking it is what can fail, and it is never
           given back (8b). */
        const took = await updateJson(store, K.slug(slug), (/** @type {any} */ cur) => (cur ? null : id));
        if (took !== id) return json({ error: "slug-taken" }, 409);

        /** @type {any} */
        let user = { handle: mine, displayName: me.displayName || mine, admin: true, org: orgOf(me) };
        let key = "";
        if (!selfAdmin) {
          const handles = await readIndex(store, "users");
          const handle = makeHandle(adminName, handles.concat(await readIndex(store, "gone")));
          key = makeKey();
          user = {
            handle,
            displayName: adminName,
            admin: false,
            org: id,
            orgs: [id],
            created: Date.now(),
            lastSeen: 0,
            keySaved: false,
            createdBy: mine,
          };
          await writeJson(store, K.user(handle), { ...user, keyHash: sha(key) });
          await writeJson(store, K.keyOf(sha(key)), handle);
          await updateJson(store, K.index("users"), (/** @type {any} */ cur) => (cur || []).concat([handle]));
        }

        const inviteCode = makeCode();
        const org = {
          id,
          slug,
          formerSlugs: [],
          name,
          logo: /^[a-f0-9]{64}$/.test(String(body.logo || "")) ? String(body.logo) : "",
          colour: colourOf(body.colour),
          admins: [user.handle],
          inviteCode,
          created: Date.now(),
        };
        await writeJson(store, K.org(id), org);
        await writeJson(store, K.code(inviteCode), `org:${id}`);
        await updateJson(store, K.index("orgs"), (/** @type {any} */ cur) =>
          (cur || []).includes(id) ? null : (cur || []).concat([id])
        );
        return json({ ok: true, org, admin: user, key });
      }

      /*
       * Super admin (0.547): everyone in every space, and every space's
       * reports — the App admin's alone. Acting on one of them goes through
       * the ordinary actions, sent with that person's or report's space as
       * x-org.
       */
      if (action === "admin-everyone" || action === "admin-all-reports") {
        if (!iAmAdmin) return json({ error: "admin-only" }, 403);
        const orgIds = await readIndex(store, "orgs");
        const orgs = (await readManyJson(store, orgIds.map((id) => K.org(id)))).filter(Boolean)
          .map((o) => ({ id: o.id, name: o.name, slug: o.slug, admins: o.admins || [], archived: !!o.archived }));
        if (action === "admin-everyone") {
          const rows = (await readManyJson(store, (await readIndex(store, "users")).map((h) => K.user(h)))).filter(Boolean);
          /* Every space each person is in, and their account-wide moments
             (memberships, A2): Super admin sees the whole account. */
          const people = rows.map((u) => {
            const norm = normalisedUser(u);
            return { ...withoutMemberships(u), suspended: undefined, org: orgOf(u), orgs: norm.orgs, suspendedIn: norm.suspendedIn };
          });
          return json({ ok: true, orgs, people });
        }
        const flags = (await readManyJson(store, (await readIndex(store, "flags")).map((x) => K.flag(x))))
          .filter(Boolean)
          .map((f) => ({ ...f, org: orgOf(f) }));
        /* And feedback about the app (0.552), which is only ever read here. */
        const feedback = (await readManyJson(store, (await readIndex(store, "feedback")).map((x) => K.feedback(x))))
          .filter(Boolean);
        return json({ ok: true, orgs, flags, feedback });
      }

      /* Every space, for the Spaces tab: App admins only. */
      if (action === "admin-orgs") {
        if (!iAmAdmin) return json({ error: "admin-only" }, 403);
        const ids = await readIndex(store, "orgs");
        const orgs = (await readManyJson(store, ids.map((id) => K.org(id)))).filter(Boolean);
        const users = (await readManyJson(store, (await readIndex(store, "users")).map((h) => K.user(h)))).filter(Boolean);
        return json({
          ok: true,
          orgs: orgs.map((o) => ({
            ...o,
            people: users.filter((u) => memberOf(u).includes(o.id)).map((u) => ({ handle: u.handle, displayName: u.displayName })),
          })),
        });
      }

      /* A space's name, address, logo and colour (21a), App admins only.
         A new address keeps the old one forwarding, for ever (8b). */
      if (action === "admin-update-org") {
        if (!iAmAdmin) return json({ error: "admin-only" }, 403);
        const id = String(body.id || "");
        const org = await readJson(store, K.org(id));
        if (!org) return json({ error: "no-space" }, 404);
        const slug = body.slug === undefined ? org.slug : String(body.slug || "").trim().toLowerCase();
        /* Main's address changes like any other's (0.560); its old one
           forwards, as every space's does. */
        if (slug !== org.slug) {
          const problem = slugProblem(slug);
          if (problem) return json({ error: problem }, 400);
          const took = await updateJson(store, K.slug(slug), (/** @type {any} */ cur) => (cur ? null : id));
          if (took !== id) return json({ error: "slug-taken" }, 409);
        }
        const next = await updateJson(store, K.org(id), (/** @type {any} */ o) => {
          if (!o) return null;
          const moved = slug !== o.slug;
          return {
            ...o,
            ...(body.name !== undefined && String(body.name).trim() ? { name: String(body.name).trim().slice(0, 60) } : {}),
            ...(body.logo !== undefined ? { logo: /^[a-f0-9]{64}$/.test(String(body.logo || "")) ? String(body.logo) : "" } : {}),
            ...(body.colour !== undefined ? { colour: colourOf(body.colour) } : {}),
            ...(moved ? { slug, formerSlugs: [...new Set((o.formerSlugs || []).concat([o.slug]))] } : {}),
          };
        });
        return json({ ok: true, org: next });
      }

      /*
       * Putting an existing person into a space (memberships, A2): the App
       * admin's alone. No key changes hands — theirs now opens the space
       * too. Someone who left it, or was removed from it, is put back as a
       * reactivation: the App admin outranks whoever removed them. An App
       * admin's own account is never in a space this way (35a).
       */
      if (action === "admin-add-member") {
        if (!iAmAdmin) return json({ error: "admin-only" }, 403);
        const handle = String(body.handle || "");
        const id = String(body.org || "");
        const org = await readJson(store, K.org(id));
        if (!org) return json({ error: "no-space" }, 404);
        if (org.archived) return json({ error: "space-closed" }, 403);
        /* Unscoped: they may be in no space this request acts in. */
        const target = await readJson(store, K.user(handle));
        /* The App admin may add themselves too (0.575): then the space is
           one of theirs, not one they only try. */
        if (!target) return json({ error: "no-user" }, 404);
        const fresh = await addMembership(store, handle, id);
        if (!fresh) return json({ error: "no-user" }, 404);
        return json({ ok: true, orgs: memberOf(fresh) });
      }

      /* Who runs a space (36a): someone in it, not suspended. */
      if (action === "admin-org-admins") {
        if (!iAmAdmin) return json({ error: "admin-only" }, 403);
        const id = String(body.id || "");
        if (!(await readJson(store, K.org(id)))) return json({ error: "no-space" }, 404);
        const add = String(body.add || "");
        const remove = String(body.remove || "");
        if (add) {
          const u = await readJson(store, K.user(add));
          if (!u || !memberOf(u).includes(id) || suspensionIn(u, id)) return json({ error: "not-in-space" }, 400);
        }
        const next = await updateJson(store, K.org(id), (/** @type {any} */ o) => {
          if (!o) return null;
          let admins = (o.admins || []).filter((/** @type {string} */ h) => h !== remove);
          if (add && !admins.includes(add)) admins = admins.concat([add]);
          return { ...o, admins };
        });
        return json({ ok: true, org: next });
      }

      /* Closing a space, and opening it again (22a, 62a). Main is a space
         like any other (0.560); what can't be closed is the space your own
         account is in, which would close you out of the app. */
      if (action === "admin-archive-org" || action === "admin-reopen-org") {
        if (!iAmAdmin) return json({ error: "admin-only" }, 403);
        const id = String(body.id || "");
        if (action === "admin-archive-org" && memberOf(me).includes(id)) return json({ error: "own-space" }, 400);
        const next = await updateJson(store, K.org(id), (/** @type {any} */ o) => {
          if (!o) return null;
          const { archived: _was, ...rest } = o;
          return action === "admin-archive-org" ? { ...rest, archived: Date.now() } : rest;
        });
        if (!next) return json({ error: "no-space" }, 404);
        return json({ ok: true, org: next });
      }

      /*
       * Deleting a space for good (93b): its accounts (each with its practice
       * history), courses and their codes, decks, cards, reports, invite code
       * and every address it has had, which are then free again. Main can
       * go like any other (0.560), but never the space your own account is
       * in: you would be among the accounts deleted. The name has to be typed. Recordings and pictures are left: they
       * are shared by content across spaces, and one left behind costs
       * storage, where one deleted wrongly costs another space its audio.
       */
      if (action === "admin-delete-org") {
        if (!iAmAdmin) return json({ error: "admin-only" }, 403);
        const id = String(body.id || "");
        if (memberOf(me).includes(id)) return json({ error: "own-space" }, 400);
        const org = await readJson(store, K.org(id));
        if (!org) return json({ error: "no-space" }, 404);
        if (String(body.confirm || "") !== org.name) return json({ error: "confirm-name" }, 400);
        const scopeNow = orgScope.getStore();
        if (scopeNow) scopeNow.org = id;

        const handles = await readIndex(store, "users");
        const users = (await readManyJson(store, handles.map((h) => K.user(h)))).filter((u) => u && memberOf(u).includes(id));
        /* Every card of this org, gathered before any account goes: from
           its decks, and from everyone's own lists (a card can be in no
           deck, and an App admin's card can be in this org). */
        const decksBefore = (await readManyJson(store, (await readIndex(store, "decks")).map((x) => K.deck(x)))).filter((d) => d && orgOf(d) === id);
        const cardIds = new Set(decksBefore.flatMap((d) => d.cardIds || []));
        for (const list of await readManyJson(store, handles.map((h) => K.myCards(h)))) {
          for (const cid of list || []) cardIds.add(cid);
        }
        /* An account in this space alone goes; one also in another loses
           only this space, keeping the rest (memberships). */
        for (const u of users) {
          if (memberOf(u).length > 1) {
            await removeMembership(store, u.handle, id, { former: false });
            continue;
          }
          await wipeAccount(store, u.handle);
          await store.delete(K.myCards(u.handle)).catch(() => {});
        }

        for (const c of (await readManyJson(store, (await readIndex(store, "courses")).map((x) => K.course(x)))).filter((c) => c && orgOf(c) === id)) {
          for (const code of [c.code, c.teacherCode].filter(Boolean)) await store.delete(K.code(code)).catch(() => {});
          await store.delete(K.course(c.id)).catch(() => {});
          await updateJson(store, K.index("courses"), (/** @type {any} */ cur) => (cur || []).filter((/** @type {string} */ x) => x !== c.id));
        }
        const decks = (await readManyJson(store, (await readIndex(store, "decks")).map((x) => K.deck(x)))).filter((d) => d && orgOf(d) === id);
        for (const cid of cardIds) {
          const c = await readJson(store, K.card(cid));
          if (c && orgOf(c) === id) await store.delete(K.card(cid)).catch(() => {});
        }
        for (const d of decks) await store.delete(K.deck(d.id)).catch(() => {});
        await updateJson(store, K.index("decks"), (/** @type {any} */ cur) =>
          (cur || []).filter((/** @type {string} */ x) => !decks.some((d) => d.id === x))
        );
        const flagIds = await readIndex(store, "flags");
        const flags = await readManyJson(store, flagIds.map((x) => K.flag(x)));
        const goneFlags = flagIds.filter((_, i) => flags[i] && orgOf(flags[i]) === id);
        for (const f of goneFlags) await store.delete(K.flag(f)).catch(() => {});
        await updateJson(store, K.index("flags"), (/** @type {any} */ cur) => (cur || []).filter((/** @type {string} */ x) => !goneFlags.includes(x)));

        await store.delete(K.former(id)).catch(() => {});
        const goneHandles = await readIndex(store, "gone");
        /** @type {string[]} */
        const goneHere = [];
        for (const h of goneHandles) {
          const g = await readJson(store, K.gone(h));
          if (!g) continue;
          const theirs = Array.isArray(g.orgs) ? g.orgs : [g.org];
          if (!theirs.includes(id)) continue;
          const left = theirs.filter((/** @type {string} */ x) => x !== id);
          if (left.length) {
            await writeJson(store, K.gone(h), { ...g, org: g.org === id ? left[0] : g.org, orgs: left });
          } else {
            goneHere.push(h);
            await store.delete(K.gone(h)).catch(() => {});
          }
        }
        await updateJson(store, K.index("gone"), (/** @type {any} */ cur) => (cur || []).filter((/** @type {string} */ x) => !goneHere.includes(x)));
        if (org.inviteCode) await store.delete(K.code(org.inviteCode)).catch(() => {});
        for (const slug of [org.slug].concat(org.formerSlugs || [])) await store.delete(K.slug(slug)).catch(() => {});
        await store.delete(K.org(id)).catch(() => {});
        await updateJson(store, K.index("orgs"), (/** @type {any} */ cur) => (cur || []).filter((/** @type {string} */ x) => x !== id));
        return json({ ok: true, deleted: { people: users.length, decks: decks.length } });
      }

      if (action === "admin-create-user") {
        const displayName = String(body.displayName || "").trim().slice(0, 40);
        if (!displayName) return json({ error: "name-required" }, 400);

        const handles = await readIndex(store, "users");
        const handle = makeHandle(displayName, handles.concat(await readIndex(store, "gone")));
        const key = makeKey();
        const user = {
          handle,
          displayName,
          admin: false,
          org: acting,
          orgs: [acting],
          created: Date.now(),
          /* Never seen: they haven't signed in yet. The people list uses
             this to show who still hasn't picked up their key. */
          lastSeen: 0,
          keySaved: false,
          createdBy: mine,
        };
        await writeJson(store, K.user(handle), { ...user, keyHash: sha(key) });
        await writeJson(store, K.keyOf(sha(key)), handle);
        await indexAdd(store, "users", handle);

        /* Putting them straight into a course, so inviting a teacher is one
           action rather than three.

           Both roles at once, because someone teaching a course usually wants
           its cards in their own practice too — which needs a student
           enrolment, and used to mean creating them, then going back to add
           the second role by hand. `role` is still read so a tab left open
           across a deploy adds the role it meant rather than the default. */
        const courseId = String(body.courseId || "");
        if (courseId) {
          const asked = Array.isArray(body.roles)
            ? body.roles
            : [body.role === "student" ? "student" : "teacher"];
          await updateJson(store, K.course(courseId), (/** @type {Course | null} */ course) => {
            if (!course) return null;
            const next = { ...course, teachers: course.teachers.slice(), students: course.students.slice() };
            for (const role of asked) {
              const as = role === "student" ? "students" : "teachers";
              if (!next[as].includes(handle)) next[as].push(handle);
            }
            return next;
          });
        }
        return json({ ok: true, user, key });
      }

      if (action === "admin-reissue-key") {
        const handle = String(body.handle || "");
        const target = await readUser(store, handle);
        if (!target) return json({ error: "no-user" }, 404);
        /* One key opens every space the person is in (memberships), so a
           space admin gives a new one only to someone in their space alone.
           A suspended membership counts: the key would open it once
           reactivated. */
        if (!iAmAdmin && memberOf(target).length > 1) return json({ error: "many-spaces" }, 403);
        if (!iAmAdmin && (target.admin || (actingOrgDoc.admins || []).includes(handle))) {
          /* A space admin's key, and an App admin's, are the App admin's to
             replace (70a). */
          return json({ error: "admin-only" }, 403);
        }
        const key = makeKey();
        if (target.keyHash) await store.delete(K.keyOf(target.keyHash)).catch(() => {});
        await writeJson(store, K.user(handle), { ...target, keyHash: sha(key) });
        await writeJson(store, K.keyOf(sha(key)), handle);
        /* The practice document is stored under the key's token; carry it
           over, or the new key opens an empty one (0.580). */
        if (target.keyHash) await moveSyncDoc(target.keyHash, sha(key)).catch(() => {});
        return json({ ok: true, handle, key });
      }

      /* Removing a person: the same walk as closing your own account, so
         an administrator cannot leave a different set of leftovers behind
         than the person themselves would. Your own account goes through
         the door marked with your name, which is the one that needs no
         administrator. */
      /*
       * Suspended across the whole app (0.578), the App admin's alone: no
       * sign-in anywhere, off every course in every space, and only the
       * App admin lifts it — which puts them back on those courses. Each
       * space's People list shows it; no space admin can undo it.
       */
      if (action === "admin-suspend-app" || action === "admin-lift-app") {
        if (!iAmAdmin) return json({ error: "admin-only" }, 403);
        const handle = String(body.handle || "");
        const target = await readJson(store, K.user(handle));
        if (!target) return json({ error: "no-user" }, 404);
        if (target.admin || handle === mine) return json({ error: "admin-only" }, 403);
        const ids = await readIndex(store, "courses");
        if (action === "admin-suspend-app") {
          if (target.suspendedApp) return json({ ok: true });
          /** @type {{ id: string, roles: string[] }[]} */
          const was = [];
          for (const id of ids) {
            await updateJson(store, K.course(id), (/** @type {Course | null} */ c) => {
              if (!c || !(c.teachers.includes(handle) || c.students.includes(handle))) return null;
              const roles = [];
              if (c.teachers.includes(handle)) roles.push("teacher");
              if (c.students.includes(handle)) roles.push("student");
              was.push({ id: c.id, roles });
              return { ...c, teachers: c.teachers.filter((x) => x !== handle), students: c.students.filter((x) => x !== handle) };
            });
          }
          await updateJson(store, K.user(handle), (/** @type {any} */ cur) =>
            cur ? { ...cur, suspendedApp: { at: Date.now(), by: mine, courses: was } } : null
          );
          return json({ ok: true });
        }
        const held = target.suspendedApp;
        if (!held) return json({ ok: true });
        for (const c of held.courses || []) {
          await updateJson(store, K.course(c.id), (/** @type {Course | null} */ course) => {
            if (!course) return null;
            const next = { ...course, teachers: course.teachers.slice(), students: course.students.slice() };
            if ((c.roles || []).includes("teacher") && !next.teachers.includes(handle)) next.teachers.push(handle);
            if ((c.roles || []).includes("student") && !next.students.includes(handle)) next.students.push(handle);
            return next;
          });
        }
        await updateJson(store, K.user(handle), (/** @type {any} */ cur) => {
          if (!cur) return null;
          const { suspendedApp: _gone, ...rest } = cur;
          return rest;
        });
        return json({ ok: true });
      }

      if (action === "admin-delete-user") {
        const handle = String(body.handle || "");
        if (handle === mine) return json({ error: "use-delete-account" }, 400);
        /* Only someone in the org this request acts in. wipeAccount alone
           would take a stranger's handle off every roster on the site. */
        if ((await readJson(store, K.user(handle))) && !(await readUser(store, handle))) {
          return json({ error: "no-user" }, 404);
        }
        /* Someone also in another space loses only this one, unless the
           App admin deletes them, who deletes the account (memberships). */
        const target = await readUser(store, handle);
        if (target && !iAmAdmin && memberOf(target).length > 1) {
          await removeMembership(store, handle, acting, { why: "removed", by: mine });
          return json({ ok: true, removed: "membership" });
        }
        const gone = await wipeAccount(store, handle, { by: mine });
        if (!gone) return json({ error: "no-user" }, 404);
        return json({ ok: true, removed: "account" });
      }

      /* Removing a course: the roster goes and the decks are released back
         to the teachers who made them. Cards belong to their owners, so
         nothing anybody wrote is destroyed here. */
      if (action === "admin-delete-course") {
        const course = await readCourse(store, String(body.courseId || ""));
        if (!course) return json({ error: "not-found" }, 404);

        for (const deckId of course.decks || []) {
          await updateJson(store, K.deck(deckId), (/** @type {Deck | null} */ d) =>
            d && (d.courses || []).some((l) => l.courseId === course.id)
              ? { ...d, courses: d.courses.filter((l) => l.courseId !== course.id) }
              : null
          );
        }
        if (course.code) await store.delete(K.code(course.code)).catch(() => {});
        if (course.teacherCode) await store.delete(K.code(course.teacherCode)).catch(() => {});
        await store.delete(K.course(course.id)).catch(() => {});
        await updateJson(store, K.index("courses"), (/** @type {string[] | null} */ cur) =>
          (cur || []).includes(course.id) ? (cur || []).filter((x) => x !== course.id) : null);
        return json({ ok: true });
      }

      /* Courses created before the language was stored have none, and a
         course with no language sends its decks and cards to the wrong
         script. This is how one gets corrected. */
      /* The title is a label and nothing hangs off it: the id is what decks,
         memberships and join codes are keyed by, so this changes what people
         see and nothing else. Same 80 characters create-course allows, or a
         course could be created with a name it could not be renamed to. */
      if (action === "admin-rename-course") {
        const course = await readCourse(store, String(body.courseId || ""));
        if (!course) return json({ error: "not-found" }, 404);
        const title = String(body.title || "").trim().slice(0, 80);
        if (!title) return json({ error: "title-required" }, 400);
        await updateJson(store, K.course(course.id), (/** @type {Course | null} */ c) =>
          c ? { ...c, title, updated: Date.now() } : null
        );
        return json({ ok: true, title });
      }

      if (action === "admin-course-language") {
        const course = await readCourse(store, String(body.courseId || ""));
        if (!course) return json({ error: "not-found" }, 404);
        /* Trimmed, as the title beside it is. A language id is looked up
           in the packs by exact match, so a course set to "  " is a course
           whose material goes to no script at all — and `language-required`
           says plainly that a blank is not an answer, which whitespace is. */
        const language = String(body.language || "").trim().slice(0, 20);
        if (!language) return json({ error: "language-required" }, 400);
        await updateJson(store, K.course(course.id), (/** @type {Course | null} */ c) =>
          c ? { ...c, language, updated: Date.now() } : null
        );
        return json({ ok: true, language });
      }

      /* Replacing one of a course's two codes. The other is untouched, so
         retiring a leaked teacher code doesn't turn away a whole class.
         This is also how a course made before there were two codes gets
         its teacher code. */
      if (action === "admin-new-code") {
        const course = await readCourse(store, String(body.courseId || ""));
        if (!course) return json({ error: "not-found" }, 404);
        const which = body.which === "teacher" ? "teacherCode" : "code";
        const code = makeCode();
        if (course[which]) await store.delete(K.code(course[which])).catch(() => {});
        await writeJson(store, K.code(code), course.id);
        await updateJson(store, K.course(course.id), (/** @type {Course | null} */ c) =>
          c ? { ...c, [which]: code } : null
        );
        return json({ ok: true, code, which });
      }

      /* One card, by id, whoever owns it and whichever deck it is in.
         Admin lists decks rather than cards, so until now there was no way
         to look at a card from here — and a report about a card you cannot
         open is a report you have to go hunting for. */
      if (action === "admin-card") {
        const card = await readCard(store, cardIdOf(url.searchParams.get("card")));
        if (!card) return json({ error: "no-card" }, 404);
        /* Named `decks` because that is what CardReadout reads it as. */
        /* As students have it: a report is about what they were asked. */
        return json({ ok: true, card: { ...studentView(card), decks: await decksHolding(card) } });
      }

      /* Dealt with, or not worth keeping. There is no state on a flag
         beyond existing, because a half-read list of "resolved" markers is
         a second thing to keep tidy and the first one is the card. */
      if (action === "admin-delete-flags") {
        const wanted = new Set((Array.isArray(body.flagIds) ? body.flagIds : []).map(String));
        if (!wanted.size) return json({ ok: true, deleted: 0 });
        const ids = await readIndex(store, "flags");
        /* Only this org's reports, whatever was asked for. */
        for (const id of [...wanted]) if (!inScope(await readJson(store, K.flag(id)))) wanted.delete(id);
        for (const id of ids) if (wanted.has(id)) await store.delete(K.flag(id)).catch(() => {});
        await updateJson(store, K.index("flags"), (/** @type {string[] | null} */ cur) =>
          (cur || []).filter((id) => !wanted.has(id)));
        return json({ ok: true, deleted: ids.filter((id) => wanted.has(id)).length });
      }
    }

    return json({ error: "unknown-action" }, 400);
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
}
