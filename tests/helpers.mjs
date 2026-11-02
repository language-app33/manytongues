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
