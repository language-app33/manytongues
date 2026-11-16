# Plan: sign-in links for students

Nov 16, 2026 · draft for approval · one release, 0.637

A student gets a private link beside their sign-in key. Opening it signs the
device in and shows their space, with nothing to type. The key stays, and
keeps working exactly as today.

## For the owner: what this builds

**What changes for students.** Wherever a student sees their key, they also
see "Your private sign-in link": when they first join, and on their account
page at any time. Opening the link on any device signs them in and lands
them on their space's home page. A student whose account was made for them
is no longer stopped to tick "I've saved my key" when they arrive by link.

**What changes for admins.** When an admin adds a student or gives one a new
key, the link is shown under the key, to pass on privately. For anyone who
teaches or manages, only the key is shown, as today.

**The rules, as decided.**

1. A link works for as long as the key does. A new key kills the old link.
2. Links are for students only. Anyone who teaches a course, runs a space or
   is the App admin is key only; an old link of theirs is refused with
   "Sign-in links are for students. Type your sign-in key instead."
3. If the device is signed in as someone else, it asks before switching:
   "Switch to Lina?".
4. Pasting a whole link into the sign-in key box works too.
5. No QR code. Setting up a whole class at once is left for later.

**What it costs.** One release. Nothing changes in how accounts or keys are
stored. On an iPhone, an app installed to the home screen has to be signed
in once by pasting the link or key, because a link always opens the browser.

**How it is checked.** New automated tests for the link itself, for the
server's "students only" rule, and a walk through the real screens. The full
check passes before it goes to beta. A list to try by hand is at the end.

---

## For the build

Everything below is for whoever implements this. Read all of it before
changing anything. Read `CLAUDE.md` first: it says how work is delivered
here (branch, `npm run check`, version, changelog, push to `beta`).

### Ground rules

- Do the stages in order. Run `npm run check` after each stage and fix what
  it reports before going on. It must be green at the end.
- Find code by the **search strings** given here, not by line number; the
  files are very large and lines move.
- Do not add a server action. Do not add a dependency. Do not add a CSS
  class; reuse what the neighbouring code uses.
- Do not change how keys are made, hashed, stored or sent. A link is only
  another way of carrying the same key to the same `whoami` call.
- Copy the wording in this plan exactly. Screen text is checked by tests.
- `src/main.tsx` renders under `React.StrictMode`, so every effect runs
  twice in development. Each new effect that starts a request must be
  guarded with a `useRef` flag so it starts once.
- If a test that already exists fails because it looks for old wording you
  were told to change, update that test's expected text. If it fails for
  any other reason, the change is wrong: fix the change, never the test.

### The shape of it

- A link is `<origin>/<space address>#key=<sign-in key>`, for example
  `https://manytongues.co/lingua#key=cedar-harbour-quartz-ember-4f2a`.
  The key is after `#` on purpose: browsers never send that part to a
  server. Never put the key in the path or after `?`.
- The server decides who is "key only" in one function, and says so in a
  new field, `keyOnly`, on the answers that already exist.
- A device that signs in from a link tells the server so (`via=link`), and
  the server refuses a key-only account with the error `key-only`.

### Stage 1 — the link itself (new file, no behaviour yet)

Create `src/sign-in-link.ts` with three pure functions and nothing else. No
imports from the app, no reading of `window`.

```ts
/* A sign-in key as the server makes it: words and a tail, joined by dashes. */
const KEY_SHAPE = /^[a-z0-9]+(-[a-z0-9]+){2,7}$/;

/** The private link that signs a student in: the space's address, the key after #. */
export function signInLink(origin: string, slug: string, key: string): string {
  return `${origin}/${slug}#key=${key}`;
}

/** The key in an address's `#…` part, or "" when it holds none. */
export function keyFromHash(hash: string): string {
  const m = /^#key=([^&]+)$/.exec(hash || "");
  const key = m ? decodeURIComponent(m[1]).trim() : "";
  return KEY_SHAPE.test(key) ? key : "";
}

/** The key in a pasted sign-in link, or "" when the text is not one. */
export function keyFromLink(text: string): string {
  try {
    return keyFromHash(new URL(text.trim()).hash);
  } catch (e) {
    return "";
  }
}
```

`decodeURIComponent` can throw on a malformed `%`; wrap that line in
try/catch and return `""`.

Create `tests/sign-in-link.test.mjs` (copy the import style of
`tests/contrast.test.mjs`). Test that:

- `keyFromHash(new URL(signInLink(o, "lingua", k)).hash) === k` for a real
  shaped key;
- `keyFromHash` gives `""` for `""`, `"#"`, `"#key="`, `"#key=one"`,
  `"#join=abc"`, `"#key=a-b-c&x=1"`, and a key with a space or `<` in it;
- `keyFromLink` gives the key for a whole link, and `""` for a bare key, an
  invitation link (`…/lingua?join=abc-def-1234`) and plain words.

### Stage 2 — the server (`server/api/courses.js`)

**2.1 One judge.** Next to `isTeacher` (search `const isTeacher =`), add:

```js
/*
 * Key only (0.637): whoever teaches a course, runs a space or is the App
 * admin signs in with their key, never by a sign-in link. Read straight
 * from the store, across every space, whatever space the request acts in.
 */
/** @type {(store: Store, user: any) => Promise<boolean>} */
async function keyOnly(store, user) {
  if (!user) return true;
  if (user.admin) return true;
  for (const id of memberOf(user)) {
    const o = await readJson(store, K.org(id));
    if (o && (o.admins || []).includes(user.handle)) return true;
  }
  const ids = await readIndex(store, "courses");
  const courses = await readManyJson(store, ids.map((/** @type {string} */ id) => K.course(id)));
  return courses.some((/** @type {any} */ c) => c && (c.teachers || []).includes(user.handle));
}
```

Use `readJson` / `readManyJson` directly as written. Do **not** use
`readCourse`, `readUser` or `everyCourse` here: those hide other spaces.
If `memberOf` is defined below this point as a `const`, put `keyOnly` after
it.

**2.2 whoami.** Search `if (action === "signin" || action === "whoami")`.

- Straight after the `suspended-app` line in that block, add:

  ```js
  const only = await keyOnly(store, found);
  if (url.searchParams.get("via") === "link" && only) return json({ error: "key-only" }, 403);
  ```

- That block has two `return json({ ok: true, user: { … } })`. Add
  `keyOnly: only,` inside `user` in **both**.

**2.3 signup.** Search `// The key is shown once and cannot be read back`.
In the `user` of that answer add
`keyOnly: !!(target && target.kind === "course" && target.asTeacher),`.

**2.4 admin-create-user.** Search `if (action === "admin-create-user")`.
Replace its last line `return json({ ok: true, user, key });` with:

```js
return json({ ok: true, user, key, keyOnly: await keyOnly(store, user), slug: actingOrgDoc ? actingOrgDoc.slug : "" });
```

**2.5 admin-reissue-key.** Search `if (action === "admin-reissue-key")`.
Replace its `return json({ ok: true, handle, key });` with:

```js
/* The address of a space they are in, for their sign-in link (0.637). */
let slug = "";
for (const id of memberOf(target)) {
  const o = await readJson(store, K.org(id));
  if (o && !o.archived) { slug = o.slug; break; }
}
return json({ ok: true, handle, key, keyOnly: await keyOnly(store, target), slug });
```

Leave `admin-create-org` alone: a space admin is key only.

**2.6 Server test.** Create `tests/sign-in-link-server.test.mjs`. Copy the
top of `tests/spaces.test.mjs` (temp data dir, `ADMIN_KEY`, `createApp`,
the `api` helper, `signup`, the `after` clean-up) and its `furnish` function
to see how a course, a teacher and a student are made. Assert:

1. A student: `whoami` answers `user.keyOnly === false`; `whoami` with
   `params: { via: "link" }` answers 200.
2. A teacher of a course: `whoami` answers 200 with `keyOnly === true`;
   with `via=link` answers 403 and `error === "key-only"`.
3. The same for a space admin (made by `admin-create-org`) and for the App
   admin.
4. A teacher in space B who is only a student in Main is still key only
   when asking with `org` set to Main.
5. `admin-create-user` with `roles: ["student"]` answers `keyOnly === false`
   and the acting space's `slug`; with `roles: ["teacher"]` and a real
   `courseId`, `keyOnly === true`.
6. `admin-reissue-key` for a student answers `keyOnly === false` and a
   `slug`; afterwards `whoami` with the **old** key and `via=link` answers
   401 `bad-key`, and with the new key answers 200.
7. A student who teaches nothing, then is made a teacher of a course
   (`assign-teacher`; see how `spaces.test.mjs` calls it), flips from 200 to
   403 on `via=link` with the same key.

### Stage 3 — the client's calls and types

- `src/types.ts`, in `interface User`, after `keySaved`:

  ```ts
  /** Teaches, runs a space or is the App admin: key only, no sign-in link (0.637). Worked out by the server, never stored. Absent from an older server: treat as key only. */
  keyOnly?: boolean;
  ```

- `src/courses-api.ts`, search `export const whoAmI`. Add a fourth
  argument:

  ```ts
  export const whoAmI = (key: string, org?: string, code?: string, viaLink = false) =>
    call("whoami", { key, params: { ...(org ? { org } : {}), ...(code ? { code } : {}), ...(viaLink ? { via: "link" } : {}) } });
  ```

  Existing callers pass three or fewer arguments and need no change.

- Same file, in `explain`, next to `"bad-key"`, add:

  ```ts
  "key-only": "Sign-in links are for students. Type your sign-in key instead.",
  ```

**One rule for every screen below:** show a link only when
`keyOnly === false`. `undefined` means do not show it.

### Stage 4 — arriving by link, signed out (`src/spaces.tsx`, `Onboarding`)

**4.1 Props.** In `interface OnboardingPlace` (search `From an invite link`)
add:

```ts
/** From a sign-in link, `#key=` (0.637). */
linkKey?: string;
/** The address's space is known (or there is none), so the link can be tried. */
linkReady?: boolean;
```

**4.2 A waiting step.** The `step` state starts as `"new"` or `"choose"`.
Make it start as `"link"` when `place.linkKey` is set. Add a block beside
the other steps:

```tsx
{!elsewhere && step === "link" && (
  <>
    <img className="ob-logo" src={org && org.logoData ? org.logoData : "/logo.svg"} alt="" width={72} height={72} />
    <h1>{org ? org.name : "ManyTongues"}</h1>
    <Lede>Signing you in…</Lede>
    <Button variant="ghost" wide className="at-mt3" onClick={() => setStep("existing")}>
      Type my sign-in key instead
    </Button>
  </>
)}
```

**4.3 `signIn` takes the key and how it came.** Change
`async function signIn()` to
`async function signIn(given = key.trim(), viaLink = false)` and inside it:

- use `given` wherever it used `key.trim()` (the `whoAmI` call and the
  `account` object), and pass `viaLink` as `whoAmI`'s fourth argument;
- replace the `keySaved === false` block with:

  ```ts
  if (r.user && r.user.keySaved === false) {
    reach.ok();
    if (viaLink) {
      /* Arriving by link is not stopped to save the key (0.637): it stays
         on their account page, with the link. */
      API.keySaved().catch(() => {});
      onDone({ ...account, keySaved: true });
      return;
    }
    setMade(account);
    setStep("key");
    return;
  }
  ```

- replace the `catch` body with:

  ```ts
  if (reach.caught(e, () => signIn(given, viaLink))) return;
  const why = String(e && (e as Error).message);
  if (viaLink) setStep("existing");
  setError(
    viaLink && why === "bad-key"
      ? "This sign-in link no longer works. Ask your teacher or your space's admin for a new one, or type your sign-in key."
      : API.explain(e)
  );
  ```

  Check what `reach.caught` returns before relying on it: the existing line
  is `if (!reach.caught(e, signIn)) setError(...)`, so it returns true when
  it has taken the error. Keep that meaning.

**4.4 Start it once.** Add near the other hooks of `Onboarding`:

```ts
/* A sign-in link (0.637): tried once, when the address's space is known. */
const linkStarted = useRef(false);
useEffect(() => {
  if (!place.linkKey || !place.linkReady || linkStarted.current) return;
  linkStarted.current = true;
  void signIn(place.linkKey, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [place.linkKey, place.linkReady]);
```

**4.5 A pasted link in the key box.** In the `step === "existing"` form's
`onSubmit`, replace `if (key.trim() && !busy) signIn();` with:

```ts
if (!key.trim() || busy) return;
const pasted = keyFromLink(key);
if (pasted) void signIn(pasted, true);
else void signIn();
```

Import `keyFromLink` and `signInLink` from `./sign-in-link.ts` at the top of
`src/spaces.tsx`. The "Sign in" button is the form's submit button; if it
has its own `onClick` calling `signIn`, give it the same four lines.

**4.6 The link on the "Keep this somewhere safe" page.** In the
`step === "key"` block, directly under
`<CodeBox label="Your sign-in key" code={made.key} />`, add:

```tsx
{made.keyOnly === false && made.org && typeof made.org === "object" && made.org.slug ? (
  <CodeBox
    long
    label="Your private sign-in link"
    hint="Opening it signs you in on any device, with nothing to type. Anyone who has it is you, so never share it."
    code={signInLink(window.location.origin, made.org.slug, made.key)}
  />
) : null}
```

Do not change the tick box or anything else on that page.

### Stage 5 — arriving by link (`src/ArabicTrainer.tsx`)

Import `keyFromHash` and `signInLink` from `./sign-in-link.ts`.

**5.1 Read it once, then clean the address.** Directly after the `address`
state (search `const [address] = useState(() => {`), add:

```ts
/* A sign-in link's key (0.637), read once from `#key=`. Held in memory
   only, and taken out of the address bar and the history at once. */
const [linkKey, setLinkKey] = useState(() => keyFromHash(window.location.hash));
useEffect(() => {
  if (!window.location.hash.startsWith("#key=")) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}, []);
```

The read is in the state's initialiser (pure) and the clean-up is in the
effect. Do not move the clean-up into the initialiser.

**5.2 Signed out: hand it to Onboarding.** Search `<Onboarding`. In its
`place={{ … }}` add:

```ts
linkKey,
linkReady: !address.slug || !!addressSpace || addressUnknown,
```

In its `onDone`, add `setLinkKey("");` just before `setAccount(a);`, and
also just before the `window.location.reload()` in the trying-space branch.

**5.3 One log-out routine.** Search `onLogOut={async () => {`. Move that
function's whole body, unchanged, into a `const logOutHere = async () => { … };`
defined in the component body just above the `return` that renders the
signed-in app, and pass `onLogOut={logOutHere}`. No behaviour changes; this
is so the switch below does exactly what Log out does.

**5.4 Signed in already.** Add state and one effect near the other account
effects (after `accountKey` is defined; search `const accountKey = account && account.key;`):

```ts
/* A sign-in link opened on a device that is signed in (0.637). The same
   person: nothing to do. Someone else: ask before switching. */
const [linkAsk, setLinkAsk] = useState<{ name: string } | null>(null);
const linkPeeked = useRef(false);
useEffect(() => {
  if (!ready || !account || !linkKey || linkPeeked.current) return;
  if (linkKey === account.key) {
    setLinkKey("");
    return;
  }
  linkPeeked.current = true;
  API.whoAmI(linkKey, "", "", true).then(
    (r) => setLinkAsk({ name: r.user.displayName || r.user.handle }),
    (e) => {
      setLinkKey("");
      const why = String(e && (e as Error).message);
      flash(why === "bad-key" ? "That sign-in link no longer works." : API.explain(e), "warn");
    },
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [ready, accountKey, linkKey]);
```

`ready` and `flash` already exist in this component; check `flash`'s second
argument against another call (search `flash(` with `"warn"`). This peek
must **not** call `API.saveAccount` and must not call `API.setKey`:
`whoAmI` is given the key as an argument and that is enough.

**5.5 The question.** Where the signed-in app renders its other
`<ConfirmModal`s at the top level, add:

```tsx
{linkAsk && account ? (
  <ConfirmModal
    title={`Switch to ${linkAsk.name}?`}
    danger={false}
    confirmLabel={`Switch to ${linkAsk.name}`}
    body={
      <p>
        This device is signed in as {account.displayName}. The sign-in link you opened is
        for {linkAsk.name}. {account.displayName}'s progress stays safe.
      </p>
    }
    onCancel={() => {
      setLinkAsk(null);
      setLinkKey("");
    }}
    onConfirm={async () => {
      setLinkAsk(null);
      await logOutHere();
    }}
  />
) : null}
```

On confirm, `linkKey` is deliberately **kept**: logging out shows
`Onboarding`, which receives `linkKey` (5.2) and signs the new person in
through Stage 4, the same road as a signed-out device. On cancel it is
dropped.

Landing place: nothing to add. After sign-in the app already opens the
space's home page.

**5.6 The account page.** Search `function AccountPanel`. Its `me` is the
device's account, which now carries `keyOnly` and `org`.

Add a `FormField` directly after the "Sign-in key" one, shown only when
`me.keyOnly === false && me.org && typeof me.org === "object" && me.org.slug`.
Build it by copying the "Sign-in key" field's own markup (the read-only
input with Hide and Copy, behind a button), with its own `showLink` and
`copiedLink` state, and these words:

- label: `Sign-in link`
- lede: `Opens the app already signed in as you, on any device. Keep it private: anyone who has it is you.`
- closed button: `Show my link`
- input `aria-label`: `Your sign-in link`; give it `autoComplete="off"` and
  no `name` (it must not be offered to a password manager as the password).
- value: `signInLink(window.location.origin, me.org.slug, me.key)`

Do not import `CodeBox` into `ArabicTrainer.tsx`.

**5.7 Log out wording.** Search `You'll need your sign-in key to get back in`.
Only for a student, say the link too. `AccountPanel`'s parent has
`account`; use:

```tsx
You'll need your sign-in key{account.keyOnly === false ? " or your sign-in link" : ""} to get back in, and nobody can recover it for you except
```

Leave the rest of that sentence as it is.

### Stage 6 — the admin's screens (`src/spaces.tsx`)

There are two People lists that show a new key. Search `New sign-in key for`
to find both.

**6.1 Carry the link.** The link is built where the server's answer
arrives, and stored on `newKey` as `link` (a string, `""` for key only):

- Search `const r = await API.createUser(`. In the `setNewKey({ … })` that
  follows, add:
  `link: r.keyOnly === false && r.slug ? signInLink(window.location.origin, r.slug, r.key) : "",`
- Search `const r = await API.reissueKey(`. In the `onNewKey({ … })` that
  follows, add the same `link:` line.
- Widen the types that carry it: the `onNewKey` prop's parameter type and
  the second `newKey` state's type (search
  `useState<{ name: string; handle?: string; key: string } | null>`) each
  gain `link?: string`.

**6.2 Show it.** Directly under **each** of the two key `CodeBox`es, add:

```tsx
{newKey.link ? (
  <CodeBox
    long
    label={`Private sign-in link for ${newKey.name}`}
    hint="Opening it signs them in, with nothing to type. It is for them alone: never post it to a class or a group."
    code={newKey.link}
  />
) : null}
```

**6.3 One help line.** Search `You'll get their sign-in key once, to pass on privately.`
Replace that sentence and the one after it with:

```
You'll get their sign-in key once, to pass on privately, and for a student a
private sign-in link too. They don't need to do anything first — the key or
the link signs them in on any device.
```

Leave the space-admin screen (search `space admin of`) alone.

### Stage 7 — the walk through the real screens (`tests/smoke.mjs`)

The harness drives the real app against a pretend server. Its `whoami`
answers as `whoamiAs || account` whatever key is sent (search
`if (action === "whoami")`). Add to that handler, before its `return`:

```js
if (url.searchParams.get("via") === "link" && own && own.keyOnly === true) return json({ error: "key-only" }, 403);
```

and check how the harness's `json` helper sets a status (copy another place
that answers an error).

Find the walk that logs out and signs someone else in (search
`Somebody else signs in here`) and read it whole: it shows `logOut`,
`signIn`, `whoamiAs`, `here` and `check`. Add a walk after it, built the
same way, in a fresh render of the app. Give the people it uses
`keyOnly: false`, a key shaped like a real one, and an `org` with a `slug`.
Set the address before rendering with
`window.history.replaceState(null, "", "/#key=" + thatKey)`. Check:

1. **Signed out, link opened:** after the wait, no "sign-in key" button is
   on screen (the person is in), `localStorage`'s `arabic-account` holds
   that key, and `window.location.hash === ""`.
2. **Signed in as A, link for B opened:** a button "Switch to B's name" is
   on screen. Clicking the dialog's cancel leaves `arabic-account` as A's.
3. **The same, then "Switch to …":** `arabic-account` ends as B's, and A's
   practice was set aside (the same check the existing walk makes with
   `PARKED`).
4. **A key-only person's link, signed out:** the key box is on screen and
   the text "Sign-in links are for students." is in the page.
5. **The account page:** for a `keyOnly: false` account a "Show my link"
   button exists; for the harness's ordinary `account` (no `keyOnly`) it
   does not.

Reset whatever the walk changed (`whoamiAs = null`, the address back to
`/`) at its end, as the walks around it do.

### Stage 8 — write it down, then deliver

1. `npm run components` (a list of component uses is generated and checked;
   new `CodeBox` and `ConfirmModal` uses change it). Commit what it changes.
2. `package.json`: `"version": "0.637.0"`.
3. `CHANGELOG.md`: a new section at the top, `## 0.637 — <today's date>`, in
   the style of 0.636 beneath it: plain language, bold lead sentence, what
   changes for students and for admins, the students-only rule, the iPhone
   home-screen limit, and a "To check by hand" paragraph taken from the list
   below. No file or function names.
4. `README.md`: in "Addresses and joining" (search
   `Addresses and joining (since 0.543)`), add one bullet in that section's
   style: the link's form, that the key rides after `#` and is removed from
   the address at start, `keyOnly` and `via=link` / `key-only`, and the file
   `src/sign-in-link.ts`.
5. `DECISIONS.md`: a short entry, "Sign-in links (0.637)", in the style of
   its neighbours, recording the decisions: works as long as the key; key
   still shown; shown wherever the key is, the account page included; no QR;
   class set-up later; ask before switching; land on the space's home; no
   stop to save the key; students only; an old link of a teacher or admin is
   refused by the app rather than by issuing a new key, and why that is a
   soft guard (the key can still be read out of the link and typed).
6. `npm run check` green on the final tree. Then deliver as `CLAUDE.md`
   says: push the work to `beta`, and bring any open pull request's title
   and description up to date.

### Do not

- Do not log, store or send the link anywhere. The device builds it from the
  key it already holds; the server never builds or sees one.
- Do not show a link when `keyOnly` is `true` or missing.
- Do not make the link work "once" or expire. It is the key.
- Do not skip the switch question, even when the device's account looks
  idle.
- Do not touch `admin-create-org`, sync, backups, or the invitation link.

### To check by hand, on beta

1. As an admin, add a student. A key and a private link are shown. Add a
   teacher: only a key.
2. Open the student's link in a private window: straight in, on the space's
   home page, no tick box, and the address bar shows no key.
3. Open the same link again on that device: nothing happens beyond opening
   the app.
4. While signed in as one student, open another student's link: asked
   "Switch to …?". Staying keeps the first; switching brings the second in,
   and signing back in as the first still has their progress.
5. Give the student a new key: the old link says it no longer works and
   offers the key box.
6. Make that student a teacher of a course, then open their link in a
   private window: "Sign-in links are for students." Typing the key works.
7. On a student's account page: "Show my link" is there, and the link works
   on another device. On a teacher's: it is not.
8. Paste a whole link into "I already have a sign-in key": signs in.
9. A new student joining with a course code sees both the key and the link
   on "Keep this somewhere safe".
