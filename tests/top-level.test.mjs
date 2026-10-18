/*
 * A card that has climbed every level is asked its top and nothing else.
 *
 * Once a form has passed everything under its top level — Learnt,
 * Cleared, or back on its top after a slip there — a session asks it the
 * top questions that are due, and no others: no recognition question to
 * fall due and bring it round, none to fill a second place. A slip lower
 * down is the one thing that brings the rest of the ladder back, and the
 * card's own word cannot slip lower down while nothing lower is asked.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".top-level-build");

await build({
  entryPoints: [path.join(here, "..", "src", "ArabicTrainer.tsx")],
  outfile: path.join(out, "trainer.js"),
  bundle: true,
  format: "esm",
  jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  loader: { ".jsx": "jsx" },
  logLevel: "silent",
  define: {
    "process.env.NODE_ENV": '"development"',
    __APP_RELEASE__: '"0"',
    __APP_VERSION__: '"test"',
    __BUILT_AT__: '"0"',
  },
});
const { buildSession, installIndexes, laddered, mixCardsOf } = await import(path.join(out, "trainer.js"));
const { levelOf } = await import(path.join(here, "..", "src", "languages.ts"));

const settings = { language: "ar-PS" };
const DAY = 86400000;
const anyDeck = () => true;

/** A schedule in review, right twice running, due `inDays` from now. */
const kept = (/** @type {number} */ inDays, /** @type {number[]} */ hist = [1, 1], passes = 2) => ({
  phase: "review", step: 0, ease: 2.5, interval: 10, due: Date.now() + inDays * DAY,
  reps: 6, lapses: 0, right: 6, wrong: 0, skips: 0, near: 0, hints: 0,
  hist, passes, updated: Date.now() - 20 * DAY,
});

/**
 * A word with a picture, so its top level holds two questions — writing
 * it from its meaning and from its picture — with every key given `stateOf`.
 * @param {string} id
 * @param {(key: string, top: boolean) => any} stateOf
 * @returns {any}
 */
const climbed = (id, stateOf) => {
  const form = { id, ar: `كلمة${id}`, en: `word ${id}`, lat: `kalima ${id}`, lang: "ar-PS", images: ["a.png"], s: {} };
  const keys = laddered(form, settings);
  const top = Math.max(...keys.map(levelOf));
  /** @type {Record<string, any>} */
  const s = {};
  for (const k of keys) s[k] = stateOf(k, levelOf(k) === top);
  return { id, tags: [], created: 1, lang: "ar-PS", kind: "word", forms: [{ ...form, s }] };
};

/** A word nobody has met, to keep a session company. */
const fresh = (/** @type {string} */ id) => ({
  id, tags: [], created: 2, lang: "ar-PS", kind: "word",
  forms: [{ id, ar: `جديد${id}`, en: `new ${id}`, lat: `jadiid ${id}`, lang: "ar-PS", s: {} }],
});

const deal = (/** @type {any[]} */ items, /** @type {Record<string, any>} */ over = {}) => {
  installIndexes(items, settings);
  return buildSession({ items, settings, inDeck: anyDeck, ...over });
};

/** Which questions a session put to one card — once each, since a deck
    this small is topped up by asking the same ones again. */
const askedOf = (/** @type {any} */ got, /** @type {string} */ id) =>
  [...new Set((got.exercises || []).filter((/** @type {any} */ e) => e.id === id).map((/** @type {any} */ e) => e.type))].sort();

const topKeys = (/** @type {any} */ card) => {
  const keys = laddered(card.forms[0], settings);
  const top = Math.max(...keys.map(levelOf));
  return keys.filter((/** @type {string} */ k) => levelOf(k) === top).sort();
};

test("a word with a picture has two questions on its top level", () => {
  /* What the rest of this file stands on. */
  const card = climbed("w1", () => kept(1));
  assert.equal(topKeys(card).length, 2, topKeys(card).join(" "));
});

test("a learnt card is asked its top questions and none of the easier ones", () => {
  /* Everything overdue, the easy questions included: only the top is asked. */
  const card = climbed("w1", () => kept(-3));
  const got = deal([card, fresh("n1"), fresh("n2"), fresh("n3")]);
  assert.deepEqual(askedOf(got, "w1"), topKeys(card));
});

test("a learnt card does not come round because an easier question fell due", () => {
  /* The easy questions overdue, the top a week off: the card is not due. */
  const card = climbed("w1", (_k, top) => kept(top ? 7 : -3));
  installIndexes([card], settings);
  const [mixed] = mixCardsOf([card], [card], settings);
  assert.ok(mixed.due > Date.now() + 6 * DAY, "its date is its top questions'");
});

test("only the top questions that are due are asked", () => {
  const card = climbed("w1", (k, top) => kept(top && k === "en2ar" ? -1 : 7));
  const got = deal([card, fresh("n1"), fresh("n2"), fresh("n3")]);
  assert.deepEqual(askedOf(got, "w1"), ["en2ar"], "the one due, and not its partner a week off");
});

test("a card back on its top after a slip there is still asked only its top", () => {
  /* The top missed twice running: not Learnt any more, and on its top level. */
  const card = climbed("w1", (_k, top) => (top ? kept(-1, [1, 1, 0, 0], 0) : kept(-3)));
  const got = deal([card, fresh("n1"), fresh("n2"), fresh("n3")]);
  assert.deepEqual(askedOf(got, "w1"), topKeys(card));
});

test("a cleared card making its passes is asked only its top", () => {
  const card = climbed("w1", (_k, top) => (top ? kept(-1, [1, 1], 1) : kept(-3)));
  const got = deal([card, fresh("n1"), fresh("n2"), fresh("n3")]);
  assert.deepEqual(askedOf(got, "w1"), topKeys(card));
});

test("a slip lower down brings the rest of the ladder back", () => {
  /* Recognition missed twice running: the card is no longer past its lower
     levels, and that question is asked again. */
  const card = climbed("w1", (k) => (k === "ar2en" ? kept(-1, [1, 1, 0, 0], 0) : kept(-3)));
  const got = deal([card, fresh("n1"), fresh("n2"), fresh("n3")]);
  const asked = askedOf(got, "w1");
  assert.ok(asked.includes("ar2en"), `asked ${asked.join(" ")}`);
});

test("a card asked for by name with nothing due is asked its top questions", () => {
  const card = { ...climbed("w1", () => kept(7)), priority: true };
  const got = deal([card, fresh("n1"), fresh("n2"), fresh("n3")]);
  assert.deepEqual(askedOf(got, "w1"), topKeys(card));
});
