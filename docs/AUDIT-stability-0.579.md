# Audit: what could be lost, what could fall over, and what is paid for twice

**6 November 2026 · release 0.579, commit 173a7a6.** Read-only: nothing in
the app was changed by this audit. A finding marked *confirmed* was
reproduced by running the real code against a scratch store or a scripted
device; *confirmed by reading* was traced through the code end to end but
not run; *read only* is a reading of the code that was not traced further;
*observed* was seen in the project's own checks.

> **Every finding was addressed in 0.580.** This document is kept as it was
> written. The `CHANGELOG.md` entry for 0.580 says what changed for the
> people using the app; `DECISIONS.md` has the choices it took, newest
> last; "What was done about it" at the foot maps each finding to its
> change and its test.

## Data loss

1. **A new sign-in key strands a student's synced progress.** *Confirmed.*
   A person's practice is stored on the server under a fingerprint of
   their key. Giving them a new key changed the key and left the practice
   under the old fingerprint, so on a new phone they started from nothing,
   though both screens that issue keys promise progress is untouched.
2. **A full backup leaves out a deleted teacher's cards.** *Confirmed.* The
   backup found cards through the lists of current accounts. A teacher's
   account deleted, their cards stayed live for students but were not in
   the backup — nor their recordings, nor the list that lets an admin hand
   their material to someone else after a restore.
3. **A space's export misses members whose first space is elsewhere.**
   *Confirmed.* A teacher who started in Main and joined space B by a
   course code was left out of B's export, with the cards they made in B.
4. **Two saves of one card at once: the first is lost.** *Confirmed.* Two
   teachers, or one teacher in two tabs, each saving a different change to
   the same card: the later save wrote the whole card back as it had read
   it, and the earlier change was gone without a word.
5. **A save kept offline is dropped by a server error.** *Confirmed.* A
   card saved without a connection waits on the device. When the
   connection returned during a deploy, the gateway's error page was taken
   as the server refusing the card, and the card was dropped silently.
6. **A save kept offline is lost when the device is full.** *Confirmed.*
   With storage full, nothing was kept, but the editor closed saying the
   card was saved on this device.
7. **A save kept offline goes to the wrong space.** *Confirmed by
   reading.* The waiting card did not record which space it was made in,
   and was sent to whichever space the app was in when it went.
8. **Log out leaves the practice for the next person.** *Confirmed by
   reading.* Logging out left the practice document on the device. The
   next person to sign in there saw it, and their first sync sent it up
   under their own key.
9. **Reviewing sentences from an editor discards what was typed.**
   *Confirmed.* Saving a review from inside an unlocked card editor drew
   the editor again from the saved card.
10. **Two races.** *Confirmed.* A device whose clock is far ahead aged out
    yesterday's deletions and set-aside progress at its next sync, so
    deleted cards could come back and set-aside progress could be lost.
    And creating a deck while another was deleted could drop the new deck
    from the list of decks, because the list was read and written whole.
11. **Deck membership is sent as a whole list.** *Read only.* Adding a card
    to a deck sent every deck the screen believed it was in, so a screen
    that was out of date could undo somebody else's change. The same whole
    writes applied to a card's status.

## Stability

12. **A failed save's reason is hidden under the editor.** *Confirmed.* The
    message went to the screen behind the full-screen editor.
13. **The checks take twenty minutes, and three releases shipped red.**
    *Observed.* Most of the time was one pacing simulation.
14. **A start-up step that fails keeps the site down.** *Read only.* A
    one-time rename the server runs before it listens was not guarded: if it
    failed, the server never started.
15. **The "no space to open" page shows tabs and old material.**
    *Confirmed.* Someone removed from their only space saw the panel saying
    so with the learner's tabs and last screens still drawn behind it.
16. **The switched-off learner card editor is still in the source.**
    *Confirmed.* About a quarter of the trainer, kept behind a flag that has
    been off since 0.404.

## Inefficiencies

17. **Teaching re-downloads the whole space every 45 seconds.** *Confirmed.*
    With nothing changed, and saved to the device again each time.
18. **Super admin copies Admin's screens; small plumbing three to five
    times.** *Confirmed.* People actions, reports, the "do this and say so"
    helper, the confirm dialog and menu dismissal were each written out
    more than once, and had started to say different things.
19. **Hand-built lists; three picture loaders.** *Confirmed.* Seven lists
    drawn by hand beside the library's list, and three ways of fetching a
    picture, one of which asked again every time a menu opened.
20. **The stylesheet, and media that cannot be cached.** *Confirmed.* About
    a fifth of the stylesheet every learner downloads styles teaching
    screens; thirty classes are styled and used nowhere; dozens of rules
    repeat each other. Recordings and pictures, which never change, were
    served as "never keep this".
21. **Two copies of one progress helper that disagree.** *Confirmed.* The
    copy used when a card's progress is set aside dropped skips on a word
    never answered.
22. **The tests build the app thirty times; device media is never
    cleared.** *Confirmed.* Each test file bundled the app for itself. And
    recordings and pictures downloaded for practice were kept on the device
    for good, whatever happened to the cards that named them.

## What was done about it

All in 0.580.

| # | Change | Test |
|---|---|---|
| 1 | The server moves the practice document and its recordings to the new key's fingerprint, never over one already there (`moveSyncDoc` in `server/api/sync.js`, called by `admin-reissue-key`). The Super admin dialog says what Admin's does. | `tests/audit-0580.test.mjs`: a new key carries the document and its recordings; never overwrites |
| 2 | The backup manifest includes former accounts' card lists, cards, numbers and recordings, and every deck's cards (`admin-backup-manifest` in `server/api/courses.js`). Restore already unions card lists. | `tests/audit-0580.test.mjs`: a full backup keeps a deleted teacher's cards, and a restore serves them again |
| 3 | A space's export keeps everyone who is a member of it (`keepMember`). | `tests/audit-0580.test.mjs`: a space's export keeps a member whose first space is elsewhere |
| 4 | `save-card` lays only the fields it changed over the card as it is when the write lands; `card-status` is worked out from the card at that moment. Same-field edits at the same moment still go to the later. | `tests/audit-0580.test.mjs`: two saves keep both edits; a status change racing a save |
| 5 | A queued save waits through no connection, timeouts, 5xx and non-JSON answers, and is dropped only on the server's own refusal, which the teacher is told about by name (`isTransient` in `src/outbox.ts`; the drain in `src/spaces.tsx`). Reports learners send follow the same rule. | `tests/outbox.test.mjs`; smoke walk "a save that fails, one that waits, and one refused" |
| 6 | The outbox says when it could not keep anything; the editor stays open and says the device is full. | `tests/outbox.test.mjs`: a full device keeps nothing; the same smoke walk |
| 7 | A queued save carries the space it was made in and is sent there; a space only being tried never queues. | the same smoke walk (`x-org` of the sent save) |
| 8 | Log out sets the document aside under the person's handle and empties the device's copy; signing in again merges it back before the first sync (`parkForLogOut`, `adoptParked` in `src/ArabicTrainer.tsx`). | smoke walk "logging out sets the practice aside, per person" |
| 9 | The review screen is drawn over the open editor, never instead of it; only narrowing a blank, which changes the card's words, draws the editor again. | smoke walk "reviewing sentences from inside an editor keeps what was typed" |
| 10 | Syncs age deletions and set-aside work by the server's clock (`mergeData(…, now)`, `serverTimeOf` in `src/sync.ts`). Index lists and account records are written conditionally (`updateJson`), with enough retries for a burst. | `tests/sync.test.mjs`: clock 200 days ahead; `tests/audit-0580.test.mjs`: decks made and deleted at once |
| 11 | Screens send the decks they believed a card was in (`decksWere`), and the server applies only what was added and removed. Older builds keep the old behaviour. | `tests/audit-0580.test.mjs`: concurrent add and remove; a stale screen |
| 12 | The card editor shows a failed save's reason inside itself, and says it aloud. | smoke walk "a save that fails…" |
| 13 | The pacing simulation checks only the cards a sitting dealt, the forgetting learner runs on a 200-card course (45 days for fifteen sittings a day) in a file of its own, and the tests share one build. | the check's own time; see the commit |
| 14 | A failing start-up migration is logged and the site serves anyway (`migrateOnStart` in `server/index.js`). | `tests/deploy.test.mjs` |
| 15 | The "no space to open" page draws only the panel and the You menu. | smoke walk "no space to open" |
| 16 | The learner card editor is removed; the table reader moved to `src/imports.ts`. | `tests/import-columns.test.mjs` now runs without a build |
| 17 | The teacher's lists and the admin overview answer "unchanged" (304) to a matching ETag, and the device skips writing an identical space. | `tests/audit-0580.test.mjs`; `tests/courses-api.test.mjs`; `tests/space-cache.test.mjs` |
| 18 | `PersonActions`, `ReportList`, `useRun`, `useConfirm`, and `Popover`'s `onClose`; `clearPersonal` and a memoised deck check on the server. | the existing suites; `tests/audit-0580.test.mjs` for leaving one space |
| 19 | `ItemList` for the admin lists, `CheckList` for the menu's languages; one picture fetch (`src/pictures.ts`, `usePicture`). | the smoke walk |
| 20 | Dead rules removed, identical rules merged, and teacher-only rules moved to `src/teaching.css`, loaded with the teaching screens (`scripts/css-split.mjs`). Recordings and pictures are served private and immutable. | `tests/css-usage.test.mjs`; `tests/audit-0580.test.mjs` for the headers |
| 21 | One `compactStates` (`src/sync.ts`) and one `waitsOnWord` (`src/verbs.ts`). | `tests/progress-aside.test.mjs` |
| 22 | `buildOnce` in `tests/helpers.mjs`; recordings and pictures nothing names are cleared from the device once a day after a sync. | `tests/media-sweep.test.mjs` |
