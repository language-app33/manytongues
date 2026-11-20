// @ts-check
/*
 * Pictures and recordings added offline in the card editor (0.659): which
 * a card names, and the card without the ones the server refused. The
 * storage half needs IndexedDB and is checked in the app.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const { mediaIn, withoutMedia, heldData, holdMedia, heldCounts } = await import("../src/held-media.ts");

const card = {
  id: "c1",
  forms: [
    { ar: "kalb", en: "dog", lat: "kalb", clips: ["r1"], slowClips: ["r2"], voices: { r1: "Rana", r2: "Sami" }, images: ["p1", "p2"] },
    { ar: "klab", en: "dogs", lat: "klab", clips: ["r1"] },
  ],
  lines: [{ ar: "", en: "", lat: "", clips: ["r3"], images: [] }],
};

test("every picture and recording a card names, once each, anywhere in it", () => {
  assert.deepEqual(mediaIn(card).sort(), ["p1", "p2", "r1", "r2", "r3"]);
  assert.deepEqual(mediaIn({ forms: [{ ar: "x" }] }), []);
  assert.deepEqual(mediaIn(null), []);
});

test("a refused picture or recording is taken off the card, with its speaker", () => {
  const out = withoutMedia(card, ["p1", "r1"]);
  assert.deepEqual(out.forms[0].images, ["p2"]);
  assert.deepEqual(out.forms[0].clips, []);
  assert.deepEqual(out.forms[0].slowClips, ["r2"]);
  assert.deepEqual(out.forms[0].voices, { r2: "Sami" });
  assert.deepEqual(out.forms[1].clips, []);
  assert.deepEqual(out.lines[0].clips, ["r3"]);
  assert.equal(out.forms[0].ar, "kalb", "everything else as it was");
  assert.deepEqual(card.forms[0].images, ["p1", "p2"], "the card handed in is not changed");
  assert.equal(withoutMedia(card, []), card);
});

test("without IndexedDB nothing is kept, and nothing is claimed", async () => {
  assert.equal(await holdMedia("image", "h", "data:image/png;base64,AA"), false);
  assert.equal(await heldData("h"), null);
  assert.deepEqual(await heldCounts(), { clips: 0, images: 0 });
});
