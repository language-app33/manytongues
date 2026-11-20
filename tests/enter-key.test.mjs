// @ts-check
/*
 * Enter presses the screen's main button, on a computer (0.653).
 *
 * jsdom lays nothing out, so "shown" is stood in for here: an element is
 * shown unless it or something round it is `hidden`. The real browser is
 * where the layout is; this checks the choosing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { pressPrimaryOnEnter } from "../src/enter-key.ts";

/** @param {string} body @param {boolean} [computer] */
function page(body, computer = true) {
  const dom = new JSDOM(`<!doctype html><body>${body}</body>`);
  const win = /** @type {any} */ (dom.window);
  win.Element.prototype.getClientRects = function () {
    return this.closest("[hidden]") ? [] : [{}];
  };
  /** @type {string[]} */
  const pressed = [];
  for (const b of win.document.querySelectorAll("button")) {
    b.addEventListener("click", () => pressed.push(b.textContent.trim()));
  }
  pressPrimaryOnEnter(win, () => computer);
  /** @param {string} [selector] @param {Record<string, any>} [opts] */
  const enter = (selector, opts = {}) => {
    const at = selector ? win.document.querySelector(selector) : win.document.body;
    at.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...opts }));
  };
  return { win, pressed, enter };
}

test("Enter presses the one primary button, from the page or a field", () => {
  const { pressed, enter } = page(`
    <input id="name"><button class="at-btn ghost">Cancel</button><button class="at-btn primary">Save</button>`);
  enter();
  enter("#name");
  assert.deepEqual(pressed, ["Save", "Save"]);
});

test("not on a phone or tablet", () => {
  const { pressed, enter } = page(`<input id="a"><button class="at-btn primary">Check</button>`, false);
  enter("#a");
  assert.deepEqual(pressed, []);
});

test("two primaries, or none, and Enter does nothing", () => {
  const two = page(`<button class="at-btn primary">One</button><button class="at-btn primary">Two</button>`);
  two.enter();
  assert.deepEqual(two.pressed, []);
  const none = page(`<button class="at-btn">Plain</button><button class="at-btn danger">Delete</button>`);
  none.enter();
  assert.deepEqual(none.pressed, []);
});

test("an open dialog's button, not the screen's beneath it", () => {
  const { pressed, enter } = page(`
    <button class="at-btn primary">Start session</button>
    <div role="dialog" aria-modal="true"><button class="at-btn primary">Join</button></div>`);
  enter();
  assert.deepEqual(pressed, ["Join"]);
});

test("a dialog that is not open is not the layer", () => {
  const { pressed, enter } = page(`
    <button class="at-btn primary">Start session</button>
    <div role="dialog" aria-modal="true" hidden><button class="at-btn primary">Join</button></div>`);
  enter();
  assert.deepEqual(pressed, ["Start session"]);
});

test("hidden, disabled and toggled buttons are passed over", () => {
  const { pressed, enter } = page(`
    <div hidden><button class="at-btn primary">Other tab</button></div>
    <button class="at-btn primary" aria-pressed="true">Yes, all of it</button>
    <button class="at-btn primary">Check</button>`);
  enter();
  assert.deepEqual(pressed, ["Check"]);
  const dead = page(`<button class="at-btn primary" disabled>Check</button>`);
  dead.enter();
  assert.deepEqual(dead.pressed, []);
});

test("an `off` button takes the press, to say why", () => {
  const { pressed, enter } = page(`<button class="at-btn primary off" aria-disabled="true">New card</button>`);
  enter();
  assert.deepEqual(pressed, ["New card"]);
});

test("whatever already uses Enter keeps it", () => {
  const { pressed, enter, win } = page(`
    <textarea id="t"></textarea><input id="s" type="search"><select id="l"></select>
    <form><input id="f"></form><a id="a" href="#">x</a><button id="b" class="at-btn">Other</button>
    <input id="own"><div contenteditable="true" id="c"></div>
    <button class="at-btn primary">Save</button>`);
  win.document.querySelector("#own").addEventListener("keydown", (/** @type {any} */ e) => e.preventDefault());
  for (const id of ["t", "s", "l", "f", "a", "own", "c"]) enter(`#${id}`);
  /* A focused button presses itself, by the browser's own hand — not
     the primary on top of it. */
  enter("#b");
  assert.deepEqual(pressed, []);
});

test("held, modified or mid-composition presses are left alone", () => {
  const { pressed, enter } = page(`<button class="at-btn primary">Continue</button>`);
  enter(undefined, { repeat: true });
  enter(undefined, { shiftKey: true });
  enter(undefined, { metaKey: true });
  enter(undefined, { ctrlKey: true });
  enter(undefined, { isComposing: true });
  assert.deepEqual(pressed, []);
});
