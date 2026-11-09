// @ts-check
/*
 * The small things every test file wanted, in one place.
 *
 * Not named *.test.mjs on purpose: `npm test` runs tests/*.test.mjs, so a
 * file of helpers here is imported and never run as a suite of its own.
 */

/**
 * The one that has to be there.
 *
 * A `find` or a query that misses is a broken test, and without this the
 * miss surfaces two lines later as "cannot read properties of undefined",
 * which names neither what was looked for nor where. It also tells the
 * checker that everything after it is the thing, not perhaps-nothing —
 * which is what stops an assertion quietly comparing undefined against
 * undefined and passing.
 *
 * Throws rather than asserting, so the harnesses that are not node:test
 * files can use it too.
 *
 * @template T
 * @param {T | null | undefined} value
 * @param {string} what
 * @returns {T}
 */
export function must(value, what) {
  if (value === null || value === undefined) throw new Error(`expected to find ${what}`);
  return value;
}

/*
 * Main's invite code, for tests that make accounts (0.543).
 *
 * An account is made with an invite or course code; only the first account
 * on an empty site needs none. This makes that first account against the
 * server at `origin`, makes it the App admin with `adminKey`, and reads
 * Main's invite code — once per origin, however many tests ask.
 */
/** @type {Map<string, Promise<string>>} */
const mainCodes = new Map();
/**
 * @param {string} origin
 * @param {string} adminKey
 * @returns {Promise<string>}
 */
export function mainInviteCode(origin, adminKey) {
  let held = mainCodes.get(origin);
  if (!held) {
    held = (async () => {
      const post = (/** @type {string} */ action, /** @type {unknown} */ body, /** @type {string} */ key = "") =>
        fetch(`${origin}/api/courses?action=${action}`, {
          method: "POST",
          headers: { "content-type": "application/json", ...(key ? { "x-key": key } : {}) },
          body: JSON.stringify(body),
        }).then((r) => r.json());
      const first = await post("signup", { displayName: "Site owner" });
      await post("claim-admin", { adminKey }, first.key);
      const orgs = await fetch(`${origin}/api/courses?action=admin-orgs`, { headers: { "x-key": first.key } }).then((r) => r.json());
      return orgs.orgs.find((/** @type {any} */ o) => o.id === "main").inviteCode;
    })();
    mainCodes.set(origin, held);
  }
  return held;
}

/*
 * One build of the app's source per state of it, shared by every test file
 * (0.580, audit finding 22).
 *
 * Twenty-nine files each bundled src/ArabicTrainer.tsx into a directory of
 * their own, so a check built the app thirty times over. This builds once
 * for each distinct set of options and each state of src/, into
 * tests/.build/<hash>/, and every later caller — in this process or in one
 * of the others node --test runs side by side — reuses it.
 *
 * Node runs test files in parallel processes, so the first to arrive takes
 * a lock (an mkdir, which is atomic) and builds; the others wait for the
 * finished marker. A lock left by a process that died is broken after a
 * minute.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

/** @type {string | null} */
let sourceDigest = null;
/** A digest of every file under src/, read once per process. */
function digestOfSource() {
  if (sourceDigest) return sourceDigest;
  const hash = createHash("sha256");
  /** @param {string} dir */
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else {
        hash.update(path.relative(ROOT, full));
        hash.update(readFileSync(full));
      }
    }
  };
  walk(path.join(ROOT, "src"));
  sourceDigest = hash.digest("hex");
  return sourceDigest;
}

/** The defines every test build used, frozen the way vite freezes them. */
export const TEST_DEFINES = {
  "process.env.NODE_ENV": '"development"',
  __APP_RELEASE__: '"0"',
  __APP_VERSION__: '"test"',
  __BUILT_AT__: '"0"',
};

/**
 * Build `entries` (paths under src/) once, and say where the output is.
 * Each entry comes out as <dir>/<its name>.js.
 *
 * @param {string[]} entries e.g. ["ArabicTrainer.tsx"]
 * @param {Record<string, any>} [options] esbuild options laid over the defaults
 * @returns {Promise<string>} the directory holding the build
 */
export async function buildOnce(entries, options = {}) {
  /** @type {import("esbuild").BuildOptions} */
  const settings = {
    bundle: true,
    format: "esm",
    jsx: "automatic",
    platform: "browser",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".jsx": "jsx" },
    logLevel: "silent",
    define: TEST_DEFINES,
    ...options,
  };
  const hash = createHash("sha256")
    .update(digestOfSource())
    .update(JSON.stringify([entries, settings]))
    .digest("hex")
    .slice(0, 20);
  const base = path.join(ROOT, "tests", ".build");
  const dir = path.join(base, hash);
  const done = path.join(dir, ".done");
  if (existsSync(done)) return dir;
  mkdirSync(base, { recursive: true });
  const lock = path.join(base, `${hash}.lock`);
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch (e) {
      if (/** @type {NodeJS.ErrnoException} */ (e).code !== "EEXIST") throw e;
      if (existsSync(done)) return dir;
      try {
        if (Date.now() - statSync(lock).mtimeMs > 60000) rmSync(lock, { recursive: true, force: true });
      } catch (gone) {
        /* Released between the two looks. */
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  try {
    if (existsSync(done)) return dir;
    rmSync(dir, { recursive: true, force: true });
    const { build } = await import("esbuild");
    await build({
      ...settings,
      entryPoints: entries.map((e) => path.join(ROOT, "src", e)),
      outdir: dir,
      entryNames: "[name]",
    });
    writeFileSync(done, "");
    return dir;
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}
