/*
 * The card on Home (0.664): a shape in the logo's style, a fact about a
 * dialect or regional language with its source, and the short line inside
 * the Practice button. See src/home-card.ts.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { HOME_FACTS, HOME_SHAPES, homeCardAt, practiceLine } from "../src/home-card.ts";

test("every fact has a title, a short text and a source that opens in the browser", () => {
  assert.ok(HOME_FACTS.length >= 20, `only ${HOME_FACTS.length} facts`);
  const ids = new Set();
  for (const f of HOME_FACTS) {
    assert.ok(!ids.has(f.id), `${f.id} is listed twice`);
    ids.add(f.id);
    assert.ok(f.about.trim() && f.about.length <= 30, `${f.id}: a short title`);
    /* About three lines under the shape on a phone, as approved. */
    assert.ok(f.text.length <= 110, `${f.id} runs to ${f.text.length} characters`);
    assert.doesNotMatch(f.text, /[—;]/, `${f.id}: no dashes or semicolons, as the facts were written`);
    assert.match(f.source, /^https:\/\//, `${f.id}: its source is a web page`);
    assert.ok(f.sourceName.trim(), `${f.id}: its source is named`);
  }
});

test("twenty shapes, each drawn only in the logo's colours and its dot", () => {
  assert.equal(HOME_SHAPES.length, 20);
  const names = new Set(HOME_SHAPES.map((s) => s.name));
  assert.equal(names.size, 20, "each shape has its own name");
  for (const s of HOME_SHAPES) {
    assert.ok(s.marks.length > 0, `${s.name} draws something`);
    for (const m of s.marks) {
      if (m.kind === "line") {
        assert.ok(["yellow", "coral", "mint", "lavender"].includes(m.colour), `${s.name}: ${m.colour}`);
        assert.match(m.d, /^M[\d.\s-]+[CL]/, `${s.name}: a drawn line`);
        assert.doesNotMatch(m.d, /NaN|undefined/, `${s.name}: no broken numbers in its path`);
      } else {
        assert.equal(m.kind, "dot");
        assert.ok(m.r > 0 && m.r <= 8, `${s.name}: the logo's small dot`);
      }
    }
  }
  /* Drawn the same way every time: a shape is part of the brand, not a
     surprise. */
  assert.deepEqual(JSON.parse(JSON.stringify(HOME_SHAPES)), JSON.parse(JSON.stringify(HOME_SHAPES)));
});

test("shapes and facts turn separately, so a fact meets a different shape each time round", () => {
  const first = homeCardAt(0);
  assert.equal(first.shape, HOME_SHAPES[0]);
  assert.equal(first.fact, HOME_FACTS[0]);
  /* One turn moves both on. */
  assert.equal(homeCardAt(1).shape, HOME_SHAPES[1]);
  assert.equal(homeCardAt(1).fact, HOME_FACTS[1]);
  /* After twenty turns the shapes start again but the facts carry on. */
  assert.equal(homeCardAt(20).shape, HOME_SHAPES[0]);
  assert.equal(homeCardAt(20).fact, HOME_FACTS[20 % HOME_FACTS.length]);
  /* A count that is not a count shows the first card rather than nothing. */
  assert.equal(homeCardAt(NaN).fact, HOME_FACTS[0]);
  assert.equal(homeCardAt(-3).fact, HOME_FACTS[0]);
});

test("the Practice button says what it will deal, in a few words", () => {
  assert.equal(practiceLine({ review: 6, climbing: 3, fresh: 0, behind: false }), "6 to review · 3 in progress");
  assert.equal(practiceLine({ review: 12, climbing: 0, fresh: 3, behind: false }), "12 to review · 3 new");
  assert.equal(practiceLine({ review: 0, climbing: 5, fresh: 2, behind: false }), "5 in progress · 2 new");
  assert.equal(practiceLine({ review: 0, climbing: 0, fresh: 4, behind: false }), "4 new");
  /* A pile of reviews holding new cards back says so. */
  assert.equal(practiceLine({ review: 40, climbing: 0, fresh: 0, behind: true }), "40 to review · new cards wait");
  /* There is always a session to start: caught up is said, not hidden. */
  assert.equal(practiceLine({ review: 0, climbing: 0, fresh: 0, behind: false }), "All caught up");
});

test("the facts start on the second day of practice, after a welcome (0.666)", async () => {
  const { homeStage, HOME_WELCOME } = await import("../src/home-card.ts");
  const today = "2026-11-24";
  /* Nothing practised yet, or only days with nothing answered. */
  assert.equal(homeStage(undefined, today), "new");
  assert.equal(homeStage({}, today), "new");
  assert.equal(homeStage({ "2026-11-20": 0 }, today), "new");
  /* Practised today, and never before. */
  assert.equal(homeStage({ [today]: 12 }, today), "first");
  /* Any other day of practice: the facts. A student back this morning
     sees them before practising again. */
  assert.equal(homeStage({ "2026-11-23": 20 }, today), "learning");
  assert.equal(homeStage({ "2026-11-23": 20, [today]: 4 }, today), "learning");
  /* The owner's wording, and never "words". */
  for (const line of Object.values(HOME_WELCOME)) assert.doesNotMatch(line, /\bwords?\b/i);
  assert.match(HOME_WELCOME.new, /^Welcome!/);
  assert.match(HOME_WELCOME.first, /cards/);
});
