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
