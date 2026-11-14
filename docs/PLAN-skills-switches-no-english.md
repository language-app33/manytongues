# Handover: skills, course switches and exercises without English (ManyTongues)

You are implementing changes to the ManyTongues app, in the repository this session is opened on. The design was agreed with the owner on 13 and 14 November 2026, at release 0.623. This document replaces the earlier handover "organise ManyTongues practice by skill"; that plan's stage 1 (the top-up fix) shipped as 0.623 and nothing else of it is built. Read this whole document before touching anything.

**You build all of it in this one session, stage by stage, in the order of section 7, with exactly one pause: after stage B you stop, report, and wait for the owner to say "continue" (section 7, "The pause").** Apart from that pause, the owner will not be answering questions while you work. Every decision is already in this document. Where it is silent, section 0 says what to do. Each stage is its own release, checked and pushed before the next begins, so that whatever you finish is delivered and whatever you do not finish is cleanly absent.

The goal of the whole piece: a teacher can run a course with less English, or with none, and practice is organised by skill rather than by four levels.

## 0. How to work

1. Read `CLAUDE.md` first and follow it exactly. It tells you how to deliver (merge to `beta`, bump the release, changelog, pull request) and how to talk to the owner (plain language, no file names, numbered questions with lettered options).
2. Read the `README.md` sections on the ladder, cleared and learnt, deck quality and units, and the DECISIONS.md entries named in section 9.
3. Before each stage, re-read the code it names. Line numbers move; find things by name with search.
4. `npm run check` must be green before any push to `beta`. It takes 6 to 10 minutes; run it in the background with a long timeout.
5. If `tests/component-uses.test.mjs` fails with "stale", run `npm run components` and commit the result.
6. A release bump changes `package.json` and two places in `package-lock.json`.
7. Each stage that changes behaviour gets a `CHANGELOG.md` entry in plain language and a `DECISIONS.md` entry saying what changed and why.
8. Names of new exercise types, fields and files in this document are suggestions. Keep the behaviour; choose names that fit the code you find.
9. **First action:** save this document, unchanged, as `docs/PLAN-skills-switches-no-english.md`, with a section at the end headed "Progress". After each stage, add one line there: the stage, the release, "shipped" or "left out" and why, and anything decided on the way. Commit it with the stage. If you lose your place, that file and `git log` say where you are; resume at the first stage not marked.
10. **One stage, one release.** For each stage: write the tests that state the behaviour and see them fail; build; run `npm run check` on the exact tree; bump the release; write the changelog and decisions entries; push to `beta` as `CLAUDE.md` says; update the open pull request's title and description as `CLAUDE.md` says. Only then start the next stage. Never start a stage with the previous one unpushed or the check red.
11. **Apart from the one pause, nobody is there to ask.** When this document is silent or two readings are possible, take the reading that changes least for students and teachers and that cannot lose anything stored, and write the choice in the Progress section. Never invent a feature to fill a gap.
12. **Do not rush a stage to reach the next.** A stage that is left out costs the owner nothing. A stage shipped wrong can cost students their progress.
13. **Before using any claim in sections 1b and 2, find it in the code.** They were written by reading release 0.623 and the code may have moved. If a claim is false now, say so in Progress and follow the code.
14. **The last thing you do** is the final report of section 7, in the plain terms `CLAUDE.md` asks for.

## 1. Safety rules. These override everything else here

- **S1. Never change existing stored progress.** Progress lives on each form as `s[key]`, one record per exercise key. Do not rename, delete, rewrite or migrate existing keys, and do not add stored fields to them. New behaviour for existing exercises must be a new way of *reading* the existing records. **The one exception:** a new exercise type records progress under its own new key, as every exercise does. That is allowed only after stage A has shipped and its test passes, because a device on an older version will receive those keys through sync.
- **S2. Never demote a card.** A card that is Cleared or Learnt the day before a stage ships must still be Cleared or Learnt the day after. The same holds when a teacher adds a picture, a description or a recording to a card, and when a teacher flips a course switch: the card keeps its status and the new question joins its reviews. Each stage has a test for this. If a stage cannot keep this true, that stage is not shipped (section 7, "When a stage cannot be finished").
- **S3. Only word cards use the skill rules, until the last stage.** A form uses them only if every exercise type it supports is in the map of section 3 and it passes the scope test there. Every other form (number ranges, times, digits, verb tenses and their persons, conversation and text lines, anything with an unmapped type) keeps today's ladder exactly.
- **S4. One door.** Skill rules are reached only through the door functions of stage C, and course switches only through the one function of stage B that answers "is this exercise allowed for this form". Do not sprinkle conditions through the app.
- **S5. No behaviour change without a test that states it,** and no existing test deleted to get green. A test may be changed only when its sentence is no longer the agreed behaviour; say which and why in the commit and in DECISIONS.md.
- **S6. Measure before and after.** Stages B, D, F and every stage that adds an exercise run the pace simulation (`tests/pace.test.mjs`, `tests/pace-forgetting.test.mjs`, shared code in `tests/pace-sim.mjs`) before and after, over at least five seeds each, and write the numbers in Progress and in the final report: cards met, cards mastered, days for a word to reach its top, what a forgetting learner keeps. **The gate:** the average of "kept" after must not be lower than the lowest single seed of "kept" before. If it is, the stage has failed its gate and is not shipped.
- **S7. When in doubt, leave it out.** If a safety rule cannot be met, a gate fails, or a test you did not expect fails and you cannot find the cause, do not weaken the test, the rule or the gate. Undo that stage's changes completely, leave the app as the previous stage left it, record why in Progress, and go on to the next stage that does not depend on it (the table in section 7).
- **S8. Teachers cannot see student progress. Do not add that.** The description check (section 5) reads the course's plan, never a student's records.

## 1b. Data-loss rules, from the audit of 14 November 2026

Found by reading the code at 0.623, not by running old builds. Re-check each against the code before relying on it. Each rule needs a test that fails if it is broken.

**Student progress**

- **D1. Current devices strip progress they do not know, every time they load.** `liftStates` in `src/ArabicTrainer.tsx` rebuilds `s` from `TYPES` and drops every other key; it runs on load, after every sync and on restore. The key survives only because each push is built from pull-then-merge, and `mergeStates` in `src/sync.ts` merges key by key whatever the type. It is lost for good if the server copy is unreadable and such a device replaces it. So stage A must change `liftStates` to carry unknown keys untouched, and no new exercise type ships before that has reached devices (S1).
- **D2. No new top-level field on the learner's document.** `mergeData` and `forWire` in `src/sync.ts` keep a fixed list of fields, so any current device's sync erases a new one from the server.
- **D3. Nothing new in the learner's settings.** Settings are last-writer-wins as a whole (except `pathReached`), and `RETIRED_SETTINGS` strips the names `types`, `kinds`, `skills` and others on every load. The course switches live on the course record only (D8).
- **D4. No new learner data on a course card or form outside `s`.** A course refresh (`foldCourses` in `src/shared.tsx`) takes the teacher's card whole and keeps only `priority`, `priorityAt`, `reset`, `s` and `met`.
- **D5. Every write to a progress record stamps `updated`.** `isFreshState` drops a record that is `phase: "new"` with no reps, no history and `updated` 0, whatever else is on it.
- **D6. Status is never stored; it is recomputed from `s` over what the form supports now.** So S2 and R14 cannot be met by storing a flag. Meet them by reading records that stay in `s`: a form that has at least one pass on any `WM` produce key, whether or not that exercise is still supported or allowed, has been cleared before and stays Cleared; its passes are counted across all its `WM` produce keys, so it stays Learnt. A newly gained skill joins its reviews. A pass is only ever credited to an already cleared form, which is what makes this safe. Today, removing a picture or adding a second accepted answer can demote a card; under this rule it must not.
- **D7. Keep the document small.** The server refuses a learner's document over 4 MiB and sync then stops. Practice-only exercises (`say`, `sort`) store no progress record, or the least possible. Each exercise stage reports the size of a large learner's document before and after.

**Teacher material**

- **D8. The course switches are a field on the course record.** Every server write to a course spreads the stored record, and no client uploads a whole course, so the field survives. Add it to `materialVersion` in `server/api/courses.js`, or students keep the old switches until something else changes. `create-course` needs no value (absent means everything on). Restoring a backup onto an existing course does not bring switches back; say so on the restore screen.
- **D9. The Description is stored on the card, never on a form.** The server rebuilds every form from a fixed list on every save, and an older editor rebuilds the card's own word field by field, so a form-level field would be wiped.
- **D10. Four lists must gain the Description, or it is silently dropped:** `fieldsFor` in `save-card`; `VERSIONED_KEYS` (without it, an edit to a published card disappears and never reaches students); `cardToItem` on the device; the editor's `writtenCard` and the request built in `src/spaces.tsx`. If its length is capped, extend `trimmedOf` so the teacher is told.
- **D11. The server writes the Description only when the request carries it,** the way `splitFrom` and `together` are handled, not the way `clue` is. Otherwise a save from an older build, or one replayed from an older build's offline queue, erases it. The new editor sends an empty string to clear it.
- **D12. Splitting a card into one per meaning must not copy the Description to every new card.** Keep it on the first card only, as pictures are (the owner's choice).
- **D13. Custom tags on a device are `item.fills`, not `item.tags`** (`tags` holds deck titles). Tag names are lower-case Latin letters, digits, `_` and `-`, at most 24 characters, 12 tags to a card; a tag named like a word type is removed automatically. So a tag's name can never be shown to a student as a label; baskets show example words.
- **Tests for D8 to D12:** a save from a client that does not send the Description keeps it; editing a published card keeps it in both the pending and the published copy; it reaches a student's device; it survives export, import, backup, restore, copy and move to another space; a course's switches survive every course action and reach students.

**Already in the app today, not caused by this plan. Stage 0 fixes the first, second and fourth; the third is left as it is**

- A teacher removing a form or a conversation line discards every student's progress on it; it is not set aside.
- A new form put where a removed one was can inherit the old one's progress, by position.
- Reordering a card's accepted answers swaps which answer each progress record belongs to.
- Importing an exported card drops its unpublished changes.

## 2. What the app does today (checked against 0.623)

- Every exercise type has a level 1 to 4 (`EX` and `levelOf` in `src/languages.ts`). A level opens for a form when every exercise it supports on the levels below is `solid`: right twice running (`solid`, `openTypes` in `src/scheduler.ts`). Two wrong running closes the levels above. A level a card has no material for is passed straight through.
- `laddered(form, settings)` in `src/ArabicTrainer.tsx` is the list of keys a form climbs with. About 45 places read it or its relatives (`cleared`, `passesMade`, `reachedLevel`, `standingsOf`, `atItsTop`, `learnt`, `throughOnce`, `readsBare`, `openTypesOf`).
- **Cleared** = every key in `laddered` is solid. **Learnt** = cleared plus two timed passes on every top-level key. Since 0.453 a form past its lower levels is asked its top-level keys only.
- What a form supports (`availableTypes`) depends on the card and on its company: choosing needs enough similar cards, pictures need other pictured cards (`pictured`). Listening is paused when sound is off or clips are not on the device.
- **Pictures** exist on word forms only (`images`, up to four). Three picture exercises exist: `rec2img`, `img2pick`, `img2ar`. There is no "read the word, choose its picture".
- **A word can already be saved with no English** when it has a recording or a picture.
- **"Clue" is taken.** A card's `clue` is a few English words that tell apart two cards sharing a word or a meaning. Leave it alone. The new thing is called **Description**.
- **Tags** exist on cards (`tags`); sentence blanks find their words through them.
- **A course record has no settings** beyond its title, language, decks, codes and path. Settings sync whole, last writer wins, except `pathReached`.
- **Deck quality** (`src/deck-quality.ts`): 55 points for words met in sentences, 10 for sentences well made, and 5 each for recordings, pictures, pronunciation, reviewed, no repeats, not too long, a scene. It reads the deck and nothing about students or courses.
- **Units**: a course's path of units in order (`src/path.ts`); ordinary decks have no order.
- The teacher's card editor has three tabs: Basic, Advanced (only while "Build an advanced card" is ticked) and Exercises. The Exercises tab lists what is practised and the exercises to try. A card's tags are of two kinds: default tags, which follow from the kind of card, and custom tags, which a teacher picks in the "Custom tags" sheet.

### What was found about older versions and unknown exercises (read only, not probed)

- The session logic asks only exercise types the running version knows (`TYPES`, `availableTypes`); nothing that loops over the keys in `s` throws on an unknown one. But a current device drops unknown keys from its own copy on every load (D1); they return from the server at each sync.
- `checkAnswer` in `src/languages.ts` reads `EX[typeOf(key)].answerMode` without a guard. Today it is only reached with keys built from `TYPES`.
- The danger is anywhere an exercise is *named* outside a card's progress and then looked up: `exOf` returns null for an unknown type and its callers use the result without checking. A comment in `src/languages.ts` over the retired `ar2tr` says so, and retired types keep their definitions for exactly this reason. Look at anything stored or synced that carries a type name (a session in progress, weak-spot lists, reports, exports), and at the loop over `s` in `src/tense-skills.ts`.
- This was read from the code, not run against an old build. Stage A proves it.

## 3. The model

Every word has three sides: how it is **written**, how it **sounds**, and what it **means**. Every exercise gives the student one side and asks for another. Three things describe any exercise:

- **Skill**: what is given and what is asked for.
- **Step**: how the student answers. **Recognise** = they choose from options. **Produce** = they make the answer themselves.
- **Meaning is in**: whenever a meaning is involved, the form it takes, whichever side it is on: **English**, **a picture**, or **the language itself** (a description, a phrase, a topic). Numbers add a fourth: figures.

Two consequences, both intended:

- Translation is one switch: turning English off removes the English rows and nothing else.
- A meaning cannot be made, except by saying it in another language. So the two "Understand" skills have a Produce step only where English is allowed.

### The five skills

| Skill (name on screen) | Code name | Given → asked |
|---|---|---|
| Understand it when you see it | `US` (was `UR`) | written → meaning |
| Understand it when you hear it | `UH` | sound → meaning |
| Write what you hear | `WH` | sound → written |
| Write what you mean | `WM` | meaning → written |
| Say what you see | `SS` (new) | written → sound |

### The map

Existing types by their ids; **new** types in bold with a suggested id.

| Skill | Meaning is in | Recognise (choose) | Produce (make) |
|---|---|---|---|
| `US` | English | `ar2pick`, `match`, `ex2en` | `ar2en` |
| `US` | a picture | **`ar2img`** word → picture · **`imgmatch`** words ↔ pictures grid · **`ar2many`** pick from many | none |
| `US` | the language | **`ar2def`** word → its description · **`oddone`** odd one out · **`sort`** sort into groups · **`ar2many`** | none |
| `UH` | English | none | `rec2en` |
| `UH` | a picture | `rec2img` · **`rec2many`** pick from many, heard | none |
| `UH` | the language | **`rec2def`** listen → its description · **`rec2many`** | none |
| `UH` | figures | `recfig`, `recown` | none |
| `WH` | none involved | `recmatch`, `rec2attr` | `tr2ar`, `rec2ar`, `rec2ctx` |
| `WM` | English | `en2pick` | `en2ar` |
| `WM` | a picture | `img2pick` | `img2ar` |
| `WM` | the language | `ctx2pick` · **`def2pick`** description → choose the word | `ctx2ar` · **`def2ar`** description → write the word |
| `WM` | figures | none | `own2ar` |
| `SS` | none involved | none | **`say`** say it and compare (practice only) |

**Build the sentence** (**`senbuild`**) is for sentences, which are outside the skill rules (S3). It sits on level 3 of the ladder.

Every type still needs a level in `EX`, because forms on the ladder and older readers use it: level 1 for `ar2img`, `ar2def`, `rec2def`; level 2 for `imgmatch`, `def2pick`, `oddone`, `sort`, `ar2many`, `rec2many`; level 3 for `senbuild`, `say`; level 4 for `def2ar`. On a form that is on the ladder, pick from many is never dealt and `sort` and `say` are never required.

**Scope test.** A form uses the skill rules only if: its card is not from a number system until stage K; it is not a tense form, a held person, a conversation or text line; and every type in `availableTypes` for it is in the map. Otherwise it stays on the ladder.

### Rules

"Allowed" below means allowed by the course switches of section 4 for that form.

- **R1. A form has a skill** if it supports at least one allowed exercise of that skill that can count (R3, R5). Read this from what the card supports, not from what can be played right now, so a paused listening skill is still required. `SS` is never required (R6).
- **R2. Order of skills.** `US` and `UH` are open from the first day. `WH` opens once any exercise on the form has been answered. `WM` opens once `US` is proven, or at once if the form has no `US`. Once `WM` has been proven, a later slip in `US` does not close it.
- **R3. Recognise is passed** when any one allowed recognise exercise of the skill is right twice running. An exercise counts only if the student picks from at least four choices. So `sort` (two baskets) is practice only: it is dealt, it records its own answers, and it never holds a card back or moves it on. A skill with no recognise exercise starts at its produce step. This one rule replaces the earlier "every recognise exercise", and the earlier special case for `WM`.
- **R4. Stepping stone.** In `WH`, when the proof is `rec2ar` or `rec2ctx`, `tr2ar` must be right twice running before the proof is asked. `rec2ctx` is asked only when it is the proof.
- **R5. Proof.**
  - Where the skill has an allowed produce exercise, the proof is a produce exercise right twice running. `WH`: `rec2ar`, else `rec2ctx`, else `tr2ar`. `WM`: any one of its allowed produce exercises. `US`: `ar2en`. `UH`: `rec2en`.
  - Where the skill has no allowed produce exercise (the "Understand" skills with English off), the proof is **pick from many** right twice running: `ar2many` for `US`, `rec2many` for `UH`. If the form cannot support pick from many (no picture and no description, or too little company), it does not have that skill (R1).
  - While a skill is unproven, ask the proof exercise whose last answer was right, to finish its run; after a miss, move to the next proof the form supports.
- **R6. An exercise the student marks themselves never proves anything** and never passes a step. `say` is dealt as practice only.
- **R7. Cleared.** Every skill the form has is proven. A card stands where its weakest form stands, as today.
- **R8. Learnt.** Cleared, plus two timed passes on the `WM` proof that proved it. Passes are counted exactly as today. A form with no `WM` skill is Learnt only by D6 (it has passes from before); otherwise it stays Cleared.
- **R9. Reviews.** Once a skill is proven, its recognise exercises and stepping stones are retired: never dealt, never counted as due. A cleared form is asked only its solid `WM` proof exercises, and only when due. Stage F adds the listening proofs.
- **R10. Slips.** One miss changes nothing. Two misses running on a proof make the skill unproven and the card Learning; the proof is asked again until right twice running. The easier exercises do not come back. Passes go to nought as today.
- **R11. Picking exercises.** For the form a sitting takes, ask up to two exercises, in this order: a proof due for review; an exercise whose last answer was right but is not yet right twice running; the next required exercise of an open skill, recognise before produce. Among the recognise exercises of a skill, vary which is asked. Never ask a retired exercise. Keep the existing order-of-types and grid rules.
- **R12. Stages shown.** Opens later; Not started; "Learning · N of M skills"; "Cleared · N of 2 passes"; Learnt. Inside a card, each skill shows by its on-screen name as not started, practising, proven or slipped.
- **R13. Gates.** Where a rule reads "level 2 reached" for a word form on the skill rules, read "`US` proven" (or, with no `US`, "any skill proven"). Where a rule reads "cleared", "learnt" or "through once", read it over the form's required exercises only.
- **R14. No demotion.** A form cleared by today's rule is cleared by the new one, because what is required is a subset of today's. Prove this with a test over generated cards. A card that gains a skill later (a teacher adds a recording, a picture, a description, or turns a switch on) keeps Cleared or Learnt; the new proof joins its reviews and is asked when next dealt (S2). How this is read without storing anything: D6.

## 4. Course switches

- **What.** Each course carries an on/off switch for every exercise type, stored on the course and sent to students with the course material. Absent means on.
- **Where.** On the course's own page, teachers only: every exercise listed under its level (under its skill once stage E ships), each with a switch.
- **Four choices at the top:** *With translation*, *Little translation*, *No translation*, *Custom*.
  - A shortcut sets and **locks the switches of the exercises that use English**; they are shown greyed, so the teacher sees what it set. Every other switch stays free.
  - *Custom* unlocks everything.
- **With translation.** Everything on, as today.
- **Little translation.** An English exercise is dropped only where the same form has an English-free exercise on the same level (same skill and step once on the skill rules). After an answer, the English meaning is hidden behind a tap; a question answered with it opened counts as a near miss.
- **No translation.** No English exercise is asked and English is never shown to the student, the answer screen included. A word with nothing but English to teach it (no picture, recording, phrase or description that yields an allowed exercise) is not asked, and the teacher is shown the list of such words: "cannot be taught without English".
- **Two courses, one card.** A question is asked if any course the student got the card through allows it.
- **A student's own cards** (My space) are not affected.
- **Switching never deletes progress.** A switched-off exercise is not dealt and not required; its record stays and resumes if it is switched back on. S2 holds across a flip.
- **Never stranded.** A level or step with nothing allowed is passed through, as a level with no material is today. Before saving a change that leaves cards with no questions at all, the page says how many ("14 cards would have no questions") and asks.
- **Older versions** ignore the switches and keep asking everything. Say so in the changelog.
- **New exercises are on** in existing courses on the day each ships, `say` included.

## 5. The new exercises

All are English-free. All apply to word cards unless said otherwise.

- **Word → its picture (`ar2img`).** The word is shown; pick its picture out of four. Needs a picture, and other pictured words for company, as `rec2img` does.
- **Words ↔ pictures (`imgmatch`).** The matching grid of `match`, with pictures where the English is. Same needs.
- **Description (`ar2def`, `def2pick`, `def2ar`).** A new box on a card's Basic tab, under the word and its meaning, labelled "Description": a few words in the language itself ("where you buy bread"). Three questions: pick the description for a word; pick the word for a description; write the word for a description.
  - **The teacher's check.** As the description is typed, each word in it is marked by where the course teaches it. Card in a unit: *Taught in this unit* · *Taught earlier, in unit 2* · *Taught later, in unit 5* · *Taught in "Food", no fixed order* (an ordinary deck of the course) · *Not taught*. Card in an ordinary deck: the same, with units named and no "earlier" or "later". A deck in several courses is checked against the course it was opened from; a deck in no course against itself, and the check says so. *Not taught* is the one real warning: that description can never be asked. Reuse the word lookup the sentence check already uses.
  - **For the student.** A description is held back until that student has cleared the words in it, as a sentence waits on its words.
- **Pick from many (`ar2many`, `rec2many`).** The word is shown, or played; pick its picture or its description out of eight, one try. It is the proof of an "Understand" skill when English is off (R5), and is not dealt otherwise.
- **Listen → its description (`rec2def`).** The word is played and not shown; pick its description out of four.
- **Odd one out (`oddone`).** Four words: three from one topic, one from another; tap the stranger. The three companions are words the student has cleared. The answer counts for the stranger only. **Groups are the card's custom tags, all of them.** There is no topics screen, nothing to tick and no label to choose. A tag is used once the student has cleared at least three of its words. Reword the help under "Custom tags" on a card and at the top of the Custom tags sheet to say that tags fill sentence blanks and are practised in Odd one out and Sort into groups; say in the sheet when a tag is too small.
- **Sort into groups (`sort`).** Six known words dropped into two baskets. Grammar kind: by what the cards already state (gender, number), baskets labelled with words the student knows, such as *he* and *she*; needs nothing from the teacher. Group kind: two custom tags; each basket shows one example word from its tag, already in place when the question opens, and never the tag's name. Practice only (R3).
- **Build the sentence (`senbuild`).** Sentences and conversation lines of three words or more. The sentence is played; tap its shuffled words into order. Only the card's own order and its accepted alternatives are right. Counts for the sentence, not for its words. Where the course allows English, the meaning may be the cue when there is no recording.
- **Say it and compare (`say`).** Anything with a recording. Hear it, record yourself, hear both, tap *Matched*, *Nearly* or *No*. The student's recording never leaves the device and is discarded after the question. Never asked where the microphone is refused. A "can't speak now" button skips it for the session. Practice only (R6).
- **Later, not designed in detail: question and answer.** On a conversation or text card, in the Exercises tab, a section "Questions about this text": the teacher writes a question in the language, the right answer and wrong answers, with the same word check as descriptions. Pick-the-answer only.

**Dropped by the owner, do not build:** sound-alikes, goes with, opposites, find the mistake, build the word from letters.

## 6. Deck quality

- The pictures check becomes **"a picture or a description"**, still 5 points.
- A description that uses a word no deck of the course teaches counts against the deck the way such a sentence does.
- A separate line beside the score, not part of it: **"Works without English: N%"**, the share of the deck's words that would be asked in a *No translation* course.
- The score still reads the deck alone and does not change with a course's switches.

## 7. Stages

Order chosen by the owner: the existing losses first (stage 0), then switches, then the skill rules, then the new exercises.

### When a stage cannot be finished

A stage is finished when its tests pass, `npm run check` is green, its gate (if it has one) is met, and it is pushed to `beta`. If you cannot get there (S7): put the tree back exactly as the previous stage left it (`git status` clean, nothing half-built, no dead switch left behind), record it in Progress, and move on by this table. Never ship part of a stage.

| Stage | Needs | If it is left out |
|---|---|---|
| 0a, 0b, 0d | nothing | go on; the others do not need it |
| A | nothing | **end the whole run at the pause after stage B, and say so there.** Nothing that adds an exercise type or a card field may ship without A |
| B | nothing | go on to C; the shortcuts are simply absent |
| C | nothing | skip D, E, F2, G, H, I, J, K; do F1 only if it needs no door |
| D | C | skip E and everything after it except F1 |
| E | D and its gate | skip F2, G, H, I, J, K |
| F1, F2 | E (F2); F1 as said | go on |
| G | A, B, E | skip nothing else, but H's pick from many then has descriptions only |
| H | A, B, E | go on |
| I | A, B, E | go on |
| J | A, B | go on |
| K | E | go on |

The new exercises (G to J) are built only on the skill rules. If the skill rules are not switched on (E), do not build them on the ladder instead.

### Stage 0. Losses the app has today

Three releases, 0a, 0b and 0d, each beginning with a test that reproduces the loss. They change how a student's progress is matched to a teacher's card, so be exact: read `foldCourses`, `foldForms`, `progressOf`, `withProgress` and the parking of a card's progress in `src/shared.tsx`, and `mergeItem` and the expiry of `parked` in `src/sync.ts`, in full, before writing anything.

- **0a. A removed form or line keeps its students' progress.** Today `foldForms` drops a local form or conversation line that the teacher's fresh copy no longer has, and the loss spreads through sync. Change: when a refresh finds a local form or line with answered progress and no match in the fresh copy, set its progress aside in the existing `parked` store under that card and that form's id, exactly as a whole card's progress is parked when the card leaves a course. When a later refresh brings a form with that id back and it has no progress of its own, give the parked progress back and remove that one entry. Use only what `parked` already is (D2, D4): it already syncs and already expires. Tests: remove a form, refresh, the progress is parked and not lost; bring it back, the progress returns; a device that never saw the form is unaffected; a whole card leaving and returning behaves exactly as before.
- **0b. A new form never inherits a removed one's progress.** `foldForms` matches an unmatched fresh form to the old form in the same position. Keep that fallback only when both the fresh form and the old form have no name of their own to match by (the legacy case it was written for); where either has a name, an unmatched fresh form starts with no progress. Tests: delete form X and add form Y in its place, Y starts fresh and X's progress is parked (0a); a card whose forms have no names matches by position exactly as before.
- **0c. Reordering accepted answers. Do not build.** No safe design exists yet. Leave the behaviour as it is and say so in the final report.
- **0d. Importing an exported card keeps its unpublished changes.** Only if the export file already carries them and the server's `save-card` can be given the published version and then the changes, in two ordinary saves, with no new server action. If it needs more than that, leave it out.
- S1 and S2 apply here as everywhere: no stored record is rewritten, and no student's card changes its stage on the day this ships.

### Stage A. Older versions and unknown exercises (its own release, before stage B)

- Add a test that puts a record for an unknown exercise type on a form and runs every reader the app has over it (the doors-to-be, standings, weak spots, the session build, sync merge, the progress screens, export): nothing throws, nothing is asked, the record survives a sync.
- Change `liftStates` so a key it does not know is carried untouched rather than dropped (D1), retired types included. Check that this does not bring back the problem its comment describes (a stale mapping writing a state for a retired type).
- Make every lookup of an exercise by name tolerate an unknown name, `checkAnswer` included.
- Add tests for D2 to D5 as guards: they fail if a later stage adds a top-level document field, a learner setting, learner data on a course card outside `s`, or a progress write that does not stamp `updated`.
- **Run a real old build against new data** (the owner asked for this). Build the app from the release before this stage, give it a learner's document and course material carrying what later stages add (a progress record for an unknown exercise, a card with a Description, a course with switches), and take it through load, a session, save, sync in both directions, a course refresh, and a teacher's save of that card. Then read the server's copy: nothing added may be missing or changed. Repeat with the build that contains this stage. Write what was found in Progress and in the final report. If the old build loses or changes anything that this stage was meant to protect, stage A has failed (S7).
- **Done when** the test passes. This stage is pushed to `beta` as its own release before stage B is begun, so that it reaches devices first. The owner has accepted the remaining risk: a device that has not opened the app since, and so still runs the old code, keeps dropping the new records from its own copy until it updates; the server's copy is what protects them.

### Stage B. Course switches, on today's four levels

- Build section 4 with today's exercises only. One function answers "is this exercise allowed for this form", read wherever `availableTypes` is.
- Tests: each bullet of section 4 as a sentence; S2 across a flip in both directions; a card in two courses; My space untouched; the "no questions" warning count; an older client's upload does not wipe the switches.
- **The screen** is as sketched for the owner: the four choices in a two-by-two block at the top; a line under them saying "English exercises are switched off by this choice. The others are yours to set."; in *No translation*, a red line "N words cannot be taught without English" with "See them", opening the list; then the exercises under their level headings, one row each with its name, an "English" tag where it uses English, and its switch; rows locked by a shortcut are greyed and read "Off". Use the app's existing components (`docs/UI-COMPONENTS.md`).
- Ship as a release. Pace run with English off (S6).

### The pause

When stage B is pushed (or left out), stop. Do not begin stage C. Write to the owner, in the plain terms of `CLAUDE.md`:

- What stages 0a, 0b, 0d, A and B changed for students and teachers, with each release number, and anything left out and why.
- What the old-build run of stage A found.
- The pace numbers for stage B.
- Every choice you made where this document was silent.
- What to check by hand on a real phone: a course set to each of the four choices; a card whose form a teacher removes and puts back; a student with two devices.
- One line saying that the rest (practice by skill, then the new exercises) starts when the owner replies "continue", and that it will then run to the end without another pause.

Then wait. If the owner replies with changes, make them first, as their own release. If the owner replies "continue", go on from stage C to the end and finish with the final report. This is the only place you wait.

### Stage C. Map and doors, with no behaviour change

- Add `src/word-skills.ts`, pure: the map of section 3 as data (skill, step, meaning-is-in for each type), and functions to read it.
- A test that every type in `TYPES` is either in the map or in an explicit list named "not a word skill", so a new exercise type cannot be forgotten.
- In `src/ArabicTrainer.tsx`, add door functions and route every existing reader through them, each still returning exactly what it returns today. Add one constant `WORD_SKILLS_ON = false`.
- **Done when** the whole suite passes with no test changed, and no reader of `laddered`, `cleared`, `passesMade`, `reachedLevel`, `atItsTop`, `throughOnce` or `readsBare` remains outside the doors. No release bump: push it to `beta` with the check green, listed under "Also included" in the pull request.

### Stage D. The skill rules behind the switch (still off)

- Implement R1 to R14 inside the doors, used only when `WORD_SKILLS_ON` is true and the form passes the scope test. The rules read the course switches through stage B's function.
- New test file, one test per rule, written as sentences. Include: a card with script, transliteration and English only; a card with recording, picture and phrase; the same cards with English off; the no-demotion test (R14) over generated cards in every state and across a switch flip; a form with an unmapped type stays on the ladder; gates (R13).
- Run the whole suite with the constant off and on. With it off nothing may differ from stage C.
- Pace run with it on (S6), with and without English. No release bump: push it to `beta` with the check green, under "Also included".
- **Gate for switching on (stage E):** the whole suite green with the constant off and on; the no-demotion test green; the S6 gate met with English on. If any fails, leave `WORD_SKILLS_ON` false, keep stages C and D in the tree (they change nothing while off), and follow the table.

### Stage E. Skill rules on, with the screens

- Only if stage D's gate is met.
- Set `WORD_SKILLS_ON = true`. Update what students see (R12) with the five on-screen names. Group the teacher's card editor and the course switches page by skill and by "meaning is in". Forms still on the ladder keep their level wording.
- Update README's level table and DECISIONS.md.
- **Changelog must say:** cards now clear when each skill is proven; many cards will show as Cleared sooner; nothing was lost.
- **Check in a browser before pushing** (the repository's smoke harness, or the app run locally with a learner who has cards in every state): a climbing card shows "Learning · N of M skills"; no card that was Cleared or Learnt changed stage; a number stretch and a path unit that were open are still open. List in the final report what the owner should look at on a real phone.

### Stage F. Near-misses and listening reviews

Two separate releases, as in the earlier plan and unchanged by this one.

- **F1. Near-miss.** On a `WM` produce exercise, a spelling near-miss (reasons `near` and `harakat`) does not break the run of two. Everything else about a near-miss stays.
- **F2. Listening stays in review.** Once a form is cleared, its `UH` proof and its listening `WH` proof stay open and are asked when due, at most one listening review per form per sitting. Learnt does not wait for listening passes. Spread the backlog over 30 days by a number worked out from the form's id; nothing stored.

### Stage G. Picture exercises

- `ar2img`, `imgmatch`, `ar2many`, `rec2many` (picture side). Requires stage A to have aged (S1).
- Tests per exercise; R5 with English off; S2 when a picture is added to a Learnt card; offline behaviour as for `rec2img`.

### Stage H. Descriptions

- The Description box, `ar2def`, `def2pick`, `def2ar`, the description side of pick from many, `rec2def`, the teacher's check, the hold-back for students, and section 6.
- **The screen** is as sketched for the owner: on the Basic tab, under the word and its meaning, a box labelled "Description" with the hint "in the language itself, no English"; under it one line per word, in the order written, the word on one side and where the course teaches it on the other, green for taught in time, amber for taught later, red for "Not taught"; and, when a word is not taught, a line saying that students would never be asked this description and to add a card for the word or reword.

### Stage I. Groups

- `oddone`, `sort`, and the new wording on the custom tags section and sheet. No new screen.
- Wording, settled by the owner. Under "Custom tags" on a card: "Your own groups of words. They fill sentence blanks, and students practise them in Odd one out and Sort into groups." At the top of the sheet: "Tick the tags this card should have. Words that share a tag fill the same sentence blanks and are practised together in Odd one out and Sort into groups. Type to find one, or to create a new one."

### Stage J. Sentences and speaking

- `senbuild` on the ladder (level 3). `say`, with the microphone rules of section 5.

### Stage K. Number word cards

- Extend the scope test to word cards from a number system (not ranges, not digit cards). Re-check every number gate under R13.

### Stage L. Not designed. Do not build

- Question and answer. Skills for sentences, ranges, times, digits, verbs and conversations. Reordering accepted answers (0c). Leave all of these exactly as they are.

### The final report

When the last stage you can do is pushed, write to the owner, in the plain terms of `CLAUDE.md` (no file names, no code):

- What students and teachers get now, stage by stage, with each release number.
- What was left out, and for each: why, and what the app does in its place.
- The pace numbers before and after, for each stage that has a gate.
- What the old-build run of stage A found.
- The size of a large learner's document before and after (D7).
- Every choice you made where this document was silent.
- What to check by hand on a real phone.
- The four things this plan deliberately does not do (stage L and 0c).

## 8. Decisions

**Settled by the owner**

- The model of section 3: three sides, five skills with their on-screen names, two steps, "meaning is in", and the word "proof".
- Recognise is passed by any one exercise with at least four choices, right twice running (R3).
- With English off, an "Understand" skill is proven by pick from many (R5).
- Writing waits for understanding (R2). A card waits for a paused listening proof.
- No step back after a slip (R10). No reviews of "Understand it when you see it" once cleared (R9).
- A spelling near-miss does not break the run when writing from meaning (F1). Listening stays in review (F2).
- Course switches as in section 4, including the lock on English switches and *Custom*.
- The exercises of section 5, listen → its description included, and the ones dropped.
- New exercises on in existing courses when they ship.
- A Cleared or Learnt card keeps its status when it gains a question.
- Say it and compare is practice only.
- The name "Description"; the check reads the course's plan only.
- Odd one out and Sort into groups lean on custom tags as they are; no topics screen. Sort also works by grammar.
- Deck quality as in section 6.
- Question and answer: later, written in the Exercises tab.
- Build order: switches, then skills, then exercises.

**Settled for a single run. The owner has chosen to have all of this built in one session, by you, with one pause after stage B and no other check-ins**

- The three sketched screens are approved as described in stages B, H and I.
- Stage A ships as a release of its own, first; new exercise types follow in the same run (the remaining risk is stated in stage A).
- Where a stage's gate fails or it cannot be finished safely, it is left out, not forced (S7).
- Reordering accepted answers is not fixed in this run.

**Simplifications made in this plan. The owner has been told**

- Learnt does not wait for listening passes (F2).
- Reviews of "Write what you mean" use the prompt that proved the skill.
- Sentences, conversations and numbers stay on the four levels until stage L or K.

## 9. Read before you start

- `README.md`: the three rules that shape a session; deck quality; "A course's path".
- `DECISIONS.md`: "The session mix"; "A card past its lower levels is asked its top (0.453)"; "A deck's quality (0.461)"; "Units: a course's path"; "One card per meaning"; the entries on cleared, learnt and passes.
- `docs/AUDIT-what-teachers-can-make.md`, for what a teacher can and cannot save.
- Code: `src/scheduler.ts`, `src/grade.ts`, `src/session-mix.ts`, `src/session-layout.ts`, `src/languages.ts` (`EX`, `TYPES`, `exOf`), `src/deck-quality.ts`, `src/path.ts`, `src/sentence-words.ts`, `src/card-editor.tsx`, and in `src/ArabicTrainer.tsx`: `laddered`, `openPastPattern`, `atItsTop`, `availableTypes`, `pickableTypes`, `mixCardsOf`, `buildSession`, `quietUnits`, `cardStandings`, `workloadOf`.

## Progress

- **Stage 0a — 0.624 — shipped.** A removed form or line's progress is set aside in the drawer and given back when it returns. Decided on the way: a card still in the course keeps drawer entries for forms it does not carry (before, its entry was deleted on every refresh, which would have lost a returning card's missing forms); a card that leaves joins its progress to what was already set aside rather than overwriting it; progress from before a card's reset is not given back.
- **Stage 0b — 0.625 — shipped.** A fresh form is matched to an old one by place only where at least one of the two has no name. Decided on the way: the plan's "only when both have no name" would have started fresh every sub-form of an old card on the teacher's next save (which names them all at once), so the place match is refused only when both are named.
- **Stage 0d — left out.** An export does carry a card's unpublished changes, but an imported card is never published (it arrives Ready for review), so "save the published version, then the changes" ends with the changes alone and the published version gone — one loss swapped for another. Keeping both would need imported cards published, which the import rules forbid. Import is unchanged.
- **Stage A — 0.626 — shipped.** Devices carry progress records they do not know, untouched, and read past them; `checkAnswer` and the tense-skill loops tolerate unknown names; guards for D2–D5. Old-build run (0.623 client and server, real build in Chromium, with an unknown exercise's record, a card Description and course switches stored): the server's copy kept all three and the teacher's save from an older-shaped request kept the Description; the old device's own copy dropped the unknown record, as expected (the server copy is what protects it). With the 0.626 build (client and server) the same run kept all three on the server and the device's own copy kept the unknown record too; a 0.623 client against the 0.626 server kept everything on the server. No page errors in any run; 35 answers given in each. Decided on the way: the D3 guard reads the setting names the source uses (Settings is an open record, so a type snapshot would not catch a new one); the oldest pre-v2 names (`mean`, `write`) are still left behind once lifted; the harness is kept as `scripts/old-build-check.mjs`.
