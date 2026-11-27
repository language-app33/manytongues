# Plan: personal sets

Nov 15, 2026 · @Taleb

A personal set is a deck of pictures that each student answers a question about once, and is then asked with their own word. It is built almost entirely from what the app already has: decks, cards, the deck screen, the picture and listening exercises, and the practice progress that already syncs. The student's screens follow the prototype, [Personal sets mockup](https://claude.ai/artifact/Fzswx4PzoNZSxuzkMsGpeh); the teacher's side does not, and follows this plan.

## For the owner: what this builds

**What changes for teachers.** Any deck's screen gets one new section, "Personal set", switched off by default. Switched on, the deck's cards with pictures become the set's pictures, and the section holds:

1. **The wording.** The question asked once, the "doesn't apply to me" button, and the three practice questions. The set's name is the deck's name.
2. **The word lists.** Other decks of the same course, chosen from a list. Each is an ordinary deck of word cards, edited on its own screen. With two or more, each student picks one.
3. **Said with the name.** A tick per word.
4. **What is asked.** The name, their word, both together, and whether the word goes before or after the name.

Adding cards, photos (up to four each) and recordings works exactly as on any deck. The recording screen gains one box, "Who is speaking?". The deck's existing check already says which cards still need a recording.

**What changes for students.** As in the prototype. Home says how many pictures are waiting. Before a session with new pictures they choose a list (only if there are several), then answer the teacher's question for each picture, with a skip and a "doesn't apply" button. In practice each picture takes turns between its name, their word and both together, from the picture or from a recording. Settings lists their answers and lets them change any of them.

**Everywhere in the app.** A card with several pictures shows a different one after each right answer, and the same one again after a miss.

**What it costs.** Four releases, built in order. The picture change is visible from the third; personal sets from the fourth.

**How it is checked.** Each release has its own automated tests, the full check passes before it goes to beta, and there is a list to try by hand at the end.

**Things to know.**

1. A student's answers are kept with their practice progress. An admin who clears a student's progress clears their answers too, and the student is asked again. "Reset scheduling" keeps them.
2. Progress is kept per picture, not separately for name, word and both. Changing an answer starts that picture again; changing list starts the set again.
3. Teachers cannot see answers. A problem report a student sends from a picture includes their answer for it, in the line that says what they were shown.
4. A phone that hasn't updated sees the set as an ordinary deck: it asks each picture for its name and teaches the words of every list. One not updated since before 0.626 may lose answers, and the student is asked again.
5. There is no "Copy a list". A second list is a new deck; words can be pasted or imported into it as today.

## What was decided

| Question | Decision |
| --- | --- |
| What it is | A deck with a "Personal set" section switched on. |
| Pictures | The deck's cards that have a picture. Up to four photos each. |
| Word lists | Other ordinary decks in the same course, chosen in the section. The student chooses one, and is only asked when there are several. |
| Wording | Written by the teacher for each set. |
| What is asked | The name, their word, both together: each switchable, word before or after the name. |
| Wrong choices | Of the same kind: other names, other words in their list, other word-and-name pairs. |
| Which photo is shown | The next one after each right answer, on every card in the app. |
| Recordings | On the picture card (its name) and on each word card, each with the name of whoever is speaking. |
| Both together, heard | The word's recording then the name's, in one voice where one person recorded both; otherwise two voices. |
| Listening questions | Hear it, pick the picture; hear it, type it. Two pictures with the same word are never offered side by side. |
| What still needs recording | Shown by the deck's existing check. |
| Unanswered pictures | Asked before a session, can be skipped, reminder on Home. A skipped picture is still asked its name. |
| "Doesn't apply" | Leaves that picture out for that student. |
| Changing an answer | In Settings, with a warning. |
| Can the teacher see answers | No. An answer is included in a problem report the student sends. |
| Where answers are kept | With the student's practice progress. |
| Left out | Sentences with the right "I" and "you"; typed answers; copying a list. |

## For the builder: how it works

Everything from here on is written for the model that builds this. Read the whole document before changing anything. Click through the student's phone in the prototype; ignore its teacher's phone.

### The words used in this plan

| Word | Meaning | Name in code |
| --- | --- | --- |
| Set | A deck with a `set` field. Shown as "personal set". | `Deck.set`, `SetConfig` |
| Picture card | A card in the set's deck whose lead form has a picture. Its word is the thing's name ("Lan"). | nothing new |
| List | Another deck the set names in `set.lists`. Its title is the list's name. | nothing new |
| Word card | A card in a list deck that is not a sentence or a scene ("cô", meaning *father's younger sister*). | nothing new |
| Answer | One student's answer for one picture, kept in that card's progress. | `SetAnswer`, under `SET_KEY` |
| Kind | What one asking of a picture is about: `name`, `word` or `both`. | `TurnKind` |
| Voice | The name saved with one recording on one form: who is speaking. | `voices` |

Do not use the card field `person`: it is a pronoun's column in a verb table. Do not name anything "answers" on its own: `src/answers.ts` means accepted answers on a card. Do not confuse a set with `Unit` in the trainer (one form of a card) or a path unit (`Deck.unit`).

### One worked example

A course has three decks. "Our family" has `set` on and holds picture cards Lan, Minh and Hoa. "Hanoi" and "Saigon" are ordinary decks of word cards, and "Our family" names both as its lists. "Said with the name" is ticked on every word except those for mother and father.

| Student | List | Says Lan is | Lan is asked as |
| --- | --- | --- | --- |
| An | Hanoi | father's younger sister | *Lan*, then *cô*, then *cô Lan*, in turn |
| Bình | Saigon | grandmother | *Lan*, then *bà*, then *bà Lan* |
| Chi | Hanoi | skipped | *Lan* only, until answered |
| Dung | Saigon | doesn't apply | not asked |

An is not taught the Saigon deck's words, and Bình is not taught Hanoi's.

### The seven rules of the design

1. **A set is a deck.** Creating it, adding it to a course, sending it to students, backing it up and deleting it are unchanged. The only new teacher data is the deck's `set` field and `voices` on a form.
2. **Everything taught is a card in an ordinary deck**, edited on the existing screens. A device that does not know about sets sees ordinary decks.
3. **An answer is a progress record.** It lives in the picture card's lead form, in `s`, under a reserved key that is not an exercise. Since 0.626 every device carries such records untouched and no reader looks at them. So syncing, backup, deletion and privacy are the practice document's, with no new storage.
4. **A picture is asked only through four existing exercises:** `img2pick`, `img2ar`, `rec2img`, `rec2ar`. No new exercise type.
5. **What one asking shows is worked out when it is shown**, from the set, the answer and the turn. Nothing about it is stored.
6. **Progress stays on the picture card**, under the same exercise keys as today.
7. **All words the student reads come from the set's wording**, except the app's own fixed words (Next, Skip for now, Continue).

## Rules for the builder

### How to work

1. Read `CLAUDE.md`, then `docs/PLAN-skills-switches-no-english.md` sections 0 and 1 for the house safety rules. They apply here.
2. Build the phases in order. Each phase is one release, on its own commit, and is finished before the next starts.
3. Line numbers are not given, because they move. Find every function by searching for its name.
4. Write the tests for a phase first, see them fail, then make them pass.
5. Never weaken, skip or delete an existing test to get green. If an existing test fails, your change is wrong or the test's sentence is no longer the agreed behaviour; in the second case stop and report before changing it.
6. If something in the code contradicts this plan, stop and report what you found. Do not guess, and do not redesign.
7. **Reuse before you build.** This plan names the existing piece to use at every step. If you are about to write a new server action, a new stored record, a new screen file or a new shared component that this plan does not name, stop and report instead.
8. Do not touch anything this plan does not name. No tidying, no renaming.

### What every release must do before it goes to beta

1. Run `npm run components` after the last edit to any `.tsx` file, and commit `src/component-uses.js`.
2. Run `npm run check`. It takes six to ten minutes; run it in the background with a long timeout. It must be green on the exact tree you push.
3. Bump the version in `package.json` and in both places in `package-lock.json` (0.627.0 becomes 0.628.0, and so on).
4. Add a `CHANGELOG.md` entry at the top, in plain language, in the shape of the 0.627 entry: heading, bold lead sentence, what changes for people, then "To check by hand:".
5. Add a `DECISIONS.md` entry at the bottom: a heading with the release in brackets, a date and files line, then what was chosen and what it costs.
6. Push with `git fetch origin beta` then `git push origin <branch>:beta`. Never force. If it is not a fast-forward, merge `origin/beta` into the branch first.
7. Check for an open pull request and update its title and description, as `CLAUDE.md` says.

### Traps in this repository

| Trap | Rule |
| --- | --- |
| `tests/stored-shape.test.mjs` | Add no top-level field to the practice document (`Doc`) and read no new `settings.<name>`. On a course card the learner keeps only `priority`, `priorityAt` and `reset`; on a form only `s` and `met`. The answer lives inside `s`, which is why it is allowed. Every write to `s` stamps `updated`. |
| A reset | `resetScheduling` replaces every `s` and stamps `reset`, and the merge between devices drops any record older than the reset. An answer must be carried across a reset with its `updated` set to the reset's time. |
| `materialVersion` in `server/api/courses.js` | A deck field that is not in the version never reaches a student. `set` must go in, the way `parts` and `unit` do. |
| `tests/card-facts.test.mjs`, `tests/card-readout.test.mjs` | A new field on a card or form must be described in `src/card-facts.ts`, carried by an example in `tests/card-corpus.mjs`, and shown by the read-out. |
| `tests/language-isolation.test.mjs` | No Vietnamese, Arabic or Hebrew word in any file under `src/` except `languages.ts`. Every word in a set is the teacher's data, so none is needed. |
| `tests/spaces.test.mjs` | Every new server action must be added to its `PLACED` table. This plan adds exactly one. |
| `tests/css-usage.test.mjs` | Every new CSS class must be used whole in code. Code in `src/ArabicTrainer.tsx` may use only classes from `src/index.css`. Prefer existing classes; add as few as possible. |
| `tests/smoke.mjs` | Every new component that renders a shared component needs an entry in `PLACES` in `src/gallery.tsx`. |
| `tests/screen-elements.test.mjs` | Every `data-el` added to `src/ArabicTrainer.tsx` must be listed in `src/screen-elements.ts` with a full sentence. |
| Where components live | `CardPicture` and `PictureChoices` are private to `src/ArabicTrainer.tsx`, not in `src/shared.tsx`. `PickSheet` is a plain sheet with no search; `SearchBox` is the search box. `RecordingScreen` is in `src/card-editor.tsx`. |
| TypeScript settings | No `enum`. Use `import type` for types. Every import names its `.ts` or `.tsx` extension. Nothing unused. |
| Interface text | All interface text is English, written in the component. There is no translation layer. No inline margins; use the `at-mt1` to `at-mt6` classes. |

## Data shapes

All of this goes in one new file, `src/sets.ts`. It is pure: no React, no storage, no clock, no word of any language. The server imports it directly, as it already imports other files from `src/`. It is the only new source file in this plan.

### On a deck: the set

```ts
import type { Millis } from "./types.ts";

/** Present means the deck is a personal set. Its name is the deck's title. */
export interface SetConfig {
  wording: {
    question: string;   // asked once per picture: "Who is this person to you?"
    none: string;       // the doesn't-apply button: "I don't know this person"
    askName: string;    // practice, the name: "Who is this?"
    askWord: string;    // practice, the word: "What do you call this person?"
    askBoth: string;    // practice, both: "Their name, with what you call them"
  };
  lists: string[];      // ids of the decks that are its word lists, in order
  named: string[];      // ids of the word cards ticked "said with the name"
  asks: { name: boolean; word: boolean; both: boolean };
  order: "before" | "after";   // where the word goes beside the name
}
```

It goes on `Deck` in `src/types.ts` as `set?: SetConfig`, beside `unit`. Nothing lists the pictures: they are the deck's cards whose lead form has a picture. Nothing names the lists: a list's name is its deck's title.

### On a form: who is speaking

```ts
/** Who is speaking on each recording of this form, by recording hash. */
voices?: Record<string, string>;
```

It goes on `CardForm` and on the device's `Form` in `src/types.ts`, beside `clips`. Keep only hashes that are in `clips` or `slowClips`; each name trimmed, at most 40 characters; empty names dropped.

### In a picture card's progress: the answer

```ts
/** The key in a form's `s` that holds a SetAnswer. Not an exercise: never add it to TYPES. */
export const SET_KEY = "set-answer";

export interface SetAnswer {
  updated: Millis;      // when it was last written; what the merge between devices reads
  meaning?: string;     // the English of the word chosen
  none?: true;          // doesn't apply
  skip?: true;          // shown and skipped
  list?: string;        // the list deck the student chose for this picture's set
}
// No record, or one with none of meaning, none and skip: the picture has never been answered.

export type TurnKind = "name" | "word" | "both";
```

It is stored at `s[SET_KEY]` on the picture card's lead form. A student chooses by English meaning, so an answer survives a change of list: it resolves to the word in the chosen list with the same English (trimmed, lower-cased). When the chosen list has no such word, the picture is waiting again.

The list choice is written into the record of **every** picture of the set at once. The set's chosen list is the `list` of the most recently updated record among its pictures, provided that deck is still one of the set's lists and the student holds it.

### Limits, enforced by `readSet`

| Thing | Limit |
| --- | --- |
| Each wording | 120 characters; an empty one falls back to the default in the comments above |
| Lists | 12 deck ids, each matching the form of a deck id, no repeats, never the set's own deck |
| `named` | 500 card ids |

### Functions `src/sets.ts` must export

| Function | What it does |
| --- | --- |
| `readSet(raw, ownDeckId)` | Hand-written total reader, in the style of `readPractice` in `src/course-practice.ts`. Unknown in, `SetConfig` or null out. Applies the limits and default wording. Never throws. |
| `emptySet()` | Default wording, no lists, nothing ticked, all three kinds on, word before the name. |
| `readAnswer(raw)` | Total reader for a `SetAnswer`; null for anything else. |
| `withAnswer(item, change, at)` | The item with its lead form's `s[SET_KEY]` merged with `change` and stamped `at`, and the item's `updated` set to `at`. The one way an answer is written. |
| `chosenList(set, heldDeckIds, answers)` | The only held list when there is one; the student's choice as defined above; otherwise null. |
| `resolve(words, answer)` | The word card whose English matches the answer's `meaning`; null for a skip, a doesn't-apply, or no match. |
| `pictureState(...)` | One of `new`, `skip`, `none`, `waiting` (answered, but no match in the chosen list, or no list chosen) or `ok`. |
| `stepsToAsk(...)` | The ordered list of things still to ask. See Phase 2. |
| `kindsFor(set, ok, named)` | The kinds a picture takes turns between: `name` if on; and, only when the answer resolves, `word` if on and `both` if on and the word is ticked. |
| `pairText(set, word, name)` | The word and the name joined by one space, in the set's order. |
| `pairClips(set, wordForm, nameForm)` | The recordings to play for "both together": a voice that recorded both forms if there is one (the first, in the word's recording order), as two groups in the set's order, with that voice's name; otherwise the first recording of each and both names. Null when either form has none. |
| `isRealChange(before, after)` | True when both name a meaning and the meanings differ. |
| `setGaps(set, lists)` | Warnings for the teacher: no list chosen; a list with fewer than four words; a meaning one list has and another lacks; a card in the deck with no picture. |
| `answerLine(set, pictureName, answer, listName)` | One line of plain text for a problem report, at most 200 characters. |

## Phase 1: the two new fields (release 0.628)

**Goal.** A deck can carry `set` and a form can carry `voices`, from a teacher's save to a student's device. Nothing is visible in the app.

### Create

- `src/sets.ts`, with the shapes and the functions `readSet`, `emptySet`, `readAnswer`, `withAnswer`. The rest of its functions arrive in the phases that use them.
- `tests/sets.test.mjs` and `tests/sets-server.test.mjs`. Model the second on `tests/course-practice-server.test.mjs`, which starts the real server on a temporary folder.

### The set on a deck

`set-deck-parts` in `server/api/courses.js` is the model: an action that writes one field on a deck. Read it in full, then add **one** action beside it.

| Action | Who may call it | Body | What it does |
| --- | --- | --- | --- |
| `save-set` | Whoever may edit the deck (`canEditModule`) | `deckId`, and `set` (a set, or null) | Refuses a personal deck and, as `set-deck-parts` does, a locked one. Inside `updateJson`: with null, removes `set`; otherwise stores `readSet(body.set, deck.id)`. Sets `updated`, calls `taught()`, answers with the deck. |

1. In `materialVersion`, add `JSON.stringify(d.set)` to the deck's row only when `set` is present, the way `unit` is added. Without this no change reaches a student.
2. Search for every place a deck is rebuilt field by field (look for `parts` and `unit` being carried). Each must keep `set`.
3. Check that `my-material` sends decks whole. If it picks fields, add `set`.
4. Nothing else on the server: a set is a deck, so creating it, adding it to a course, backup, restore and deletion are unchanged.

In `src/types.ts` add `set?: SetConfig` to `Deck`. In `src/courses-api.ts` add a one-line wrapper `saveSet` and a plain sentence for any new error in `explain`. In `tests/spaces.test.mjs` add `save-set` to `PLACED` where `set-deck-parts` is.

### Who is speaking, on a form

`voices` travels the way `slowClips` does. Search for `slowClips` in each file and add `voices` beside it.

| File | What to add |
| --- | --- |
| `src/types.ts` | `voices` on `CardForm` and on `Form`. |
| `server/api/courses.js` | Where a saved card's forms are narrowed (search for `slowClips: clipList(f.slowClips)`), keep `voices` through a small narrower that applies the rules in Data shapes. The same for a scene's lines. Add it to `RETIRED_CARD_FIELDS` beside `slowClips`. |
| `src/shared.tsx` | Where a server card's forms become device forms, carry `voices` when set. |
| `src/card-facts.ts`, `tests/card-corpus.mjs` | Describe the field in one sentence and add it to an example card that has a recording. |
| The read-out | `ClipList` in `src/shared.tsx` already takes a `label` per recording. Pass "Recorded by" and the name as the label. No new component. |

### Tests to write first

`tests/sets.test.mjs`: `readSet` and `readAnswer` given null, a string, an array, unknown fields, over-long text and too many entries, never throwing; `readSet` fills empty wording and drops the set's own deck from its lists; `withAnswer` keeps the record's other fields, stamps `updated` on the record and the item, and leaves every other key of `s` untouched.

`tests/sets-server.test.mjs`: a teacher saves a set on a deck; a student of the course receives the deck with it; the material version changes when it is saved again; a student cannot save one; a personal deck is refused; null removes it; it survives a change of the deck's title and cards; a card saved with `voices` comes back with them, without names for recordings it does not have.

### Exit

`npm run check` is green. The changelog says this release prepares for personal sets and changes nothing anyone sees.

## Phase 2: asking the student (release 0.629)

**Goal.** A student chooses a list (only when there are several) and answers the teacher's question for each new picture; they can skip, say it doesn't apply, change answers in Settings, and see a reminder on Home. Practice does not use the answers yet. No set exists outside tests, so nobody sees this.

The student's phone in the prototype is the reference for these screens: their order, layout and how the wording is filled in.

### Where an answer is kept

In the practice document, in the picture card's lead form, at `s[SET_KEY]`. Write it only through `withAnswer`, and save through the same `persist` every graded answer uses. That is all: it then syncs, is backed up and is deleted exactly as progress is. Add no server action, no local cache and no new field anywhere else.

Two things must hold, each with a test:

1. **Nothing reads it as an exercise.** `tests/unknown-exercises.test.mjs` runs standings, next review, weak spots, the workload, the climb, the ladder and both session builders with and without an unknown record. Add `SET_KEY` records to its fixtures and require the same answers.
2. **A reset keeps it.** `resetScheduling` replaces every `s`. Change the function it applies to each form so that a record at `SET_KEY` is carried across with `updated` set to the reset's time. Test that after Reset scheduling, and after a merge with another device's older copy, the answer is still there.

### Finding the sets

With `useMemo` in `src/ArabicTrainer.tsx`, from `courseModules` and the items. A deck's cards are found from its `cardIds` and each item's `serverCardId`; the app already builds this map for path units, so reuse it.

- A **set** is a held deck with a valid `set`, in a language in play.
- Its **pictures** are its cards whose lead form has a picture.
- Its **lists** are the decks in `set.lists` that the student holds, in order.
- A list's **words** are its cards that are not sentences or scenes and have both script and English.

### Which things are still to ask

`stepsToAsk` in `src/sets.ts` returns, set by set, in order:

| Step | When |
| --- | --- |
| Choose a list | The set has two or more held lists and `chosenList` is null. Before that set's pictures. |
| Answer a picture | `pictureState` is `new`, `skip` or `waiting`. |

Each picture step is marked **new** (`new`, or `waiting`) or **skipped**. A set with no held list produces no steps.

### The screens

All in `src/ArabicTrainer.tsx`, because `CardPicture` is private to it. One new component, `SetQuestions`, with an entry in `PLACES` in `src/gallery.tsx`. It has three views, built only from existing pieces:

| View | Built from |
| --- | --- |
| **Choose a list.** "Which words do you want to learn?" and the list names. | `Screen`, `RadioGroup`, `Button` |
| **Answer a picture.** The picture, its name, the set's `question`, the English meanings of the chosen list's words, Next, the set's `none` wording as a button, "Skip for now". Header: "3 of 12" and "Skip the rest". | `Screen`, `CardPicture` (first photo; the others as small `CardPicture`s that swap in when tapped), `RadioGroup`, and `SearchBox` above the choices when there are more than eight |
| **Your answers.** One row per picture with its answer, the word in the chosen list, "Not answered yet", or the `none` wording; "Words you're learning" with Change when there are several lists. A row opens the picture view for that picture. | `Screen`, `Tile` |

Answering, skipping or choosing a list calls `withAnswer` and persists at once. Choosing a list writes `list` into every picture of the set.

### When they are shown

1. **Before a session.** At the top of `begin`, `beginWeak` and `startSaved`: if any step is new, show `SetQuestions` with those steps, ending on a short "Thanks. That's all for now." with Start session, then start the session.
2. **On Home.** While any picture step exists, one `Nudge` in the block that holds Start session: "3 pictures in Our family are waiting for your answer." with an Answer button that asks every step. `data-el="set-waiting"`, listed in `src/screen-elements.ts`. With two sets waiting, name the first and say "and 1 more set".
3. **In Settings.** In `SettingsScreen`, one row per set, shown only when the student holds a set, opening the Your answers view. Changing an answered picture or the list asks first with `ConfirmModal`, worded as in the prototype. In this phase it only changes the answer; Phase 3 adds starting again.

### Tests to write first

- `tests/sets.test.mjs`: `chosenList`, `resolve`, `pictureState` and `stepsToAsk` for a fresh student, after answers, after skips, after a picture is added, after the chosen list loses a word, with one list and with two.
- The two tests named under "Where an answer is kept".
- A scenario in `tests/smoke.mjs`, mounted the way the path scenario near the end of the file is: a `my-material` reply with a set deck of three pictures and two list decks; Start session; choose a list; answer one, use the doesn't-apply button on the second, skip the third; assert the screens show the set's own wording, that the saved practice document holds the three records, and that Home says one picture is waiting.

### Exit

`npm run check` is green. The changelog says this is a second preparation step and changes nothing anyone sees.

## Phase 3: practising a picture (release 0.630)

**Goal.** A picture card in a set is asked from its picture or its recordings, taking turns between its name, the student's word and both together. Every card with several pictures takes turns between them. The set part is still dark, since no set exists outside tests; the several-pictures part is visible to everyone.

Read these first, in full, in `src/ArabicTrainer.tsx`: `availableTypes`, `resolveUnit`, `castFill`, `wordPool`, `companyOf`, `installIndexes`, `inPlay`, `resetScheduling`, `reportExtras`, how `recSeq` is played, and where the question screen draws an exercise's `question` text and its picture prompt. In `src/languages.ts` read `img2pick`, `img2ar`, `rec2img`, `rec2ar`. In `src/scheduler.ts` read `turnOf`.

### Part A: the set index

One module-level index in `src/ArabicTrainer.tsx`, with a setter, kept exactly as `VALUE_OWNER` and `setValueOwner` are, set from `installIndexes` (one more optional parameter: the sets found in Phase 2), and forgetting cached exercise types as the other setters do (search for `forgetTypes`). It answers:

| Question | Answer |
| --- | --- |
| Is this item a picture of a set, and which? | the set, or nothing |
| What is its state, and which word does it resolve to? | `pictureState`, and the word card's lead form |
| Which kinds does it take turns between? | `kindsFor` |
| Is this item out of play? | yes for a picture whose answer is "doesn't apply"; yes for a card whose every held deck is a list of some set and not that set's chosen list |

A card in two sets uses the first in course order.

### Part B: which exercises a picture offers

In `availableTypes`, before the result is cached, for the lead form of a picture of a set, keep only `img2pick` and `img2ar` (when `kindsFor` is not empty) and `rec2img` and `rec2ar` (when some kind has a recording to play, Part F). Find the first two by their `promptField` being `"image"`, not by name. The card's other forms offer nothing. Drop a choice exercise when fewer wrong choices exist than it needs; read that number from `PICK_OPTIONS`.

### Part C: what one asking shows

Add `castSet(resolved, type)` and call it first in `castFill`. For the lead form of a picture of a set:

1. The kind is `kinds[turnOf(unit.s[type]) % kinds.length]`: the app's existing rule for what varies between askings, so a missed question comes back the same. For a listening exercise, skip kinds with nothing to play.
2. `ar`, `lat` and `en` become the answer for that kind: the card's own for `name`; the word card's lead form's for `word`; `pairText` of the two for `both`.
3. Add `setAsk` (the set's `askName`, `askWord` or `askBoth`) and, for `word` only, `setCaption` (the picture card's own script).
4. The unit keeps the picture form's `id`, `s` and pictures, so progress stays on the picture. Use `withLead(parent, unit)` as `castFill` does for a filled sentence. Nothing is stored.

On the question screen, show `setAsk` in place of the exercise's `question` text, and `setCaption` under the picture (`data-el="set-caption"`, listed in `src/screen-elements.ts`, an existing caption class).

### Part D: the wrong choices

Where `img2pick` builds its choices from `wordPool(companyOf(asking, exercise), ...)`, build the pool for a set's picture from the kind instead, and hand it to `optionsFor` unchanged:

| Kind | Pool |
| --- | --- |
| `name` | The lead forms of the set's other pictures. |
| `word` | The lead forms of the other words in the chosen list. |
| `both` | The student's own pairs for the set's other pictures, then this picture's name with other ticked words. Built as forms in memory. |

### Part E: in play, and starting again

1. In `inPlay(item)`, return false when the index says the item is out of play. Check, by reading the callers of `buildSession`, that sessions and the Home and Cards counts go through `inPlay`; where one does not, stop and report. Nothing is deleted: a picture left out keeps its progress.
2. Phase 2 changed the function `resetScheduling` applies to each form. Reuse it: when a change confirmed in Settings is a real change (`isRealChange`), apply it to that one picture item, with `reset` and `updated` stamped, then write the new answer with the same time. On a change of list, do the same for every picture of the set. A first answer, an answer after a skip, and anything involving "doesn't apply" start nothing again.

### Part F: listening

`rec2img` and `rec2ar` take the same turns. What is played:

| Kind | Played |
| --- | --- |
| `name` | the picture card's own recordings |
| `word` | the word card's recordings |
| `both` | `pairClips`: the word then the name, in one voice where one person recorded both |

1. `castSet` puts one kind's recordings on the unit as its ordinary recordings, and a pair as `recSeq`, which the player already plays in order. If `recSeq` cannot play two groups from two cards as it stands, stop and report.
2. Under the play button show "Recorded by" and the name, or both names for two voices (`data-el="set-voice"`). Show it for any card whose playing recording has a name in `voices`, not only in sets.
3. `rec2img` draws its wrong pictures from the set's other pictures, never one whose answer resolves to the same word for this student, and never one with the same name.

### Part G: taking turns between photos, on every card

Today every place that shows a card's picture takes the first (search `images[0]` in `src/ArabicTrainer.tsx`). Change only these:

1. In `castFill`, for a unit with two or more pictures, add `imageAt = turnOf(unit.s[type]) % images.length`. Nothing is stored.
2. The prompt of a picture exercise shows `images[imageAt]`, and so does its answer screen.
3. A picture offered as a choice shows its card's `images[(turn + i) % count]`, where `i` is its position. Which cards are offered, and how two are told apart, stays keyed on the first picture.
4. Lists, tiles and editors keep showing the first.

### Part H: the report

In `reportExtras`, when the reported card is a picture of a set, append `answerLine(...)` to the `shown` text it already builds, separated by " · ". No new report field, no server change, no change to any screen that shows reports.

### Tests to write first

`tests/sets-ask.test.mjs`, through the trainer's exported `installIndexes`, `castQuestion` and `buildSession`, set up the way `tests/blank-pools.test.mjs` and `tests/session.test.mjs` are:

- The worked example: turns 0, 1, 2 show *Lan*, *cô* with the caption *Lan*, and *cô Lan*; on the Saigon list, the Saigon word. With the word after the name, *Lan cô*.
- An unticked word gives no `both` turn; with every kind off the picture offers nothing; a skipped picture offers only `name`.
- `setAsk` is the set's wording for each kind.
- Wrong choices for each kind are of that kind and never the right answer.
- A doesn't-apply picture is not in play and returns with its progress when the answer changes. With two lists and none chosen, no card held only by list decks is in play; with one chosen, the other list's are not.
- A right answer writes progress on the picture and none on the word card.
- A real change starts exactly one item again, stamps `reset`, and the answer survives a merge with an older copy; a change of list does so for every picture of the set.
- Listening: one voice for a pair when one person recorded both, two otherwise; no listening turn for a kind with no recording; `rec2img` never offers a picture with the same word.
- Photos: a card with three pictures shows 1, 2, 3, 1 on turns 0 to 3, the same on the answer screen, and the same again after a miss; a card with one picture, and a picture card in no set, behave exactly as before.
- The report's `shown` carries the answer line for a set's picture and is unchanged for any other card.

Existing tests near this change that must stay green unchanged: `tests/offers.test.mjs`, `tests/session.test.mjs`, `tests/session-fill.test.mjs`, `tests/look-alike.test.mjs`, `tests/chance.test.mjs`, `tests/stored-shape.test.mjs`, `tests/unknown-exercises.test.mjs`.

### Exit

`npm run check` is green. The changelog says a card with several pictures now shows a different one each time it is got right, and that the rest prepares for personal sets.

## Phase 4: the teacher's side, and records (release 0.631)

**Goal.** A teacher can switch a deck into a personal set and say who is speaking on a recording. This is the release where personal sets become visible.

### Part A: the section on the deck screen

`PracticeSection` in `src/spaces.tsx` is the model: one section on an existing page, with its own draft state, saved through one action. Read it and the place it is used, then read the screen a deck opens into (search for `openModule` in `src/spaces.tsx`).

Add one component, `SetSection`, in `src/spaces.tsx`, shown on the deck screen of any deck that is not personal. Add it to `PLACES` in `src/gallery.tsx`. Everything in it is an existing shared component:

| Part | Built from |
| --- | --- |
| "Personal set" Off or On. Off hides the rest. Turning it off when it holds settings asks first. | `Segmented`, `ConfirmModal` |
| The wording: five boxes, each starting at its default. | `Field` |
| Word lists: the chosen decks, each with its word count and a remove button; "Add a list" opens a picker of the other decks in the same course or courses, leaving out this deck and other sets. | `Tile`, `IconButton`, `ModulePickScreen` (leave out `onCreate`, so it offers no New deck) |
| Said with the name: the words of each chosen list, by list. | `CheckList` |
| What is asked: the three kinds, and before or after the name, with a live example from the first picture and first word. | `CheckList`, `Segmented` |
| Warnings from `setGaps`, worded plainly, never blocking a save. | `Notice` |
| "You won't see what each student chose. It is included only in a problem report a student sends." | `Help` |
| Save | `Button`, `useRun`, `API.saveSet` |

Nothing else on the deck screen changes. Its cards are the pictures and are added, edited, given photos and recordings, and removed exactly as on any deck. In the course's list of decks, mark a set with a `TileNote` reading "Personal set".

No new CSS file and no new screen. Use the `at-formblock` and `at-formhead` classes the course page's sections use.

### Part B: who is speaking

In `RecordingScreen` in `src/card-editor.tsx`:

1. Add one `Field`, "Who is speaking?", above the record button, with the names already used on this card as small buttons that fill it in. It starts at the name of the card's most recent recording, or empty.
2. A recording made while the box holds a name is saved with that name in the form's `voices`. An empty box saves no name, exactly as today.
3. Removing a recording removes its name. `ClipList` already shows a label per recording: pass the name.

This is on every card, not only in sets.

### Part C: what still needs recording

Nothing to build. The deck check in `src/module-quality.ts` already counts and lists a deck's cards with no recording, and the deck screen already shows it. Confirm with a test that a set's deck and its list decks are scored as any deck is.

### Part D: a teacher trying it out

A teacher has no answers. Where the Teaching space sets up its indexes for trying an exercise, give the set index a stand-in: the first list, and every picture answered with that list's first word. With no list, a picture is tried as its name only.

### Tests to write first

- `tests/sets.test.mjs`: `setGaps` for each warning.
- A scenario in `tests/smoke.mjs`, modelled on an existing deck-screen walk: open a deck, switch Personal set on, change the question, add two lists, tick a word, switch the word to after the name, save; assert what `save-set` was sent. Switch it off and assert null was sent.
- A second scenario, modelled on the existing recording walk: record with "Who is speaking?" filled in and assert the saved form's `voices`; record with it empty and assert no name.

### Records to write in this release

- **README.** A passage on personal sets beside the one on path units: a set is a deck with `set`; its pictures and lists; the answer is a progress record under `SET_KEY` and why; the seven rules of the design; a module map entry for `sets.ts`.
- **DECISIONS.md.** One entry per choice that was not obvious, each with its cost: a set is a deck and its lists are decks; the answer lives in `s` under a key that is not an exercise, and is carried across a reset; an answer is matched across lists by its English; one picture takes turns between kinds instead of keeping progress per kind; who is speaking is kept per form, and a pair is played as two recordings; a card with several pictures takes turns between them everywhere; a device that has not updated sees ordinary decks.
- **BACKLOG.md.** One entry each for what was left out, below.
- **docs.** Save this plan as `docs/PLAN-personal-sets.md` with its Progress section filled in.

### Exit

Changelog entry in plain language, with the hand checks from the last section of this plan.

## What this plan adds, in total

So the builder can check nothing extra crept in.

| Kind of thing | Added |
| --- | --- |
| Server actions | One: `save-set`. |
| Stored records | None. One field on a deck (`set`), one on a form (`voices`), one key inside existing progress (`SET_KEY`). |
| Source files | One: `src/sets.ts`. |
| Components | Two: `SetQuestions` (student) and `SetSection` (teacher), both built from existing shared components. One box added to `RecordingScreen`. |
| Exercise types | None. |
| Report fields, backup kinds, deletion steps, sync code | None. |

## Left out of this version

Each becomes a `BACKLOG.md` entry in Phase 4. Do not build any of them.

| Left out | Why |
| --- | --- |
| Sentences that use each student's word, such as the right "I" and "you" | The owner chose pictures and words first. |
| Typed answers, or more than one answer per picture | Every answer is chosen from a list, so it can be marked. |
| Copying a list | A list is a deck; words can be pasted or imported into a new one. |
| Joining word and name where the language changes them | "Both together" puts the two side by side with one space. |
| Progress kept separately for name, word and both | One picture takes turns; changing an answer starts it again. |
| The teacher seeing or correcting answers | The owner chose not to. |
| A count of recordings per voice | The deck check lists what is missing; nothing more was needed. |
| Sets in a person's own space | Only courses a teacher runs. |

## To check by hand, once all four are out

- [ ] A teacher switches Personal set on for a deck, picks two lists, and every part of the section saves and comes back after a reload.
- [ ] Changing the wording changes every screen the student sees: the question, the doesn't-apply button, the practice questions, Home, Settings.
- [ ] Two students of one course, answering differently, are each asked their own word.
- [ ] Each picture takes turns between name, word and both, from the picture and from recordings.
- [ ] Wrong choices are always of the same kind, and never from the list the student did not choose.
- [ ] With one list nobody is asked to choose; with two each student is asked once, and is not taught the other list's words.
- [ ] A skipped picture is asked its name only, and Home says how many are waiting.
- [ ] "Doesn't apply" removes the picture; changing it back brings it back with its progress.
- [ ] Changing an answer warns and starts that one picture again; changing list warns and starts the set again.
- [ ] Answers made on a phone are there on a laptop, and are still there after Reset scheduling.
- [ ] Signed in as an ordinary teacher, nothing shows a student's answers; a report from a picture shows the answer to the admin.
- [ ] A recording made with "Who is speaking?" filled in shows that name wherever it is listed and under the play button.
- [ ] "Both together", heard, plays one voice when one person recorded both, and names two voices otherwise.
- [ ] Hear it, pick the picture never offers two pictures the student calls by the same word.
- [ ] A person with three photos is shown a different one after each right answer and the same one after a miss; so is an ordinary card with several pictures.
- [ ] A phone that has not updated since before 0.628 still opens, keeps its progress, and treats the set as an ordinary deck.

## Progress

One line per phase, filled in by the builder as each ships: release, date, and anything that differed from this plan.

The plan was written while 0.627 was current; 0.628 shipped first, so each phase lands one release later than its heading says (0.629 to 0.632).

- Phase 1, the two new fields: 0.629, 15 November 2026. As planned. `save-set` refuses a My space deck with its own error, "personal-set", worded for this case. The read-out names each recording's speaker through a small helper, `voicedClips`, beside `clipsOf`, rather than changing `clipsOf`, which the trainer also reads for its slow-recording labels.
- Phase 2, asking the student: 0.630, 15 November 2026. As planned, with three readings recorded here. "Skip the rest" writes a skip on each picture not yet answered, as the prototype does, so the same pictures are not asked before every session. A set with no pictures asks nothing, not even its list. The reset is a small exported `resetForm`, so it can be tested, and the rule it applies is `keptAcrossReset` in sets.ts. The Settings confirmations use the prototype's wording, though starting a picture again arrives in Phase 3.
- Phase 3, practising a picture: 0.631, 15 November 2026. As planned. The test seams are a few exported helpers (`setChoicePool`, `setReportLine`, `restartItem`, `voiceLineOf`, `setHolds`) beside `installIndexes`, `castQuestion` and `buildSession`, because the choices and the report are built inside the component. A hand-built Ultimate or Weak session reads every item rather than those in play; its cards are chosen from the screens that are, so it was left alone and noted in DECISIONS.md. The "Recorded by" line under the play button shows for any card with a named voice.
- Phase 4, the teacher's side, and records: 0.632, 15 November 2026. Three things differed. The course page lists its decks as chips with no room for a note, so "Personal set" is a note on the deck's tile in the teacher's list of decks. The existing walk that reads an open deck's headings ("This deck | Cards") was changed to "This deck | Personal set | Cards": the plan puts the section there, so that sentence was no longer the agreed behaviour — reported in the summary. `setGaps` takes a third argument, the deck's own cards, for the warning about cards with no picture. The Who is speaking? box shows where the caller keeps names: a card's accepted answers and a scene's lines; not the number and pronoun editors, which are not cards.
- After the plan, 0.633, 15 November 2026: the owner moved where a set is made. New deck now asks for the kind first (regular deck, unit, personal set), and the kind is fixed; the Personal set section shows only on decks made as sets, with no On/Off switch. A unit made this way asks for its course. The heading walk changed in 0.632 is back to its original sentence.
