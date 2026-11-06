#!/usr/bin/env node
/*
 * Which of src/index.css's rules only the teaching screens use, written out
 * as src/teaching.css (0.580, audit finding 20).
 *
 * About a fifth of the stylesheet styled screens a learner never opens —
 * Teaching, Admin, Super admin, the card and number editors, the gallery,
 * the review sheet — and every learner downloaded it. Those screens arrive
 * in one lazily loaded chunk (spaces.tsx and what it imports), and a
 * stylesheet that file imports arrives with it.
 *
 * A rule is *teaching* when every class it names appears in one of the lazy
 * files and in no other file under src/, nor in index.html. Anything else
 * stays: a rule naming no class (an element, :root and its tokens), a rule
 * naming a class a learner's screen uses, @keyframes and @font-face. A rule
 * inside @media or @supports is judged on its own and moved with a copy of
 * its wrapper. A class is found by its whole name, so a class that is only
 * ever put together in code (`at-cardtable-${key}`) is never seen as
 * teaching-only and stays where it is.
 *
 * Run by hand:
 *
 *   node scripts/css-split.mjs            prints both lists, writes src/teaching.css
 *   node scripts/css-split.mjs --moved X  also writes the moved rules' text to X,
 *                                          one JSON string each
 *
 * It never changes src/index.css. Taking the moved rules out of it is done
 * once, by hand, from the list, so the diff can be read.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = path.join(root, "src");
const LAZY = ["spaces.tsx", "card-editor.tsx", "number-system-editor.tsx", "gallery.tsx", "review-sheet.tsx", "pronouns-editor.tsx"];

/** @param {string} dir @returns {string[]} */
const filesIn = (dir) => readdirSync(dir).flatMap((n) => {
  const full = path.join(dir, n);
  return statSync(full).isDirectory() ? filesIn(full) : [full];
});

const code = filesIn(src).filter((f) => !f.endsWith(".css"));
const lazyText = code.filter((f) => LAZY.includes(path.basename(f))).map((f) => readFileSync(f, "utf8")).join("\n");
const otherText = code.filter((f) => !LAZY.includes(path.basename(f))).map((f) => readFileSync(f, "utf8"))
  .concat([readFileSync(path.join(root, "index.html"), "utf8")]).join("\n");

/** Whether a class appears whole in some text. @param {string} text @param {string} name */
const has = (text, name) => new RegExp(`(^|[^A-Za-z0-9_-])${name.replace(/-/g, "\\-")}($|[^A-Za-z0-9_-])`).test(text);

/**
 * A stylesheet, split into its top-level pieces. Comments and whitespace
 * are pieces of their own, so the text is the pieces joined.
 * @param {string} text
 * @returns {{ kind: "space" | "comment" | "rule" | "at" | "statement", text: string, prelude?: string, body?: string }[]}
 */
export function pieces(text) {
  /** @type {any[]} */
  const out = [];
  let i = 0;
  const n = text.length;
  const skipString = (/** @type {number} */ j) => {
    const q = text[j];
    j += 1;
    while (j < n && text[j] !== q) j += text[j] === "\\" ? 2 : 1;
    return j + 1;
  };
  while (i < n) {
    if (text.startsWith("/*", i)) {
      const j = text.indexOf("*/", i) + 2;
      out.push({ kind: "comment", text: text.slice(i, j) });
      i = j;
      continue;
    }
    if (/\s/.test(text[i])) {
      let j = i;
      while (j < n && /\s/.test(text[j])) j += 1;
      out.push({ kind: "space", text: text.slice(i, j) });
      i = j;
      continue;
    }
    let j = i;
    while (j < n && text[j] !== "{" && text[j] !== ";") {
      if (text.startsWith("/*", j)) j = text.indexOf("*/", j) + 2;
      else if (text[j] === '"' || text[j] === "'") j = skipString(j);
      else j += 1;
    }
    if (j >= n || text[j] === ";") {
      out.push({ kind: "statement", text: text.slice(i, Math.min(n, j + 1)) });
      i = j + 1;
      continue;
    }
    let depth = 0;
    let k = j;
    for (;;) {
      if (text.startsWith("/*", k)) {
        k = text.indexOf("*/", k) + 2;
        continue;
      }
      const c = text[k];
      if (c === '"' || c === "'") {
        k = skipString(k);
        continue;
      }
      if (c === "{") depth += 1;
      else if (c === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
      k += 1;
    }
    const prelude = text.slice(i, j);
    out.push({
      kind: prelude.trim().startsWith("@") ? "at" : "rule",
      text: text.slice(i, k + 1),
      prelude,
      body: text.slice(j + 1, k),
    });
    i = k + 1;
  }
  return out;
}

/** The classes a selector names. @param {string} sel */
const classesOf = (sel) => [...sel.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/\.((?:at|ob)-[A-Za-z0-9_-]+)/g)].map((m) => m[1]);

/** Whether a rule is the teaching screens' alone. @param {string} prelude */
export function teachingOnly(prelude) {
  const names = classesOf(prelude);
  return names.length > 0 && names.every((c) => has(lazyText, c) && !has(otherText, c));
}

/**
 * Split a sheet: what moves (as text, wrapped where it was wrapped) and the
 * class lists printed for review.
 * @param {string} css
 */
export function split(css) {
  /** @type {{ text: string, wrapper: string | null, rule: string }[]} */
  const moved = [];
  /** @type {string[]} */
  const kept = [];
  const all = pieces(css);
  /* The comment written right above a rule, with nothing but a line break
     between, is about that rule, and goes where it goes. */
  const noteOf = (/** @type {number} */ i) => {
    const gap = all[i - 1];
    const note = all[i - 2];
    if (gap && gap.kind === "space" && (gap.text.match(/\n/g) || []).length <= 1 && note && note.kind === "comment") {
      return note.text + gap.text;
    }
    return "";
  };
  for (let i = 0; i < all.length; i++) {
    const p = all[i];
    if (p.kind === "rule") {
      if (teachingOnly(p.prelude || "")) moved.push({ text: noteOf(i) + p.text, wrapper: null, rule: p.text });
      else kept.push((p.prelude || "").trim());
    } else if (p.kind === "at" && /^\s*@(media|supports)\b/.test(p.prelude || "")) {
      for (const q of pieces(p.body || "")) {
        if (q.kind !== "rule") continue;
        if (teachingOnly(q.prelude || "")) moved.push({ text: q.text, wrapper: (p.prelude || "").trim(), rule: q.text });
        else kept.push(`${(p.prelude || "").trim()} ${(q.prelude || "").trim()}`);
      }
    }
  }
  return { moved, kept };
}

/** The moved rules as a stylesheet, each wrapped rule in its own wrapper. @param {{ text: string, wrapper: string | null }[]} moved */
export function sheetOf(moved) {
  const head = "/*\n * The teaching screens' own styles, loaded with them (0.580): written by\n * scripts/css-split.mjs out of index.css, which keeps everything a learner's\n * screen uses. A rule here names only classes the teaching screens use.\n */\n";
  return head + moved.map((m) => (m.wrapper ? `${m.wrapper} {\n  ${m.text.trim()}\n}` : m.text.trim())).join("\n") + "\n";
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const css = readFileSync(path.join(src, "index.css"), "utf8");
  const { moved, kept } = split(css);
  writeFileSync(path.join(src, "teaching.css"), sheetOf(moved));
  const bytes = moved.reduce((n, m) => n + m.text.length, 0);
  console.log(`moving ${moved.length} rules (${bytes} bytes of ${css.length}) to src/teaching.css; keeping ${kept.length}`);
  for (const m of moved) console.log(`  move  ${m.wrapper ? m.wrapper + " " : ""}${(m.text.split("{")[0] || "").trim()}`);
  const at = process.argv.indexOf("--moved");
  if (at > 0 && process.argv[at + 1]) writeFileSync(process.argv[at + 1], JSON.stringify(moved.map((m) => m.text)));
}
