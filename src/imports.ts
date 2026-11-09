/*
 * A teacher's import: a file of cards and decks read against what the
 * teacher already has, before anything is written.
 *
 * The file is the backup's own format — what Export makes, and what the
 * administrator's Back up makes, of which only the cards, decks, recordings
 * and pictures are read. The owner's rules (DECISIONS.md, "A teacher's
 * import"):
 *
 *   * **The same card** is one whose id the teacher already has: exported
 *     from here and still here, however it has been edited since. Skipped
 *     unless the teacher ticks it, and then the file's version replaces it.
 *   * **The same word** is a different card with the same word in the same
 *     language — the word read the way the deck score reads it for "no word
 *     on two cards". Skipped unless ticked, and then imported as a card of
 *     its own, because one word can be two meanings.
 *   * Everything else is **new**, and imported.
 *   * **A deck** the teacher already has — the same id, or else the same
 *     name in the same language — is added to, and nothing in it is taken
 *     out. Any other deck is made, in no course.
 *   * Whatever is imported becomes the importing teacher's own.
 *
 * Pure: it reads a file and two lists and says what would happen. Writing
 * it is the screen's, through the same calls the card editor makes.
 */

import type { Card, Deck } from "./types.ts";
import { leadOf, wordOf } from "./cards.ts";
import { GRAMMAR, grammarFields, inScript, LANGUAGES, normDimValue } from "./languages.ts";
import { joinAlternatives } from "./answers.ts";

export type ImportFile = {
  cards: Card[];
  decks: Deck[];
  /** Recordings and pictures, by the hash they are stored under. */
  clips: Record<string, string>;
  images: Record<string, string>;
};

/** Reads a file into what an import uses, or says why it cannot. */
export function readImportFile(parsed: any): ImportFile | string {
  if (!parsed || typeof parsed !== "object" || parsed.format !== "language-app-backup") {
    return "That file isn't an export or a backup from this app.";
  }
  const records = parsed.records && typeof parsed.records === "object" ? parsed.records : {};
  const file: ImportFile = { cards: [], decks: [], clips: {}, images: {} };
  for (const [key, value] of Object.entries<any>(records)) {
    if (!value) continue;
    if (key.startsWith("card:") && typeof value === "object") file.cards.push(value);
    else if (key.startsWith("deck:") && typeof value === "object") file.decks.push(value);
    else if (key.startsWith("clip:") && typeof value === "string") file.clips[key.slice(5)] = value;
    else if (key.startsWith("image:") && typeof value === "string") file.images[key.slice(6)] = value;
  }
  if (!file.cards.length && !file.decks.length) return "There are no cards or decks in that file.";
  return file;
}

/**
 * The word a card is known by, for telling whether two cards are the same
 * word: its language and its word, or for a conversation or a text, which
 * has no word, its name.
 */
export function wordKey(card: Card): string {
  const w = wordOf(card);
  const said = String(w.ar || "").trim();
  if (said) return `${card.lang}|${said}`;
  const named = String(card.name || leadOf(card).en || "").trim().toLowerCase();
  return named ? `${card.lang}|en:${named}` : "";
}

export type CardMatch = {
  card: Card;
  kind: "new" | "same" | "sameWord";
  /** The card the teacher already has: the same one, or one with its word. */
  existing?: Card;
  /** The file's decks this card is in, by their id in the file. */
  inDecks: string[];
};

export type DeckMatch = { deck: Deck; existing?: Deck };

export function matchImport(file: ImportFile, have: Card[], haveDecks: Deck[]) {
  const byId = new Map(have.map((c) => [c.id, c]));
  const byWord = new Map<string, Card>();
  for (const c of have) {
    const k = wordKey(c);
    if (k && !byWord.has(k)) byWord.set(k, c);
  }
  const titled = (d: Deck) => `${d.lang}|${String(d.title || "").trim().toLowerCase()}`;
  const decks: DeckMatch[] = file.decks.map((deck) => ({
    deck,
    existing:
      haveDecks.find((d) => d.id === deck.id) ||
      haveDecks.find((d) => titled(d) === titled(deck)),
  }));
  const cards: CardMatch[] = file.cards.map((card) => {
    const inDecks = file.decks.filter((d) => (d.cardIds || []).includes(card.id)).map((d) => d.id);
    const same = byId.get(card.id);
    if (same) return { card, kind: "same", existing: same, inDecks };
    const k = wordKey(card);
    const twin = k ? byWord.get(k) : undefined;
    if (twin) return { card, kind: "sameWord", existing: twin, inDecks };
    return { card, kind: "new", inDecks };
  });
  return { cards, decks };
}

/**
 * The status every imported card is saved with: Ready for review, the
 * owner's rule, so nothing a file brings in reaches students before a
 * teacher has looked at it. A new card is made Ready for review; a card
 * replaced keeps what students have, if it is published, and the import
 * becomes its changes, Ready for review — see "A card's status" in
 * server/api/courses.js.
 */
export const IMPORTED_STATUS = "review";

/** What is ticked to start with: the new cards, and nothing the teacher has. */
export const tickedAtFirst = (m: CardMatch) => m.kind === "new";

/* A card as the save takes it: its words, without what the server keeps
   for itself. The id is the one to save over, or "" for a new card. */
const SERVER_FIELDS = ["owner", "rev", "created", "updated", "inDecks", "decks"];
export function toSave(card: Card, id: string): Partial<Card> {
  const out: any = { ...card, id, status: IMPORTED_STATUS };
  for (const k of SERVER_FIELDS) delete out[k];
  return out;
}

/**
 * The card with every mention of another card's id moved to where that
 * card now is: a phrase's links to its words, a conversation's lines, the
 * card a split came from. Ids are long and random, so a string equal to one
 * is that card and nothing else.
 */
export function remapIds<T>(value: T, moved: Map<string, string>): T {
  if (typeof value === "string") return (moved.get(value) ?? value) as any;
  if (Array.isArray(value)) return value.map((v) => remapIds(v, moved)) as any;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remapIds(v, moved)])) as any;
  }
  return value;
}

/** Whether anything on a card names one of these ids. */
export function mentions(value: unknown, ids: Set<string>): boolean {
  if (typeof value === "string") return ids.has(value);
  if (Array.isArray(value)) return value.some((v) => mentions(v, ids));
  if (value && typeof value === "object") return Object.values(value).some((v) => mentions(v, ids));
  return false;
}

/** The recordings and pictures the file holds for these cards. */
export function mediaOf(cards: Card[], file: ImportFile) {
  const clips = new Set<string>();
  const images = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (file.clips[v] !== undefined) clips.add(v);
      if (file.images[v] !== undefined) images.add(v);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  cards.forEach(walk);
  return { clips: [...clips], images: [...images] };
}

/* ------------------------------------------------------------------
   A pasted table of words (moved here from the trainer in 0.580)

   Tab-separated, pipe-separated or a Markdown table, with or without a
   header row naming the columns: each line one card's words. Pure, so the
   tests read it without building the app.
   ------------------------------------------------------------------ */

/** Tags as typed: split on commas, trimmed, each once. */
export function cleanTags(input: unknown) {
  const raw = Array.isArray(input) ? input : String(input || "").split(",");
  const out: string[] = [];
  for (const t of raw) {
    const tag = String(t).trim().replace(/\s+/g, " ");
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}

/* Open, because the loops below add a name per grammatical field and per
   language, and a column heading is whatever the file happened to say. */
const FIELD_ALIASES: Record<string, string> = {
  ar: "ar", arabic: "ar", script: "ar",
  lat: "lat", latin: "lat", tr: "lat", translit: "lat", transliteration: "lat", roman: "lat",
  en: "en", eng: "en", english: "en", meaning: "en", translation: "en",
  tag: "tags", tags: "tags",
  note: "note", notes: "note",
  num: "number", plurality: "number",
  gen: "gender",
  reg: "register", addressee: "register",
  cl: "classifier", clf: "classifier",
};
/* Every grammatical field answers to its own name, without that having to be
   written here each time one is added. */
for (const f of grammarFields()) FIELD_ALIASES[f] = f;
/* And every language answers to what it calls its own columns — "Hebrew",
   "Pronunciation note" — so a table headed in the language's own terms is
   read as a table. Only "Arabic" was written in above, by hand. */
const aliasKey: (label: unknown) => string = (label) => String(label || "").toLowerCase().replace(/[^a-z]/g, "");
for (const L of Object.values(LANGUAGES)) {
  if (L.scriptLabel) FIELD_ALIASES[aliasKey(L.scriptLabel)] = "ar";
  /* And to what it called them before 0.213, when the column was named
     after the script rather than the language — a file exported then is
     still a file somebody has. */
  if (L.scriptLabel) FIELD_ALIASES[aliasKey(`${L.scriptLabel} script`)] = "ar";
  if (L.translitLabel) FIELD_ALIASES[aliasKey(L.translitLabel)] = "lat";
}
const FIELD_ORDER = ["en", "ar", "lat", "tags", "note"].concat(grammarFields());

const MD_SEPARATOR = /^:?-+:?$/;
const ESC = "\u0000";

function splitRow(line: string) {
  return (line.includes("\t") ? line.split("\t") : line.split("|")).map((p) => p.trim());
}

function stripMd(cell: string) {
  return cell
    .split(ESC)
    .join("|")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

function mdCells(line: string) {
  return line
    .replace(/\\\|/g, ESC)
    .replace(/^\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map(stripMd);
}

function isSeparatorLine(line?: string) {
  if (!line) return false;
  const t = line.trim();
  if (!t.startsWith("|")) return false;
  const cells = mdCells(t);
  return cells.length > 0 && cells.every((c) => MD_SEPARATOR.test(c));
}

/* The three fields a card can accept more than one of. */
const MANY_FIELDS = new Set(["ar", "lat", "en"]);

/*
 * The field a column heading names: "English", or "English 2" for a second
 * accepted answer, "Arabic 3" for a third. One answer to a cell, as one to
 * a box in the editor — nothing written inside a cell splits it (0.439) —
 * so the extra answers each have a column of their own. A second answer is
 * read as `en#1`, its place in the list, and folded in by foldAnswers.
 */
function fieldOf(heading: string): string | undefined {
  const t = heading.toLowerCase().trim();
  const m = /^(.*?)\s*(\d+)$/.exec(t);
  const at = m ? Number(m[2]) : 1;
  const key = FIELD_ALIASES[(m ? m[1] : t).replace(/[^a-z]/g, "")];
  if (!key || at < 1) return undefined;
  if (at === 1) return key;
  return MANY_FIELDS.has(key) ? `${key}#${at - 1}` : undefined;
}

/* The answers read from numbered columns, into the field they belong to:
   one answer to a line (see ALT_SEP), in the order the columns number
   them. A transliteration stays beside the word in the same place. */
function foldAnswers(row: Record<string, string>) {
  for (const f of MANY_FIELDS) {
    const list = [row[f] || ""];
    for (const [k, v] of Object.entries(row)) {
      const m = /^(\w+)#(\d+)$/.exec(k);
      if (m && m[1] === f) list[Number(m[2])] = v || "";
    }
    row[f] = joinAlternatives(Array.from(list, (x) => x || ""));
  }
}

function readHeader(cells: string[]): string[] | null {
  if (cells.length < 2) return null;
  const map = cells.map(fieldOf);
  return map.every(Boolean) ? (map as string[]) : null;
}

/**
 * A row read out of a pasted table: the fields every card has, plus
 * whichever grammatical fields the language declares, which is why the
 * type is open.
 */
type ParsedRow = Record<string, any> & {
  ar: string;
  lat: string;
  en: string;
  note: string;
  tags: string[];
};
/**
/**
 * `skipped` rides on the array because the importer wants both the rows
 * and the count of lines that held nothing, and the callers all read the
 * rows first.
 */
export function parseLines(text: string, knownTags: string[] = []): ParsedRow[] & { skipped?: number } {
  const out: ParsedRow[] & { skipped?: number } = [];
  const known = new Set(knownTags.map((t) => t.toLowerCase()));
  const lines = String(text).split(/\r?\n/);
  const mdMode = lines.some((l) => l.trim().startsWith("|"));
  let order: string[] | null = null;
  let skipped = 0;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trim();
    if (!line || line.startsWith("#")) continue;

    let cells: string[];
    if (mdMode) {
      if (!line.startsWith("|")) continue;
      if (isSeparatorLine(line)) continue;
      cells = mdCells(line);
      if (isSeparatorLine(lines[li + 1])) {
        const header = readHeader(cells);
        if (header) order = header;
        continue;
      }
    } else {
      cells = splitRow(line);
    }

    if (!order && !out.length) {
      const header = readHeader(cells);
      if (header) {
        order = header;
        continue;
      }
    }

    const row: Record<string, string> = { ar: "", lat: "", en: "", tags: "", note: "" };
    for (const f of grammarFields()) row[f] = "";
    const loose: { value: string, i: number }[] = [];

    cells.forEach((cell: string, i: number) => {
      const m = cell.match(/^([A-Za-z]+(?:\s*\d+)?)\s*[:=]\s*([\s\S]*)$/);
      const key = m && fieldOf(m[1]);
      if (key) row[key] = m[2].trim();
      else loose.push({ value: cell, i });
    });

    if (loose.length) {
      const usesGaps = loose.some((c) => !c.value);
      if (order || usesGaps) {
        for (const { value, i } of loose) {
          const key = order ? order[i] : FIELD_ORDER[i];
          if (key && !row[key] && value) row[key] = value;
        }
        if (row.ar && !inScript(row.ar)) {
          const holder = ["en", "lat"].find((k) => row[k] && inScript(row[k]));
          if (holder) {
            const tmp = row.ar;
            row.ar = row[holder];
            row[holder] = tmp;
          }
        }
      } else {
        const values = loose.map((c) => c.value);
        const arIdx = values.findIndex((v) => inScript(v));
        if (arIdx !== -1 && !row.ar) row.ar = values.splice(arIdx, 1)[0] || "";
        if (values.length > 1 && known.size && !row.tags) {
          const parts = cleanTags(values[values.length - 1]);
          if (parts.length && parts.every((t) => known.has(t.toLowerCase()))) {
            row.tags = values.pop() || "";
          }
        }
        const slots = FIELD_ORDER.filter((k) => !row[k]);
        values.forEach((v, i) => {
          if (slots[i]) row[slots[i]] = v;
        });
      }
    }

    foldAnswers(row);
    if (!row.ar && !row.lat && !row.en) {
      skipped += 1;
      continue;
    }
    out.push({
      ar: row.ar,
      lat: row.lat,
      en: row.en,
      note: row.note,
      tags: cleanTags(row.tags),
      ...Object.fromEntries(
        Object.values(GRAMMAR).map((d) => [d.field, normDimValue(d, row[d.field])])
      ),
      ...Object.fromEntries(
        grammarFields()
          .filter((f) => !Object.values(GRAMMAR).some((d) => d.field === f))
          .map((f) => [f, row[f] || ""])
      ),
    });
  }

  out.skipped = skipped;
  return out;
}
