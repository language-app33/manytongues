/*
 * Personal sets (0.629 onwards).
 *
 * A personal set is a deck with a `set` field: a deck of pictures that each
 * student answers a question about once ("Who is this person to you?") and
 * is then asked with their own word. Its pictures are the deck's cards whose
 * lead form has a picture; its word lists are other, ordinary decks of the
 * same course, named in `lists`. Nothing here is new storage:
 *
 *   * the teacher's side is the one field on the deck (`SetConfig`), and a
 *     name per recording on a form (`voices`, in types.ts);
 *   * a student's answer is a record in the picture card's lead form's
 *     progress, `s[SET_KEY]` — not an exercise, carried untouched by every
 *     device since 0.626, and so synced, backed up and deleted with the
 *     progress it sits in.
 *
 * Pure: no React, no storage, no clock, and no word of any language — every
 * word a set shows is the teacher's. The server imports it to narrow what a
 * teacher saves.
 */

import type { Millis } from "./types.ts";

/** Present means the deck is a personal set. Its name is the deck's title. */
export interface SetConfig {
  wording: {
    /** Asked once per picture. */
    question: string;
    /** The doesn't-apply button. */
    none: string;
    /** Practice, the name. */
    askName: string;
    /** Practice, the word. */
    askWord: string;
    /** Practice, both together. */
    askBoth: string;
  };
  /** Ids of the decks that are its word lists, in order. */
  lists: string[];
  /** Ids of the word cards ticked "said with the name". */
  named: string[];
  asks: { name: boolean; word: boolean; both: boolean };
  /** Where the word goes beside the name. */
  order: "before" | "after";
}

/** The key in a form's `s` that holds a SetAnswer. Not an exercise: never
    add it to TYPES. */
export const SET_KEY = "set-answer";

export interface SetAnswer {
  /** When it was last written; what the merge between devices reads. */
  updated: Millis;
  /** The English of the word chosen. */
  meaning?: string;
  /** Doesn't apply. */
  none?: true;
  /** Shown and skipped. */
  skip?: true;
  /** The list deck the student chose for this picture's set. */
  list?: string;
}
/* No record, or one with none of meaning, none and skip: the picture has
   never been answered. */

export type TurnKind = "name" | "word" | "both";

export const DEFAULT_WORDING: SetConfig["wording"] = {
  question: "Who is this person to you?",
  none: "I don't know this person",
  askName: "Who is this?",
  askWord: "What do you call this person?",
  askBoth: "Their name, with what you call them",
};

export const SET_LIMITS = { wording: 120, lists: 12, named: 500 };

/* The form a deck's or a card's id takes, wherever it was minted. */
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function emptySet(): SetConfig {
  return {
    wording: { ...DEFAULT_WORDING },
    lists: [],
    named: [],
    asks: { name: true, word: true, both: true },
    order: "before",
  };
}

const ids = (raw: unknown, limit: number, not = ""): string[] =>
  Array.isArray(raw)
    ? [...new Set(raw.filter((x): x is string => typeof x === "string" && ID.test(x) && x !== not))].slice(0, limit)
    : [];

/**
 * A stored or sent set, narrowed: the limits applied, empty wording filled
 * with the default, the deck's own id never one of its lists. Null for
 * anything that is not an object. Never throws.
 */
export function readSet(raw: unknown, ownDeckId: string): SetConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const w = r.wording && typeof r.wording === "object" && !Array.isArray(r.wording) ? (r.wording as Record<string, unknown>) : {};
  const wording = { ...DEFAULT_WORDING };
  for (const k of Object.keys(DEFAULT_WORDING) as (keyof SetConfig["wording"])[]) {
    const v = typeof w[k] === "string" ? (w[k] as string).trim().slice(0, SET_LIMITS.wording) : "";
    if (v) wording[k] = v;
  }
  const a = r.asks && typeof r.asks === "object" && !Array.isArray(r.asks) ? (r.asks as Record<string, unknown>) : {};
  const on = (k: string) => (typeof a[k] === "boolean" ? (a[k] as boolean) : true);
  return {
    wording,
    lists: ids(r.lists, SET_LIMITS.lists, ownDeckId),
    named: ids(r.named, SET_LIMITS.named),
    asks: { name: on("name"), word: on("word"), both: on("both") },
    order: r.order === "after" ? "after" : "before",
  };
}

/** A stored answer, narrowed; null for anything that is not one. */
export function readAnswer(raw: unknown): SetAnswer | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const updated = Number(r.updated);
  if (!Number.isFinite(updated) || updated < 0) return null;
  const out: SetAnswer = { updated };
  if (typeof r.meaning === "string" && r.meaning.trim()) out.meaning = r.meaning.trim().slice(0, 200);
  if (r.none === true) out.none = true;
  if (r.skip === true) out.skip = true;
  if (typeof r.list === "string" && ID.test(r.list)) out.list = r.list;
  return out;
}

type WithForms = { forms: { s?: Record<string, unknown> }[]; updated?: Millis };

/**
 * The item with its lead form's answer merged with `change` and stamped
 * `at`, and the item stamped `at` too. The one way an answer is written.
 * A field set to undefined in `change` is removed; every other key of `s`
 * is left as it was.
 */
export function withAnswer<T extends WithForms>(item: T, change: Partial<Omit<SetAnswer, "updated">>, at: Millis): T {
  const [lead, ...rest] = item.forms;
  if (!lead) return item;
  const was = readAnswer(lead.s && lead.s[SET_KEY]) || { updated: 0 };
  const merged: Record<string, unknown> = { ...was, ...change, updated: at };
  for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
  const record = readAnswer(merged) || { updated: at };
  return {
    ...item,
    forms: [{ ...lead, s: { ...(lead.s || {}), [SET_KEY]: record } }, ...rest],
    updated: at,
  };
}

/* ------------------------------------------------------------------
   What a student is still to be asked (0.630)

   A set as the device sees it: its held lists in the set's order, each
   with its words, and its pictures, each with the answer in its progress.
   Built by the app from the decks and items it holds; everything below
   reads only this.
   ------------------------------------------------------------------ */

export type PictureState = "new" | "skip" | "none" | "waiting" | "ok";

export interface SetView<P extends { id: string; answer: SetAnswer | null } = { id: string; answer: SetAnswer | null }, W extends { en: string } = { en: string }> {
  /** The set's deck. */
  id: string;
  title: string;
  set: SetConfig;
  /** The set's lists the student holds, in the set's order. */
  lists: { id: string; title: string; words: W[] }[];
  pictures: P[];
}

export type SetStep =
  | { kind: "list"; setId: string }
  | { kind: "picture"; setId: string; pictureId: string; fresh: boolean };

/**
 * The list a student learns a set's words from: the only held list where
 * there is one; otherwise the `list` on the most recently written answer
 * among its pictures, if that deck is still one of the set's held lists;
 * otherwise none yet.
 */
export function chosenList(set: SetConfig, heldDeckIds: string[], answers: (SetAnswer | null | undefined)[]): string | null {
  const held = set.lists.filter((id) => heldDeckIds.includes(id));
  if (held.length === 1) return held[0];
  if (!held.length) return null;
  let best: SetAnswer | null = null;
  for (const a of answers) if (a && a.list && (!best || a.updated > best.updated)) best = a;
  return best && best.list && held.includes(best.list) ? best.list : null;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The word whose English is the answer's meaning; none for a skip, a
    doesn't-apply, or no such word in the list. */
export function resolve<W extends { en: string }>(words: W[], answer: SetAnswer | null | undefined): W | null {
  if (!answer || answer.none || !answer.meaning) return null;
  const meaning = answer.meaning;
  return words.find((w) => !!w.en && same(w.en, meaning)) || null;
}

/**
 * Where one picture stands for one student. `words` is the chosen list's,
 * or null while no list is chosen.
 */
export function pictureState(answer: SetAnswer | null | undefined, words: { en: string }[] | null): PictureState {
  if (answer && answer.none) return "none";
  if (answer && answer.meaning) return words && resolve(words, answer) ? "ok" : "waiting";
  if (answer && answer.skip) return "skip";
  return "new";
}

/** A view's chosen list, as a list of the view. */
export function chosenOf<W extends { en: string }>(view: SetView<{ id: string; answer: SetAnswer | null }, W>) {
  const id = chosenList(view.set, view.lists.map((l) => l.id), view.pictures.map((p) => p.answer));
  return view.lists.find((l) => l.id === id) || null;
}

/**
 * What is still to ask, set by set: the list, where there are several and
 * none is chosen, before that set's pictures; then each picture not yet
 * answered (new or waiting, marked fresh) or skipped (not fresh). A set
 * with no held list, or no pictures, asks nothing.
 */
export function stepsToAsk(views: SetView[]): SetStep[] {
  const out: SetStep[] = [];
  for (const v of views) {
    if (!v.lists.length || !v.pictures.length) continue;
    const chosen = chosenOf(v);
    if (!chosen) out.push({ kind: "list", setId: v.id });
    for (const p of v.pictures) {
      const state = pictureState(p.answer, chosen ? chosen.words : null);
      if (state === "new" || state === "waiting") out.push({ kind: "picture", setId: v.id, pictureId: p.id, fresh: true });
      else if (state === "skip") out.push({ kind: "picture", setId: v.id, pictureId: p.id, fresh: false });
    }
  }
  return out;
}

/**
 * A form's progress across a reset (0.630): every schedule goes, and the
 * set's answer stays, re-stamped with the reset's time so that the merge
 * between devices — which drops anything older than a reset — keeps it.
 */
export function keptAcrossReset(s: Record<string, unknown> | undefined, at: Millis): Record<string, SetAnswer> {
  const was = readAnswer(s && s[SET_KEY]);
  return was ? { [SET_KEY]: { ...was, updated: at } } : {};
}

/* ------------------------------------------------------------------
   Practising a picture (0.631)
   ------------------------------------------------------------------ */

/**
 * The kinds a picture takes turns between: its name, if asked; and, only
 * where the answer resolves to a word, the word if asked, and both
 * together if asked and the word is ticked "said with the name".
 */
export function kindsFor(set: SetConfig, ok: boolean, named: boolean): TurnKind[] {
  const out: TurnKind[] = [];
  if (set.asks.name) out.push("name");
  if (ok && set.asks.word) out.push("word");
  if (ok && named && set.asks.both) out.push("both");
  return out;
}

/** The word and the name, side by side, in the set's order. */
export const pairText = (set: SetConfig, word: string, name: string): string =>
  (set.order === "after" ? [name, word] : [word, name]).map((x) => x.trim()).filter(Boolean).join(" ");

type Heard = { recs?: { id: string }[]; clips?: string[]; slowClips?: string[]; voices?: Record<string, string> };

/* A form's recordings, in its own order: a device's form lists them as
   `recs`, a teacher's card as `clips` then `slowClips`. */
export const heardOf = (f: Heard | null | undefined): string[] =>
  !f ? [] : Array.isArray(f.recs) && f.recs.length ? f.recs.map((r) => r.id).filter(Boolean) : [...(f.clips || []), ...(f.slowClips || [])];

/**
 * What "both together" plays: the word's recording and the name's, as two
 * groups in the set's order. In one voice where one person recorded both
 * — the first such, in the word's order — and that voice named; otherwise
 * the first recording of each, with both names. Null where either has none.
 */
export function pairClips(set: SetConfig, wordForm: Heard, nameForm: Heard): { groups: string[][]; voices: string[] } | null {
  const word = heardOf(wordForm);
  const name = heardOf(nameForm);
  if (!word.length || !name.length) return null;
  const wv = wordForm.voices || {};
  const nv = nameForm.voices || {};
  const order = (w: string, n: string) => (set.order === "after" ? [[n], [w]] : [[w], [n]]);
  for (const w of word) {
    const who = (wv[w] || "").trim();
    if (!who) continue;
    const n = name.find((h) => (nv[h] || "").trim().toLowerCase() === who.toLowerCase());
    if (n) return { groups: order(w, n), voices: [who] };
  }
  const voices = (set.order === "after" ? [nv[name[0]], wv[word[0]]] : [wv[word[0]], nv[name[0]]])
    .map((v) => (v || "").trim())
    .filter(Boolean);
  return { groups: order(word[0], name[0]), voices: [...new Set(voices)] };
}

/** Whether a confirmed change starts a picture again: both answers name a
    meaning, and the meanings differ. */
export function isRealChange(before: SetAnswer | null | undefined, after: SetAnswer | null | undefined): boolean {
  if (!before || !after || !before.meaning || !after.meaning || before.none || after.none) return false;
  return !same(before.meaning, after.meaning);
}

/** One line for a problem report about a picture: the student's answer
    for it, which the teacher sees nowhere else. */
export function answerLine(set: SetConfig, pictureName: string, answer: SetAnswer | null | undefined, listName: string): string {
  const said = !answer
    ? "not answered yet"
    : answer.none
    ? `"${set.wording.none}"`
    : answer.meaning
    ? `"${answer.meaning}"`
    : "not answered yet";
  const from = listName ? ` (${listName})` : "";
  return `Their answer for ${pictureName}: ${said}${from}`.slice(0, 200);
}

/* ------------------------------------------------------------------
   What the teacher is told (0.632)
   ------------------------------------------------------------------ */

/**
 * Warnings for the teacher, worded plainly, never blocking a save: no
 * list; a list too short to choose between; a meaning one list has and
 * another lacks; cards in the deck with no picture, which are not part of
 * the set. `cards` is the set's own deck's, each saying whether it has a
 * picture.
 */
export function setGaps(
  set: SetConfig,
  lists: { title: string; words: { en: string }[] }[],
  cards: { picture: boolean }[] = [],
): string[] {
  const out: string[] = [];
  if (!set.lists.length) out.push("No word list is chosen yet, so students have nothing to answer with.");
  for (const l of lists) {
    if (l.words.length < 4) {
      out.push(`${l.title} has ${l.words.length === 1 ? "only 1 word" : `only ${l.words.length} words`}. Four or more give the choices something to choose between.`);
    }
  }
  for (const a of lists) {
    for (const b of lists) {
      if (a === b) continue;
      const missing = a.words.find((w) => w.en && !b.words.some((x) => same(x.en, w.en)));
      if (missing) {
        out.push(`${a.title} has a word for "${missing.en.trim()}" and ${b.title} doesn't. A student on ${b.title} who chose it is asked again.`);
      }
    }
  }
  const bare = cards.filter((c) => !c.picture).length;
  if (bare) out.push(`${bare === 1 ? "1 card" : `${bare} cards`} in this deck ${bare === 1 ? "has" : "have"} no picture, so ${bare === 1 ? "it is" : "they are"} not part of the set.`);
  return out;
}
