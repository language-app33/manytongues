// @ts-check
/*
 * The offer to install says where the button is in the browser the app is
 * open in (0.642). See src/install-steps.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const { installHow } = await import(path.join(here, "..", "src", "install-steps.ts"));

const UA = {
  iosSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  iosChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  iosFirefox: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15",
  iosInstagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101",
  ipadDesktop: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  samsung: "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0",
  androidWebView: "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  desktopChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  desktopEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  desktopFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
};

test("Safari on an iPhone is sent to Share", () => {
  const how = installHow({ ua: UA.iosSafari });
  assert.match(how.steps, /Share button/);
  assert.match(how.steps, /Add to Home Screen/);
  assert.match(how.lead, /home screen/);
});

test("Chrome and Firefox on an iPhone each have their own way to Share", () => {
  assert.match(installHow({ ua: UA.iosChrome }).steps, /address bar/);
  assert.match(installHow({ ua: UA.iosFirefox }).steps, /menu \(☰\), then Share/);
});

test("an app's own browser is told to open Safari or Chrome first", () => {
  assert.match(installHow({ ua: UA.iosInstagram }).steps, /in Safari first/);
  assert.match(installHow({ ua: UA.androidWebView }).steps, /in Chrome first/);
});

test("an iPad asking for the desktop site is still an iPad", () => {
  assert.match(installHow({ ua: UA.ipadDesktop, touch: 5 }).steps, /Add to Home Screen/);
  assert.match(installHow({ ua: UA.macSafari, touch: 0 }).steps, /Add to Dock/);
});

test("Android browsers name their own menus", () => {
  assert.match(installHow({ ua: UA.androidChrome }).steps, /menu \(⋮\).*Add to Home screen/);
  assert.match(installHow({ ua: UA.samsung }).steps, /Add page to/);
  assert.match(installHow({ ua: UA.androidFirefox }).steps, /menu \(⋮\)/);
  /* No Share menu anywhere on Android, which is what the old line said. */
  for (const ua of [UA.androidChrome, UA.samsung, UA.androidFirefox]) {
    assert.doesNotMatch(installHow({ ua }).steps, /Share/);
  }
});

test("where the browser offers its own installer, no directions are needed", () => {
  assert.equal(installHow({ ua: UA.androidChrome }, true).steps, "");
  assert.equal(installHow({ ua: UA.desktopChrome }, true).steps, "");
});

test("a computer is asked to install, not to add to a home screen", () => {
  assert.match(installHow({ ua: UA.desktopChrome }).lead, /^Install ManyTongues/);
  assert.match(installHow({ ua: UA.desktopEdge }).steps, /Install this site as an app/);
});

test("Firefox on a computer cannot install a site, so it is not offered", () => {
  assert.equal(installHow({ ua: UA.desktopFirefox }), null);
});
