/*
 * Basic and advanced cards (0.515): which saved cards open with "Build an
 * advanced card" ticked, what a basic card is saved as, and what the line
 * under the box says unticking it would drop.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { basicCard, droppedByBasic, opensAdvanced } from "../src/basic-card.ts";

const word = (/** @type {Record<string, any>} */ more = {}) => ({ id: "w", lang: "vi", forms: [{ ar: "nhà", lat: "", en: "house" }], ...more });

test("a plain one-form word opens as basic", () => {
  assert.equal(opensAdvanced(null), false);
  assert.equal(opensAdvanced(word()), false);
});

test("anything the basic form would not show opens it as advanced", () => {
  assert.ok(opensAdvanced(word({ forms: [{ ar: "a", en: "a", lat: "" }, { ar: "b", en: "b", lat: "" }] })));
  assert.ok(opensAdvanced(word({ category: "noun" })));
  assert.ok(opensAdvanced(word({ fills: ["place"] })));
  assert.ok(opensAdvanced(word({ ref: "home" })));
  assert.ok(opensAdvanced(word({ clue: "a building" })));
  assert.ok(opensAdvanced(word({ uses: ["x"] })));
  assert.ok(opensAdvanced(word({ sentence: true, forms: [{ ar: "x {{noun}}", en: "x {{noun}}", lat: "" }] })));
});

test("a basic card is saved as its word and nothing from the Advanced tab", () => {
  const main = { ar: "nhà", en: "house", lat: "" };
  const written = /** @type {any} */ ({
    forms: [main, { ar: "nhà nhỏ", en: "little house", lat: "" }],
    note: "", name: "house", examples: [{ ar: "x" }], category: "noun", sentence: false,
    decks: ["d"], uses: ["u"], fills: ["place"], ref: "home", spread: [], stripped: [], drill: false, scene: null,
  });
  const out = basicCard(written, main);
  assert.deepEqual(out.forms, [main]);
  assert.equal(out.category, "");
  assert.deepEqual(out.fills, []);
  assert.equal(out.ref, "");
  assert.deepEqual(out.uses, []);
  assert.deepEqual(out.examples, []);
  assert.deepEqual(out.decks, ["d"]);
  assert.equal(out.name, "house");
  assert.equal(out.drill, true);
});

test("unticking says what saving would drop, and nothing when there is nothing", () => {
  const blank = { forms: [{ ar: "nhà", en: "house" }], tableCells: [], category: "", fills: [], refName: "", uses: [], writtenExamples: [] };
  assert.deepEqual(droppedByBasic(/** @type {any} */ (blank), "", "word"), []);
  const full = { ...blank, forms: [...blank.forms, { ar: "b", en: "b" }], category: "noun", fills: ["x"] };
  assert.deepEqual(droppedByBasic(/** @type {any} */ (full), "a building", "sentence"), [
    "the sentence", "1 other form", "the subtype", "the blanks it fills", "the clue for its other meanings",
  ]);
});

test("grammar is not on a basic card: a card that says some opens as advanced, and a basic save drops it", async () => {
  const { hasGrammar, withoutGrammar } = await import("../src/basic-card.ts");
  const { GRAMMAR } = await import("../src/languages.ts");
  const dim = /** @type {any} */ (Object.values(GRAMMAR).find((d) => !d.required));
  const said = dim.options.map(([v]) => v).find(Boolean);
  const plainForm = { ar: "nhà", en: "house", lat: "" };
  assert.equal(hasGrammar(plainForm), false);
  const told = { ...plainForm, answers: [{ text: "nhà", [dim.field]: said }] };
  assert.equal(hasGrammar(told), true);
  assert.equal(opensAdvanced(word({ forms: [told] })), true);
  assert.equal(hasGrammar(withoutGrammar(told)), false);
  assert.equal(withoutGrammar(told).answers[0].text, "nhà");
  /* Required ones at their default say nothing. */
  for (const d of Object.values(GRAMMAR).filter((d) => d.required)) {
    assert.equal(hasGrammar({ ...plainForm, [d.field]: d.default || d.options[0][0] }), false, d.field);
  }
  assert.ok(droppedByBasic(/** @type {any} */ ({ forms: [told] }), "", "word").includes("the grammar"));
  assert.equal(hasGrammar(basicCard(/** @type {any} */ ({ forms: [told] }), told).forms[0]), false);
});
