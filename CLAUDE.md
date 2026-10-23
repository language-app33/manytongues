# Working on this repository

Notes for Claude Code, and for anyone driving it. Conventions for the code
itself are in `README.md`; what is here is how work gets delivered.

## Finish on beta, without being asked

**`beta` is the branch that deploys.** Work that only reaches a feature
branch has not been delivered — it is sitting where nobody can see it.

So: develop on whatever branch the task names, and when the work is done and
checked, **merge it to `beta` and push, every time, without asking.** This is
a standing instruction from the repository's owner. Do not stop to ask
whether to merge, and do not report a change as delivered until `origin/beta`
carries it.

Before the push to `beta`:

- `npm run check` is green on the exact tree being pushed — lint, types, unit
  tests, the smoke harness, and the build, which is what CI runs too.
- The release in `package.json` is bumped and `CHANGELOG.md` says what
  changed, in the terms `README.md` describes.

How to push it:

```bash
git fetch origin beta
git push origin <your-branch>:beta      # a fast-forward, the usual case
```

A checkout may hold a **local `beta` that is unrelated to `origin/beta`** —
one that shares no history with it and deploys nothing. Do not merge into
that branch by habit; confirm what you are about to push with
`git rev-list --left-right --count origin/beta...HEAD` and push the branch to
the remote ref, as above. If the push is not a fast-forward, merge
`origin/beta` into the work first and resolve it there — never force-push
`beta`.

Opening a pull request is still something to be asked for. Merging to `beta`
is not.

## Keep the open pull request's title and description current

An open pull request follows its branch, so every push to `beta` adds to the
pull request merging `beta` into `main`, if one is open. **After every push
to a branch that has an open pull request, update that pull request's title
and description, every time, without asking**, so they describe everything
it now carries, not only what it was opened with:

- The title names every release the pull request spans (for example
  "0.364–0.365: …") and what each is about.
- The description has a section per release, newest first, in the plain
  terms of the changelog: what changes for the people using the app, any
  trade-off, and anything still to be checked by hand. Then whatever else
  rode along, and what was checked (`npm run check` on the pushed tree).
- Check for an open pull request after pushing; do not assume there is
  none. A change that is not a release (a test, a note like this one) goes
  under "Also included".

Do not report the work as delivered until the pull request says what it
carries.

## How to talk about the work

**Plans, proposals and summaries of what was done are written for the
owner, not for the code.** Plain language, and short: what is wrong or
wanted, what will change for the people using the app, what it costs, and
how it will be checked. No file paths, function names, line numbers or
mechanism unless the owner asks — those belong in commit messages,
`DECISIONS.md` and comments, where a reader wants them. If a technical
detail must be kept in a plan for the build's sake, put it in one short
section at the end, clearly marked as such.

This applies to every plan presented for approval, every proposal offered
in conversation, and every summary of actions taken at the end of a piece
of work.

## How to ask clarifying questions

Asking is part of every piece of work, without waiting to be told to. When
anything in a request is unclear or could be read more than one way, ask
before building on a guess. When everything is clear, do not invent
questions for the sake of asking; get on with it.

Whenever there are questions for the owner, while brainstorming, before
building or at any other point, ask them this way, every time:

- Questions are numbered 1, 2, 3, and so on. Numbers are for questions only,
  never 1a or 1.1 for a question.
- Questions may be grouped under headings by topic, but the numbering runs
  on across headings: if the first heading holds 1 and 2, the next starts
  at 3.
- One question per number, never two in the same item.
- Every question offers options, lettered a, b, c under it, so the owner
  can answer the whole set in a line ("1a, 2b, 3a"). This holds even for an
  open question: suggest likely answers as options; the owner can still
  write their own.
- Every question ends with the recommended option, named by its letter,
  and a very short reason why — a sentence at most.
- Concise and non-technical, in the same plain terms as above.

## How to propose fixes

Whenever there is more than one way to fix something, whether in answer to a
question, in a plan, or offered unprompted, set them out the same way as
questions, every time:

- Each thing to decide is numbered 1, 2, 3, running on across any headings.
- The fixes for it are lettered a, b, c under it, one fix per letter, so
  the owner can answer "1b, 2a" and be understood. Never 1.1 and 1.2.
- Each fix says, in the same plain terms as above, what changes for the
  people using the app and what it costs or gives up.
- Each thing to decide ends with the recommended fix, named by its letter,
  and a very short reason why.

Where there is only one sensible fix, still say which it is and why, rather
than presenting it as a list of one.
