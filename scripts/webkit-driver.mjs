// @ts-nocheck — a harness run by hand, not part of the app.
// The app in a real WebKit, the engine Safari is built on (0.728; see
// docs/DEBUGGING-on-a-phone.md, "A real WebKit"). Chromium made to look like
// an iPhone is still Chromium: it says nothing about what Safari's engine
// makes of the code. This drives WebKitGTK through its WebDriver, which
// needs two system packages and nothing from Playwright:
//
//   apt-get install -y webkit2gtk-driver xvfb
//
//   import { open } from "./scripts/webkit-driver.mjs";
//   const b = await open();
//   await b.goto("http://127.0.0.1:3111/");
//   await b.clickText("^practice");          // a real click, as a finger's is
//   console.log(await b.js(`function () { return document.title; }`));
//   await b.shot("/tmp/page.png");
//   await b.close();
//
// Its windows are private ones, so it also shows what a private window in
// Safari does. It is not an iPhone: no on-screen keyboard, no notch, no
// home-screen install.
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
export async function open({ port = 4555, w = 390, h = 844, display = ":97" } = {}) {
  const xv = spawn("Xvfb", [display, "-screen", "0", "1400x1200x24"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 700));
  const drv = spawn("WebKitWebDriver", [`--port=${port}`], { env: { ...process.env, DISPLAY: display, WEBKIT_DISABLE_COMPOSITING_MODE: "1", LIBGL_ALWAYS_SOFTWARE: "1" }, stdio: "ignore" });
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, p, body) => {
    const r = await fetch(base + p, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await r.json(); if (j.value && j.value.error) throw new Error(`${p}: ${j.value.error}: ${j.value.message}`); return j.value;
  };
  let s; for (let i = 0; i < 40; i++) { try { s = await call("POST", "/session", { capabilities: { alwaysMatch: { "webkitgtk:browserOptions": { binary: "/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/MiniBrowser", args: ["--automation"] } } } }); break; } catch (e) { if (i === 39) throw e; await new Promise((r) => setTimeout(r, 300)); } }
  const sid = s.sessionId; const P = `/session/${sid}`;
  await call("POST", `${P}/window/rect`, { width: w, height: h, x: 0, y: 0 });
  const EL = "element-6066-11e4-a52e-4f735466cecf";
  const api = {
    caps: s.capabilities,
    goto: (url) => call("POST", `${P}/url`, { url }),
    refresh: () => call("POST", `${P}/refresh`, {}),
    js: (fn, ...args) => call("POST", `${P}/execute/sync`, { script: `return (${fn}).apply(null, arguments)`, args }),
    jsAsync: (fn, ...args) => call("POST", `${P}/execute/async`, { script: `const cb = arguments[arguments.length-1]; Promise.resolve((${fn}).apply(null, Array.prototype.slice.call(arguments,0,-1))).then(cb, e => cb({__err: String(e)}))`, args }),
    shot: async (file) => writeFile(file, Buffer.from(await call("GET", `${P}/screenshot`), "base64")),
    find: async (css) => (await call("POST", `${P}/elements`, { using: "css selector", value: css })).map((e) => e[EL]),
    xpath: async (xp) => (await call("POST", `${P}/elements`, { using: "xpath", value: xp })).map((e) => e[EL]),
    click: (id) => call("POST", `${P}/element/${id}/click`, {}),
    type: (id, text) => call("POST", `${P}/element/${id}/value`, { text }),
    text: (id) => call("GET", `${P}/element/${id}/text`),
    clickText: async (re) => {
      const id = await api.js(`function(src){const re=new RegExp(src,'i');const els=[...document.querySelectorAll('button,a,[role=button],label,summary')].filter(e=>e.offsetParent!==null&&re.test((e.innerText||e.getAttribute('aria-label')||'').trim()));if(!els.length)return null;els[0].setAttribute('data-wd','1');return els.length}`, re);
      if (!id) return false; const [el] = await api.find("[data-wd='1']"); await api.js(`function(){document.querySelectorAll('[data-wd]').forEach(e=>e.removeAttribute('data-wd'))}`); await api.click(el); return true;
    },
    setRect: (w, h) => call("POST", `${P}/window/rect`, { width: w, height: h, x: 0, y: 0 }),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    close: async () => { try { await call("DELETE", P); } catch { /* already gone */ } drv.kill(); xv.kill(); },
  };
  return api;
}
