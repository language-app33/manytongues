/*
 * Progress set aside and brought back (0.580, audit finding 21).
 *
 * Two copies of "which schedules say nothing" disagreed: the one used when
 * a card's progress was set aside dropped a state that had been skipped
 * but never answered, so a card that came back had forgotten the skips.
 * There is one copy now, sync.ts's, and this is what it keeps.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { buildOnce } from "./helpers.mjs";

const dir = await buildOnce(["shared.tsx"]);
const { progressOf, withProgress } = await import(path.join(dir, "shared.js"));

const fresh = () => ({
  phase: "new", step: 0, ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0,
  right: 0, wrong: 0, skips: 0, near: 0, hints: 0, hist: [], updated: 0,
});

test("a skipped but never answered state survives being set aside and restored", () => {
  const skipped = { ...fresh(), skips: 2 };
  const item = {
    id: "k1", kind: "word", tags: [], created: 0, updated: 0,
    forms: [{ id: "k1-f", ar: "بيت", en: "house", lat: "beit", s: { ar2en: skipped, en2ar: fresh() } }],
  };
  const aside = progressOf(item);
  assert.deepEqual(aside.forms["k1-f"].s, { ar2en: skipped }, "the skips are kept, the untouched state is not");
  const home = withProgress({ ...item, forms: [{ ...item.forms[0], s: { ar2en: fresh(), en2ar: fresh() } }] }, aside);
  assert.equal(home.forms[0].s.ar2en.skips, 2, "and they come back with the card");
});
