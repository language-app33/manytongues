# Plan: spaces

**Status: settled, not started.** Written before anything is built, from
the owner's answers to questions 1–93 and a reading of the repository. No
questions are open. Anything new that comes up while building goes back
to the owner, in the way `CLAUDE.md` describes, before it is decided.

Part A is for the owner, in plain terms. Part B holds the build notes for
whoever implements it. It is long because the owner asked for a plan
detailed enough to hand to another model.

---

# Part A — for the owner

## A1. What this is

A **space** is a walled-off area of ManyTongues for one organisation, such
as a language school. Each space has its own people, courses, decks and
cards, and its own address: `manytongues.co/<name>`. Nothing in one space
can be seen or touched from another. You (the app admin) create spaces and
choose who runs each one. The people who run a space are its **space
admins**.

What exists today becomes the first space, **"Main"**, at
`manytongues.co/main`. It stays as your own home. New spaces start empty.

Every person also has **My space**: a private corner of their own account
where they can make their own decks and cards, practise them, and (for
teachers) prepare material before sharing it.

## A2. The decisions

The number after each decision is the question it was settled in.

**People and accounts**

- **One account belongs to exactly one space (owner's rule).** Someone who
  wants to be in two spaces has two accounts, each with its own key.
  Accounts never move between spaces (49c, 88).
- **The address decides.** Being at a space's address means being in that
  space. There is no space switcher. The plain home page,
  `manytongues.co`, is only for signing in, and it sends you to your own
  space (17a).
- **Joining (3c, 23a, 24b, 37a).** A space admin can create accounts and
  hand out the keys. Each space also has one invite link, which the space
  admin can replace. Joining through it gives no role until the space admin
  assigns one. A course code also works as an invite into that course's
  space. Nobody can sign up without an invite link or a course code. The
  single shared sign-up code the app can require today goes (74a).
- **Wrong address (9a, 53b, 82b).**
  - Someone who isn't signed in and opens a space sees that space's page,
    with a box for an invite code.
  - Someone who signs in there with a key from another space, or uses a
    code from another space, is stopped and told which space their key
    belongs to. They're offered two ways forward: go there, or make a new
    account here.
  - Someone already signed in who follows another space's invite link sees
    "You're signed in to {their space}. This link is for {the other
    space}. To join it, make a new account. Your current one stays." with
    "Make a new account" (which signs them out on this device) and "Back to
    {their space}".
- **Leaving and removing (25a, 52a, 64a, 67a).** A person can leave their
  space, and a space admin can remove someone. Either way the account is
  **suspended**: the person can't sign in, and they appear under
  **"Former members"**. The space admin, or you, can reactivate them, and
  they get their courses back.
- **Deleting (64a, 68b, 83a–86a).** Only the person themselves, or you,
  can delete an account. Space admins can only suspend.
  - **What goes:** the account, its My space, and its practice history on
    the server.
  - **What stays:** anything the person made for the space (decks, cards,
    numbers), under their name.
  - **The record:** a "Former members" entry with their name, when they
    joined and left, which courses they were in, and who deleted the
    account.
- **Space admins and your own account (70a).** Only you can issue a new
  key to a space admin, or suspend one.
- **Lost keys (34c, 51b, 75a).** A space admin can issue a new key to
  people in their space. The sign-in page says "Lost your key? Ask your
  space's admin for a new one. Everyone else: contact@manytongues.co".
- **Key reminder (18a, 19b, 81a).** Right after signing up, and the first
  time someone signs in to an account another person made for them, they
  are asked to save their key in a password manager or somewhere safe, and
  tick "I've saved my key somewhere safe" before carrying on. Accounts
  that already exist aren't asked.

**Roles**

- **You (app admin)** create spaces, set each one's name, address, logo
  and colour (21a), and choose its space admins (36a). You can archive,
  reopen or delete a space for good (22a, 93b), export a whole space (63a),
  and see each space's storage use (60a). You can open any space and work
  there without appearing in its list of people (35a). Deleting accounts
  and courses, and backups and restores, are yours alone. You don't see
  anyone's My space in your screens (71a).
- **Space admins.** A space can have several (20b). They handle the
  day-to-day (4b): create courses (32a); add people and make them teachers
  or students; issue new keys (51b); suspend and reactivate people (64a,
  67a); hand a former teacher's material to another teacher (31a); share
  and replace the invite link (37a); read learners' reports (7a); and see
  and edit all of the space's material (6a), except teachers' numbers and
  clock (79a). They can't see anyone's My space (48a).
- **Teachers and students** work as today: memberships of a course. Only
  teachers and space admins make material in the space (33a).

**Material**

- **Teachers own the cards they make (6a).** When a teacher leaves, is
  suspended or deletes their account, their material stays under their
  name, and the space admin can hand it to another teacher (31a, 85a).
  That includes their numbers and clock, so decks that use them keep
  working.
- **No sharing between spaces (89a).** New spaces start empty. A teacher
  can still export a deck to a file and import it into another space where
  they also have an account. The import is an independent copy that
  belongs to that space (92a).
- **Numbers, clock and blank-fillers (39a, 46c, 73b, 79a).** These are each
  teacher's own, inside their space, and only they can edit them. A deck
  that includes numbers says whose numbers it uses: the owner's own, or
  any teacher's in the space who has numbers in that language. It starts
  with the owner's own, if they have any.

**My space (13a, 14a, 15a, 47a, 48a, 54, 55a, 56a, 58a, 59b, 61a, 66b, 72a)**

- Everyone has one. It's private: only its owner sees it. Space admins
  don't, you don't in your screens, and a space's export leaves it out.
  Nobody else can join it.
- It works exactly the same for learners and teachers: the same editor,
  decks, cards, and Draft/Published steps. Only published cards are
  practised.
- **Teachers** reach it as a "My space" shelf inside Teaching, next to the
  space's own material.
- **Learners** reach it through "My space" in the You menu, next to
  Learning. It opens the same screens as Teaching, limited to My space.
- Each My space deck has **"Practise this myself"**, on for new decks. It's
  a tick box on the deck's own screen, where a space deck shows its
  courses. In the shelf's list, a deck that's ticked off shows "Not
  practised".
- In Learning, practised My space decks appear as one more group called
  **"My space"**, next to the person's courses, practised in the same daily
  sessions.
- A My space deck can include cards from the person's courses. It's the
  same card, practised once, and it drops out if the space withdraws it.
- A teacher can copy a My space deck into the space for a course. The copy
  belongs to the space from then on, with a warning that the two won't
  stay in sync.

**Addresses and look**

- A space's address can be changed later. The old address keeps
  forwarding, and an address that has ever been used can never be taken by
  another space (8b), unless you delete the space for good, which frees its
  addresses (93b).
- Each space has a name, logo and colour (10b), set only by you (21a). They
  appear on the space's sign-in and invite page and at the top of the You
  menu, not on the bar along the bottom. The rest of the app keeps
  ManyTongues' own colours (29a).
- The app always says "space", never "school". For example: "This space is
  closed".
- Everything is built from the app's existing screens and pieces. Anything
  that has no existing piece is shown to you before it's built.

**Closing and deleting a space (22a, 62a, 93b)**

- **Archiving** a space hides it. Its people see "This space is closed"
  when they try to sign in. Reopening it brings everything back.
- **Deleting** a space for good removes its accounts (each leaving no
  practice history behind), courses, decks and cards, and frees its
  addresses. Only you can do it, after typing the space's name to confirm.
- **"Main"** can be neither archived nor deleted (87a).
- **Storage (60a):** no limit for now. Your admin screen shows how much
  each space uses.

**Dropped along the way:** belonging to several spaces, ticking several
spaces at once, the space switcher, personal addresses like `/@handle`,
moving courses or people out of "Main", and copying material from "Main"
into a space.

## A3. What each kind of person will see

- **A learner** opens their space's address (or the app) and signs in.
  They see their space's name and logo at the top of the You menu.
  Learning holds their courses and, once they've made something, a "My
  space" group. "My space" in the You menu opens the screens where they
  make their own decks and cards.
- **A teacher** sees what they see today, limited to their space. Teaching
  gains a "My space" shelf.
- **A space admin** sees an Admin screen like today's, showing only their
  space: courses, people (with "Former members"), decks, reports, and the
  invite link. The backup and clear controls are not there.
- **You** see today's Admin screen plus a **Spaces** section. There you
  create, edit, archive, reopen, delete and export spaces, choose space
  admins, and see each space's storage use. You can open any space's
  address and work there.

## A4. Stages

Each stage is a release that can ship on its own. It's checked with the
full test suite plus new tests, then by hand on the deployed app before
the next stage starts.

1. **Numbers by choice (46c, 80a).** A deck says whose numbers it uses.
   This fixes a problem that exists today: a course with two teachers who
   both have numbers gives students every number twice. It ships before
   anything else.
2. **Spaces underneath.** Every person, course, deck and card belongs to a
   space, and the server refuses anything that crosses one. Everything is
   in "Main", so nobody notices anything. It's checked by tests that try
   every kind of request from one space against another.
3. **Creating spaces, and addresses.** Your Spaces section: create a space
   with its first space admin; rename its address; archive, reopen and
   delete it. Also the space's own sign-in page with its logo and colour,
   the address always showing your space, the "wrong address" messages,
   and sign-up only by invite or course code. **By hand, when it ships:**
   remove the `SIGNUP_CODE` setting from the server's environment if it's
   set.
4. **Space admins and accounts.** Their Admin screen, the invite link,
   suspending and reactivating, "Former members", handing over a former
   teacher's material, leaving a space, deleting your own account with its
   record and practice history, reports going to the space admin, the key
   reminder, and the new lost-key wording.
5. **My space.** The shelf in Teaching, "My space" for learners, "Practise
   this myself", the My space group in Learning, adding course cards to My
   space decks, and copying a deck into the space.
6. **Your extras.** Export a whole space, and storage per space.

Stages 1 to 4 together are the smallest version a real school could use.
Stages 5 and 6 can follow.

## A5. Costs and trade-offs accepted

- Someone in two spaces has two keys and signs out and in to switch. Each
  switch downloads that account's material again.
- A person who changes space starts from zero.
- Material is never shared between spaces. A copy made by export and
  import is separate, so a mistake found later is fixed in each copy.
- Learners get the full teachers' editor in My space. It's powerful, but a
  lot for a beginner. If learners struggle, a lighter view could come
  later.
- A space admin who issues someone a new key could also open that
  person's My space.
- A deleted account's record (name, dates, courses) is kept. If someone
  asks for even that to be removed, you remove it by hand.

---

# Part B — Build notes (technical, for the implementer)

## B0. Ground rules

- Read `CLAUDE.md` and the parts of `README.md` and `DECISIONS.md` your
  stage touches before writing code. Follow the repository's delivery
  rules: each stage is a release (bump `package.json`, write a
  `CHANGELOG.md` entry in the README's terms, add a `DECISIONS.md` entry
  for each choice made), `npm run check` must be green on the exact tree
  pushed, and push to `beta` as `CLAUDE.md` describes. Update `README.md`
  wherever it describes something a stage changes (accounts, roles, the
  environment table, "How it fits together").
- **Only existing UI components and layout.** Read
  `docs/UI-COMPONENTS.md` first and run `npm run components`. The pieces
  you will need are already there: `SpaceFrame` + `Tabs`, `Section`,
  `Field`/`FormField`, `Segmented`, `CheckList`, `RadioGroup`, `ItemList`,
  `Tile`, `TileNote`, `Notice`, `Nudge`, `Help`, `Lede`, `Button`,
  `IconButton`, `ConfirmModal`, `Popover`, `DeckSwitch`. If something
  genuinely has no existing piece, stop and ask the owner. Don't invent a
  new look.
- **Wording.** Text people see says "space" (or the space's name), never
  "school", "organisation" or "tenant". It also follows the CLAUDE.md
  rules for owner-facing language.
- Do the stages in order. If something isn't covered here, ask the owner;
  don't guess.

## B1. Naming in code: `org`, not `space`

The code already uses **space** for Learning/Teaching/Admin: `SpaceName`
in `src/ArabicTrainer.tsx` and `src/shared.tsx`, `SPACE_LABEL`,
`SPACE_ICON`, the `space` state, `PlacePicker`, `useFreshSpace`,
`SpaceFrame`, and the file `src/spaces.tsx` (the Teaching and Admin
screens). Reusing the word for the new idea would make every one of those
ambiguous.

So **in code, the new concept is `org`**: `K.org`, `user.org`, `orgOf()`,
`sameOrg()`, the actions `admin-create-org`, and so on. **On screen it is
always "space".** Leave the existing `space` identifiers alone. Change
only the screen-reader label on `PlacePicker`'s radiogroup (today
`aria-label="Space"`) to `aria-label="Mode"`, so a screen reader doesn't
call two different things "space".

## B2. Data model

All documents live in the `arabic-courses` store (`server/api/courses.js`,
`STORE`), reached through the `K` key map. Nothing lists keys; every list
is an `index:` document. Add:

```
K.org(id)      → `org:${id}`      the space itself
K.slug(name)   → `slug:${name}`   address → org id; kept for ever unless the org is deleted (8b, 93b)
K.former(org)  → `former:${org}`  the space's "Former members" records (list)
K.gone(handle) → `gone:${handle}` { displayName, org, at } for a deleted account, so material
                                  keeps its author's name and the handle is never reissued
K.index("orgs")                   list of org ids
```

**Org document**

```js
{
  id,              // "main" for the first; otherwise `o${randomBytes(6).toString("hex")}`
  slug,            // current address part, e.g. "lingua-academy"
  formerSlugs: [], // every slug it has had; each still has its K.slug record
  name,            // shown on screen; "Main" for the first (69b)
  logo,            // image hash (stored with put-image, as card pictures are) or ""
  colour,          // "#rrggbb" or ""
  admins: [],      // handles of space admins (20b, 36a); the source of truth for the role
  inviteCode,      // the space's invite link code (37a); also recorded under K.code
  created,
  archived,        // millis, absent when open (22a)
}
```

**Address rules:** lowercase `a–z`, `0–9` and `-`, 3–40 characters, must
start with a letter, no `--`. Reserved, never allowed: `api`, `assets`,
`main` (taken by the first space), `admin`, `new`, `join`, `www`, `app`,
`static`, `index`, and the name of every file in `public/` and `dist/`
without its extension (`favicon`, `logo`, `apple-touch-icon`,
`icon-192`, `icon-512`, `icon-512-maskable`, `manifest`,
`manifest.webmanifest`, `sw`, `registerSW`, `workbox`). A slug whose
`K.slug` record exists is taken (8b). Only deleting the org removes its
`K.slug` records (93b).

**Fields added to existing records.** None of them need a migration
write, because of the default rule below.

| record | new field | meaning |
|---|---|---|
| user | `org` | id of the user's one space |
| user | `suspended` | `{ at, by, why: "left" \| "removed", courses: [{ id, roles: ["teacher"\|"student"] }] }` while suspended; absent otherwise |
| user | `keySaved` | `false` on accounts created from stage 4 on, until the person ticks; absent (= saved) on older accounts (81a) |
| course | `org` | its space |
| deck | `org` | its space |
| deck | `personal` | `true` for a My space deck |
| deck | `practise` | My space decks only: "Practise this myself" (59b); `true` when created |
| deck | `numbersFrom` | handle whose numbers and clock the deck uses (46c); absent = deck owner |
| card | `org` | its space |
| card | `personal` | `true` for a card made in My space |
| flag | `org` | the space of the card's deck, stamped when the report is made |

**The default rule, the most important line in this plan:**

```js
const MAIN = "main";
const orgOf = (rec) => (rec && rec.org) || MAIN;
```

A record without `org` is in "Main". Every existing record is therefore
already in "Main" (2a, 42a), and **no migration pass is written**. Never
read `.org` directly; always go through `orgOf`.

Make sure `org:main` exists on first use, inside `courses.js`:
`{ id: "main", slug: "main", formerSlugs: [], name: "Main", logo: "", colour: "", admins: [], inviteCode: <makeCode()>, created: Date.now() }`,
plus `slug:main`, the `K.code` record for the invite code, and the
`index:orgs` entry. Write it with `onlyIfNew` so two requests can't race.
"Main" can never be archived or deleted (87a).

**Former members record** (25a, 30c, 83a, 84a). One list per org at
`former:<org>`, newest last:

```js
{
  handle, displayName,
  joined,            // user.created
  left,              // when suspended or deleted
  courses: [{ id, title, roles }],   // titles copied, so the record survives a deleted course
  why: "left" | "removed" | "deleted-self" | "deleted-by-admin",
  by,                // handle of whoever did it (the person themselves for left / deleted-self)
}
```

- **Suspending** (leave or remove): set `user.suspended`, take the person
  off every course roster, and append a record.
- **Reactivating**: clear `user.suspended`, put them back on each course
  in `suspended.courses` that still exists with the same roles, and remove
  their record from the list.
- **Deleting**: append (or update) the record with the `deleted-…` reason.
  It is never removed by the app. The owner removes one by hand if asked
  (A5); give App admins a "Remove this record" `IconButton` with a
  `ConfirmModal` on it.

## B3. The one rule on the server

```js
/** The space this request acts in. Async: it may read the org document. */
async function actingOrg(store, req, me) {
  if (me.admin) {
    const asked = String(req.headers.get("x-org") || "");
    // validated: the org must exist; otherwise fall back to the admin's own
    if (asked && (await readJson(store, K.org(asked)))) return asked;
  }
  return orgOf(me);
}
const sameOrg = (rec, org) => orgOf(rec) === org;
const isOrgAdmin = (orgDoc, handle) => (orgDoc.admins || []).includes(handle);
```

- **App admin** = today's `admin` flag (made with `claim-admin` and
  `ADMIN_KEY`). Unchanged. App admins may act in any space (35a); the
  client sends `x-org` with the id of the space whose address is open.
  Their own account is in "Main".
- **Everybody else** acts in their own space. The `x-org` header is
  ignored for them.
- **Every action that reads or writes a course, deck, card, system, flag
  or user must check `sameOrg(record, acting)`** and answer
  `json({ error: "other-space" }, 403)` when it fails. An App admin
  passes because `acting` is whatever they asked for, not because the
  check is skipped. **Every list must be filtered by `sameOrg`** before
  anything else is done with it.
- **Personal records** (`deck.personal`, `card.personal`) are visible and
  editable only by their owner, whatever their role. That includes space
  admins (48a) and App admins (71a). A personal deck is never in a course.
  The only exceptions are backups (`admin-backup-*`), which hold
  everything, and deleting an account or space, which removes it.
- **A suspended user is refused** on every action, including `signin` and
  `whoami`, with `json({ error: "suspended" }, 403)`.
- **An archived space refuses its people** in the same way:
  `json({ error: "space-closed" }, 403)`. App admins are not refused.

Put `actingOrg`, `sameOrg`, `orgOf`, `isOrgAdmin` and a
`refuseOther(rec)` helper next to `currentUser` near the top of
`courses.js`, and use them everywhere. Don't write the comparison inline.

## B4. Existing actions, one by one

`me` is `currentUser`, `org` is `actingOrg`, and "space admin" means
`isOrgAdmin(orgDoc, me.handle)`.

**Accounts**

- **`signup`**: needs `body.code`, either a space invite code or a course
  code (24b, 23a). Look it up with an extended `courseForCode`, renamed
  `codeTarget` and returning `{ kind: "org" | "course", id, asTeacher }`.
  The new user's `org` is the code's space. If `body.org` (the space of
  the address the person is at) is given and differs, answer
  `{ error: "other-space", space: { name, slug } }` (53b). Set
  `keySaved: false`. A course code also puts them on that course, as
  student or teacher as `join-course` does. An invite code gives no role
  (37a). Refuse when the space is archived. **Remove the `SIGNUP_CODE`
  check** and the client's "signup-code-required" handling (74a), and
  remove `SIGNUP_CODE` from the README's environment table.
- **`makeHandle`**: also treat a handle as taken when `K.gone(handle)`
  exists, so a deleted person's handle is never given to someone else.
- **`signin` / `whoami`**: refuse suspended users (`suspended`) and
  archived spaces (`space-closed`). If `body.org` is given and differs
  from the user's, answer
  `{ error: "other-space", space: { name, slug } }` without signing in.
  The answer gains `org: { id, slug, name, logo, colour }`,
  `orgAdmin: boolean` and `keySaved`.
- **`delete-account`** stays (68b) but changes what it removes. See
  `wipeAccount` below.
- **New `leave-space`**: suspends the caller with `why: "left"` (52a).
- **`claim-admin`**: unchanged.
- **`report-flag`**: stamp `org` from the deck or card. A card that's
  personal and not in any course isn't reportable. Answer `not-reportable`,
  and the client hides the button for such cards.

**`wipeAccount`** (used by `delete-account` and `admin-delete-user`)
changes like this (85a, 86a):

- **Deleted:** the person's **personal** decks and **personal** cards.
  When a personal deck holds borrowed course cards (66b), delete only the
  deck, never those cards.
- **Kept:** their **non-personal** decks and cards, with `owner` unchanged
  (the space admin can hand them over, 31a), and their number and time
  systems (`mysystems:`, `numsys:`, `timesys:`), so decks using them keep
  working. Today it deletes all of these. That must stop.
- Remove them from every course roster.
- Delete `K.keyOf`, `K.user`, and their entry in `index:users`. Write
  `K.gone(handle) = { displayName, org, at }`.
- Write the Former members record (`deleted-self` or `deleted-by-admin`).
- **Practice history (86a).** The learner's sync document is in the
  separate `arabic-trainer` store (`server/api/sync.js`). Its key is
  `sha256("arabic-trainer:" + token)`, and the device's token is
  `tokenFor(key)` in `src/sync.ts`, the SHA-256 hex of the trimmed key.
  That is exactly the `keyHash` the courses store already keeps on the
  user. So the server can delete it: export a small
  `forgetSyncDoc(tokenHex)` from `sync.js` that reads the document,
  deletes every `?audio=` recording it names (the same
  `keyFor(\`${token}:audio:${id}\`)` keys), then deletes the document.
  Call it from `wipeAccount` with `user.keyHash`. Test it with a document
  written through the real sync endpoint. Practice history kept under an
  *earlier* key, from before a new key was issued and never drained onto
  the new one, can't be found. Note that in `DECISIONS.md`.
- Wherever a name is shown for a handle (`nameOf` maps in `my-material`,
  `course-decks`, `admin-overview`, etc.), fall back to
  `K.gone(handle).displayName`, then the handle.

**Courses**

- **`create-course`**: today `me.admin` only. Becomes App admin or space
  admin. Stamp `org`.
- **`assign-teacher` / `assign-student` / `remove-member`**: today
  `me.admin` only. Becomes App admin or space admin. The course and the
  target user must both be in `org`.
- **`join-course`**: the course must be in the user's space. Otherwise
  answer `{ error: "other-space", space: { name, slug } }` (53b).
- **`my-courses`, `course-decks`, `my-material`**: filter courses by
  `org`.
- **`my-material`** also gains the person's practised My space decks
  (59b). Build them as a **pseudo-course**
  `{ id: "my-space", title: "My space", personal: true, decks: [...ids], teachers: [], students: [mine] }`.
  It is added to `courseRows` only for this answer and never stored. This
  lets `StudentCourses` and the rest of Learning treat it as a course with
  almost no change. Include its decks, and the cards in them (the person's
  own cards *and* the course cards they added, 66b), in the bundle and in
  `materialVersion`. A course card in a personal deck is sent only while
  that card is still in a course the person studies. Otherwise it's left
  out (66b: it "drops out if the space withdraws it"). The client must not
  offer "leave" or show codes for a course with `personal: true`.

**Decks**

- **`create-deck`**: stamp `org`. Accept `body.personal`. Personal decks
  get `practise: true`. Anyone may create a personal deck. Only teachers
  of a course in the space, space admins and App admins may create a
  space deck (33a). Today any signed-in user can call `create-deck`, so
  this tightens it.
- **`canEditDeck(store, deck, handle, isAdmin)`**: becomes
  `canEditDeck(store, deck, me, org)`. It's false if
  `!sameOrg(deck, org)`. A personal deck can be edited by its owner only.
  Otherwise it's true for the owner, App admin, space admin (6a), or a
  teacher of a course in the space holding the deck (as today).
- **`my-decks`**: filter by `org`. Return the space's decks as today, and
  return the person's personal decks in a separate list, `personal: [...]`,
  so the client can draw the two shelves. A space admin gets every
  non-personal deck in the space (6a).
- **`attach-deck`**: refuse personal decks (`personal-deck`). A personal
  deck reaches a course only by being copied (see `copy-to-space` below).
- **`rename-deck`, `lock-deck`, `delete-deck`, `set-deck-parts`,
  `detach-deck`, `deck-cards`**: org check plus the new `canEditDeck`.
- **New `set-deck-practise`** `{ deckId, practise }`: owner of a personal
  deck only.
- **New `set-deck-numbers`** `{ deckId, from }` (stage 1, 46c): anyone who
  can edit the deck. `from` must be a handle in the deck's space with a
  number or time system in the deck's language. For a personal deck,
  `from` may be the owner or any teacher in the space (73b).

**Cards**

- **`save-card`**: stamp `org` on new cards. A card saved into only
  personal decks is `personal: true`. A personal card can't be saved into
  a space deck (refuse `personal-card`; copy instead). A space card *can*
  be added to a personal deck, but only one the person can see through a
  course they study (66b). That adds the card's id to the deck. It doesn't
  change the card's owner or `personal`, and needs no edit right on the
  card.
- **`mayEditCard`**: org check. A personal card can be edited by its owner
  only. Otherwise the same as the new `canEditDeck`.
- **`my-cards`**: filter by `org`. Return personal cards separately, as
  for decks.
- **`card-status`, `review-card`, `delete-card(s)`**: org check plus
  `mayEditCard`.
- **New `copy-to-space`** `{ deckId }`: owner of a personal deck who is a
  teacher in the space, a space admin or App admin (15a, 33a). It makes a
  new space deck (not personal) and new copies of every card in it that
  the person owns. Course cards the deck borrowed (66b) are referenced,
  not copied, because they're already space material. Recordings and
  pictures are shared by hash, so nothing is uploaded again. The client
  shows the warning before calling it: "The copy and the original won't
  stay in sync."
- **Import** (the existing Import in Teaching, in `src/spaces.tsx`: it
  reads the file against `src/imports.ts` and writes each card through
  `API.saveCard`) keeps working (92a). What it creates
  is stamped with the importer's space by the rules above. Nothing else
  changes.

**Handing over a former teacher's material (31a, 85a)**

- **New `admin-hand-over`** `{ from, to }`: App admin or space admin.
  `from` is a handle that is suspended or deleted (has a Former members
  record) in `org`. `to` is a current teacher or space admin in `org`. It
  sets `owner = to` on every **non-personal** deck and card in `org` owned
  by `from`, and moves those card ids from `owncards:<from>`/`mycards:<from>`
  to the same lists for `to`. Read those two key families before writing
  it; they are what `my-cards` and `wipeAccount` use. Numbers and clock
  are **not** handed over (79a); decks keep using `from`'s, through
  `numbersFrom`. In the space admin's Former members, the person's row
  gains "Hand their material to…", a `RadioGroup` of current teachers in a
  `ConfirmModal`.

**Numbers, clock and blank-fillers**

- One account = one space, so `mysystems:<handle>` is already "per teacher
  per space" (39a). No key change is needed. `save-system`,
  `sign-system` and `delete-system` stay the owner's own (79a).
- **Which systems reach a learner** (`my-material`, the
  `teacherHandles`/`systemsOf` part, around the comment "Whose values can
  reach this person"): today every deck owner's and every course teacher's
  systems are sent, and the device files **every** system into **every**
  deck of that language that holds number parts (`fileIntoDecks` in
  `src/numbers/generate.ts`, called from `src/shared.tsx`). Stage 1 changes
  this. Each deck with `parts` names one source (`numbersFrom` or its
  owner). `teacherHandles` must include every deck's `numbersFrom`, so the
  chosen teacher's system is sent even when they don't teach that course.
  The server stamps each deck it sends with `numbersSystemId` and
  `timeSystemId`: the chosen source's system ids for the deck's language,
  read from `systemIndex`. The client files a system only into the decks
  that name it: in `src/shared.tsx`, filter `holding` by
  `d.numbersSystemId === set.numbers.id`. Systems are still sent whole and
  unchanged, so the items a device already generated from a system (their
  ids come from the system's id; see `handOn` and `handOnSplit`) keep
  their progress. A deck with no source sends nothing, and its
  `partsWaiting` says so.
- `partsWaiting` (which number parts reach nobody yet) must read the
  deck's chosen source, not every teacher's.
- A deleted teacher's systems stay (see `wipeAccount`). `systemIndex` reads
  `mysystems:<handle>`, which is kept, so this works without a user
  document.
- **Blank-fillers** are cards, so they follow the card rules: a sentence
  in a space deck is filled only from non-personal cards in the same
  space, and a sentence in a personal deck from the owner's cards
  (personal or not) in that space. The fill pass is wherever `fillsOf` and
  `fillsRev` are used in `courses.js`. Filter by `orgOf` and `personal`
  there.

**Reports**

- **`my-reports`**: today App admin only (since 0.412). Becomes App admin
  (all, or filtered to `x-org`) or space admin (their space only, 7a).
- **`dismiss-reports`, `admin-delete-flags`**: same gate.

**Media**

- `put-clip`, `put-image`, `clip`, `image`, `media-sizes` are addressed by
  the content's SHA-256 and shared across the whole site. Leave them that
  way. A hash can't be guessed, and sharing means a copy costs no storage.
  Storage per space (60a) is worked out by walking the space's cards
  (`clipsOfCard`) and pictures and adding up `media-sizes`. A file used by
  two spaces counts in both, and the screen says so.
- **Deleting a space** must not delete a clip or image that another space
  still uses. Delete only those referenced by no remaining card or number
  system, the way `admin-clear` already decides what to remove
  (`clipsOfCard` plus `clipsOfSystem` over what is left).

**Admin actions** (`action.startsWith("admin-")` today requires
`me.admin`). Replace that gate with a table:

| action | App admin | space admin (own space) |
|---|---|---|
| `admin-overview` | yes (all spaces, or `x-org`) | yes, filtered to their space, personal records excluded |
| `admin-create-user` | yes | yes; the new user's `org` is theirs; never `admin`; the course must be in their space |
| `admin-reissue-key` | yes | yes for people in their space, **except** space admins and App admins (70a) |
| `admin-rename-course`, `admin-course-language`, `admin-new-code`, `admin-card` | yes | yes, in their space |
| `admin-delete-flags` | yes | yes, their space's flags |
| new `admin-suspend-user` / `admin-reactivate-user` | yes | yes, their space, **except** space admins and App admins (70a) |
| new `admin-new-invite` (replace the space's invite code) | yes | yes |
| new `admin-hand-over` | yes | yes |
| `admin-delete-user`, `admin-delete-course` | yes | **no** (4b, 64a) |
| new `admin-remove-former` (remove one Former members record) | yes | **no** |
| `admin-backup-manifest/chunk`, `admin-restore-chunk`, `admin-clear` | yes | **no** |
| new `admin-create-org`, `admin-update-org`, `admin-org-admins`, `admin-archive-org`, `admin-reopen-org`, `admin-delete-org`, `admin-export-org-*`, `admin-org-usage` | yes | **no** |

`admin-clear` must also leave `org:`, `slug:`, `former:`, `gone:` and
`index:orgs` alone unless it is clearing everything, and must recreate
`org:main` after a full clear. **`admin-restore-chunk`'s `allowed` prefix
list** (the regex starting `^(user|key|course|…`) must gain `org`, `slug`,
`former` and `gone` in the same release that starts writing them. The
comment above it says so. Add the same kinds to the backup manifest
(`admin-backup-manifest`, and `BACKUP_PARTS` in `src/spaces.tsx`).

## B5. New actions

- **`org-info`** (no sign-in needed) `?slug=`: answers
  `{ ok, org: { id, slug, name, logo, colour, closed } }` for a current
  slug, `{ ok, moved: newSlug }` for a former one (8b), and
  `{ error: "no-space" }` otherwise. It never reveals people or material.
  It is the only new action that can be called without a key, so put it
  before the `currentUser` check, next to `signup`.
- **`key-saved`**: sets `keySaved: true` on the caller (19b).
- **`leave-space`**: see Accounts above.
- **`admin-create-org`** `{ name, slug, logo, colour, adminName }`: makes
  the org, the `slug:` record and an invite code. In the same request it
  creates the first space admin's account in the new space (65a), the way
  `admin-create-user` does (with `keySaved: false`), and returns that
  account's key once.
- **`admin-update-org`** `{ id, name?, slug?, logo?, colour? }`: changing
  `slug` pushes the old one onto `formerSlugs` and keeps its `slug:`
  record pointing at this org (8b).
- **`admin-org-admins`** `{ id, add?: handle, remove?: handle }`: the
  handle must be a current (not suspended) account in that space (36a).
- **`admin-archive-org` / `admin-reopen-org`** (22a). "Main" can't be
  archived.
- **`admin-delete-org`** `{ id, confirm }` (93b): `confirm` must equal the
  org's name, as the existing typed confirmations do (`ConfirmModal`
  with the name to type). "Main" can't be deleted. It runs `wipeAccount`
  on every account in the org (so each one's practice history goes too,
  86a), then deletes every course, deck and card in the org (and their
  `K.code` records), the org's flags, `former:<org>`, the `gone:` records
  whose `org` is this one, the invite code record, every `slug:` record of
  the org (current and former, which frees the addresses), `org:<id>`,
  and its `index:orgs` entry. Media follows the rule under Media above. It
  can run long: write it so a second call finishes what an interrupted one
  started, and report progress the way backups do if it has to be split
  into chunks.
- **`admin-export-org-manifest` / `admin-export-org-chunk`** (63a): the
  backup machinery limited to one org's keys, **without** personal decks
  and cards (72a). There's no restore of a single space in this plan. A
  space file is for keeping.
- **`admin-org-usage`** (60a): counts of people, courses, decks and cards,
  plus storage per org.

## B6. Addresses in the browser

- The server already answers any path that isn't a file with
  `index.html` (`server/index.js`). The service worker's
  `navigateFallback` does the same offline (`vite.config.js`), and assets
  are referenced from `/` (`base: "/"`). So `/lingua-academy` loads the
  app with no server change. Check that a deep path like
  `/lingua-academy/` (trailing slash) still loads its assets.
- **Read the address once at start-up** (`src/main.tsx` or the top of
  `ArabicTrainer`): `slug = location.pathname.split("/")[1] || ""`.
- **Not signed in:** call `org-info`.
  - **A current slug** shows `Onboarding` (`src/spaces.tsx`) with the
    space's logo and name in place of the ManyTongues logo and title, and
    its colour as the accent on that screen only (29a). "Set up" asks for
    an invite or course code (24b).
  - **A former slug** calls
    `history.replaceState(null, "", "/" + moved + location.search)` and
    reloads `org-info`.
  - **An unknown slug** shows `Onboarding` with a `Notice`: "There's no
    space at this address." and a link to `/`.
  - **On the plain home page**, `Onboarding` offers sign-in, plus "Set up"
    behind a code field. The code decides the space, and the address
    changes to it after sign-up.
- **An invite link** is `/<slug>?join=<code>`. `Onboarding` reads `join`,
  pre-fills the code, and goes straight to the "new" step.
- **Signed in:** after `whoami`, if the address's slug isn't the
  account's:
  - **With `?join=` present (82b):** don't move. Show, with `Notice` and
    two `Button`s: "You're signed in to {own name}. This link is for
    {other name}. To join it, make a new account. Your current one
    stays." The buttons are "Make a new account" (signs out on this
    device with the existing log-out path, then shows `Onboarding` at
    this address with the code pre-filled) and "Back to {own name}"
    (`replaceState` to the own slug, dropping `?join=`).
  - **Otherwise**, call
    `history.replaceState(null, "", "/" + account.org.slug)`.
  - **App admins** stay at the address they opened (35a). Every
    `courses-api.ts` call then sends `x-org` with the id of that address's
    space (add it in `call()`, next to `x-key`). On the plain home page,
    an App admin acts in "Main".
- **Wrong address while not signed in (53b):** `Onboarding` sends
  `body.org` with `signin` and `signup`. On `other-space` it shows the
  message: "This key belongs to the space {name}." with two buttons,
  "Go to {name}" (link to `/<slug>`) and "Make a new account here" (goes
  to the "new" step). It uses `Notice` and `Button`.
- **Suspended or closed:** on `suspended`, `Onboarding` shows "This
  account is suspended. Ask your space's admin." On `space-closed`, it
  shows "This space is closed." In both cases the device is signed out.
- **Stored account:** the account stays in `localStorage["arabic-account"]`
  (`loadAccount`/`saveAccount` in `src/courses-api.ts`). It now also
  carries `org`. All spaces share the one origin, so one device holds one
  signed-in account at a time. Switching accounts is sign out, then sign
  in.
- **Installed app:** `start_url` is `"."` relative to the manifest at the
  root, so the installed app opens at `/`, then moves to the account's
  space. Nothing to change.

## B7. Screens, stage by stage

**Stage 1 — numbers by choice (46c).**
- On a deck's screen in Teaching (the "This deck" block in
  `src/spaces.tsx`, under the Courses field), when the deck holds number
  parts, add a `Field` labelled "Numbers from". It holds a `RadioGroup` of
  the teachers in the space who have numbers in the deck's language. The
  owner comes first and is chosen by default when they have numbers. With
  no candidates, show the existing `partsWaiting` nudge.
- Tests: a course with two teachers who both have numbers gives each
  number once, from the chosen teacher. Changing the choice moves the
  deck's students onto the other set, and items they already had from the
  first set keep their progress.

**Stage 2 — spaces underneath.**
- No screen changes. Server only (B2–B4), plus `x-org` in `call()`.
- Tests: a new `tests/spaces.test.mjs` built like `tests/server.test.mjs`
  (a real server on a temp `DATA_DIR`). Write a second org's records
  straight into the store, then for **every** action in the
  `action === "…"` list, assert that a user of one org can't read or
  change the other's course, deck, card, system or flag. Assert that every
  list leaves the other org out, and that an App admin with `x-org` can.
- Add one test that fails if a new `action === "…"` appears in
  `courses.js` without being listed in the test's table. That stops a
  later action from being added without its org check.

**Stage 3 — creating spaces and addresses.**
- **Spaces tab.** Admin gets a **Spaces** tab
  (`["orgs", "Spaces", <an existing icon>]` in `AdminSpace`'s `tabs`), for
  App admins only.
  - The list is an `ItemList` of spaces: name, address, people count, and
    "Closed" when archived.
  - A space opens into a `Section` with `Field`s for name, address, logo
    (the card editor's picture picker, reused), colour (an
    `<input type="color">` inside a `Field`, as plain as the app's other
    inputs), and space admins (the existing people-list pattern).
  - Archive and reopen sit behind a `ConfirmModal`. Delete sits behind the
    typed-name `ConfirmModal`.
  - "New space" asks for the name, address and the first space admin's
    name, then shows the new key the way `admin-create-user` does today.
- **The You menu** (`CornerMenu` in `src/ArabicTrainer.tsx`): at the very
  top, above the Learning/Teaching/Admin picker, show the space's logo and
  name (read-only, no switching). The logo is **not** shown on the bar's
  button.
- **Addresses:** the handling in B6.
- **Sign-up code:** remove the `SIGNUP_CODE` field and its handling from
  `Onboarding`.

**Stage 4 — space admins and accounts.**
- **Who sees Admin.** `AdminSpace` shows for App admins and space admins
  (`account.admin || account.orgAdmin`). For space admins, hide the "App"
  tab (backup, restore, clear), the Spaces tab, and the delete actions.
- **People tab.**
  - The space's invite link sits at the top: a read-only field with Copy
    and "Replace link" (`ConfirmModal`: "The old link will stop
    working.").
  - Each current person's row gains "Suspend" (`ConfirmModal`), except on
    space admins' rows, which only you can act on (70a).
  - Under the current list, a "Former members" `Section` shows each
    record: name, joined, left, courses, and why ("Left", "Removed",
    "Deleted their account", "Deleted by the app admin").
  - Suspended people have "Reactivate". Anyone who owned space material
    has "Hand their material to…". App admins also see "Remove this
    record".
- **Reports.** The Flags tab goes to space admins too (7a).
- **`AccountPanel`** (`src/ArabicTrainer.tsx`):
  - Add "Leave this space" (`ConfirmModal` with the 52a warning: "You won't
    be able to sign in until your space's admin reactivates you.").
  - Keep "Delete account" (`CloseAccount`, typed-handle confirmation),
    with its text saying what goes and what stays (A2).
  - The sign-in key's text changes from "your administrator can issue a
    new one" to "your space's admin can issue a new one".
- **The key reminder (18a, 19b).**
  - `Onboarding`'s existing "key" step ("Keep this somewhere safe", with
    an "I've saved it" button) gains a sentence recommending a password
    manager, and a tick box ("I've saved my key somewhere safe") that
    enables the button. On that button, call `key-saved`.
  - The same step is shown after a **sign-in** when the answer says
    `keySaved: false`, which covers accounts someone else made.
- **Lost key.** On `Onboarding`'s "existing" step, add `Help` text: "Lost
  your key? Ask your space's admin for a new one. Everyone else:
  contact@manytongues.co" (75a).

**Stage 5 — My space.**
- **Teachers:** in `TeachSpace`, the Decks and Cards tabs get a
  `Segmented` at the top: "Space" | "My space". "My space" lists the
  person's personal decks and cards, and "New deck" there makes a personal
  deck.
- **Learners:** the You menu's mode picker (`PlacePicker`) gains
  "My space" for people who don't teach (58a). It opens `TeachSpace` with
  a `personalOnly` prop: no Courses tab, only the "My space" side of
  Decks and Cards. Learners don't see the `Segmented`.
- **A personal deck's screen:**
  - In place of the "Courses" `Field`, a `Field` labelled "Practise this
    myself" with a single checkbox (the existing `CheckList` with one
    option, or the plain checkbox pattern used in `card-editor.tsx`). Its
    lede: "Its published cards are in your Learning."
  - In the deck list, a deck not practised shows the existing `TileNote`
    "Not practised" (59b, 61a).
  - A teacher's personal deck also shows "Copy to the space"
    (`ConfirmModal` with the 15a warning).
  - The "Numbers from" choice (stage 1) offers the owner and the space's
    teachers (73b).
- **Adding course cards to a personal deck (66b):** the deck's "Manage
  cards" picker offers the person's own cards and the cards of courses
  they study, each with a small note saying which course it came from.
- **Learning:** the pseudo-course "My space" from `my-material` appears in
  `StudentCourses` and wherever courses group decks. It has no leave
  control and no code. The report button is hidden on a card that's
  personal and in no course.

**Stage 6 — your extras.**
- In a space's page in the Spaces tab: "Export this space" (the backup
  progress pattern, saving one file) and its storage figures
  (`admin-org-usage`).

## B8. Pitfalls

- **A list that forgets the org filter is a leak.** Everything that reads
  `index:courses`, `index:decks`, `index:users` or `index:flags` must
  filter by org. That includes `everyCourse`, `withLinks`,
  `partsWaiting`, `systemKeysOf`, `wipeAccount`, `admin-overview`,
  `my-*`, and the export plan (`exportable`). The stage-2 test exists to
  catch this.
- **`canEditDeck` is called from many places** (rename, lock, delete,
  parts, attach, report checks, `mayEditCard`). Change its signature
  once, and let the type checker find every caller.
- **`wipeAccount` is the most dangerous change.** It used to delete all of
  a person's material and must now delete only personal material (85a).
  Test both paths (`delete-account` and `admin-delete-user`): space decks
  and cards survive and keep working in their courses; personal ones and
  the practice history are gone; borrowed course cards survive; the
  Former members record and `gone:` record exist.
- **Codes** (`K.code`) are one site-wide namespace: course codes, teacher
  codes and now space invite codes. `codeTarget` has to tell them apart.
  The fallback scan in `courseForCode` (for restored backups) must also
  scan orgs' `inviteCode`.
- **Sessions remember where a card came from** (`courseId` and `deckId`
  on reports). The pseudo-course id `my-space` must never be sent to the
  server as a real course id.
- **Space admins aren't App admins.** Never set `admin: true` for them.
  Everything that checks `me.admin` today must be read again and decided:
  App admin only, or space admin too (table in B4).
- **Deleting a space** touches every kind of record. Test it on a space
  with recordings that another space also uses, and check those survive.

## B9. What to tell the owner at each hand-over

What changed for people, what to try by hand on the deployed app, and
anything still to decide, in plain terms (CLAUDE.md). For stage 2 the
answer is "nothing visible; here is how we know nothing leaks". For stage
3, remind the owner to remove `SIGNUP_CODE` from the server's environment
if it's set.
