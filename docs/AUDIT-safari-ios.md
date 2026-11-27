# Audit: Safari and iOS browsers (0.730)

Whether the app works in Safari on an iPhone, iPad and Mac, and in the
other browsers on iOS, which are all Safari's engine underneath.

## How it was checked

- **The built app, run in a real WebKit** (WebKitGTK 2.52, the engine of
  the current Safari) with its own server and seeded data, driven with
  real clicks: `scripts/webkit-driver.mjs`. A whole practice session as a
  student, answered by tapping and by typing, to the end; the Home,
  Progress and Cards tabs; a second session after a reload, with the
  first one's progress back from the server; the teacher's Material tab
  and a card. No errors logged, nothing wider than the screen. Its
  windows are private ones, so this is also what a private window does.
- **What a tap may do, measured on a test page in the same engine**:
  a sound with no tap is refused; a sound after a tap still plays when
  the app first waits for the device's storage, the network, or both;
  copying after such a wait works.
- **Everything the app asks of a browser, read against what each Safari
  has**: every browser feature the code names, and every newer piece of
  styling in the two stylesheets.
- **An older iPhone, imitated**: Chromium made to refuse what Safari
  before 16.4 refuses.

Not checked, because nothing here can: a real iPhone's keyboard, notch
and home bar, the home-screen install, and real older versions of iOS.

## Found and fixed

**1. A blank page on Safari before 16.4.** Two patterns in `examples.ts`
used a look-behind, which those versions cannot read; the build passes it
through, the bundle throws as it loads, and nothing is drawn. Imitated
before the fix: an empty page and "Invalid regular expression". After: the
app starts. The patterns now match what stands before the word and step
over it; old and new gave the same answer on 300,000 made-up sentences.
`tests/old-safari.test.mjs` keeps another from arriving.

**2. Sounds silent after an interruption.** An iPhone's sound engine has
a state other browsers do not, "interrupted", for a call, Siri or the app
going to the background, and does not always leave it by itself. The app
woke the engine only from "suspended". It now wakes it from anything but
running. Not reproduced: no computer has the state.

## What the app needs from Safari

With fix 1, nothing stops the app starting on an older Safari. Its look
leans on newer styling, and where that is missing the page is still drawn
but parts of it are not as designed:

| Needs | Safari | Without it |
|---|---|---|
| `:has()`, `dvh` | 15.4 | some rows and sheets sized wrongly |
| container sizes (`cqi`) | 16.0 | tab bar, segmented buttons and on-screen keys lose their fitted sizes |
| `color-mix()` | 16.2 | tinted backgrounds fall back to plain |
| `text-wrap: balance` | 17.5 | headings wrap less evenly; nothing breaks |
| `field-sizing` | 26.2 | a locked card's boxes keep their full width; nothing breaks |

So: as designed from iOS 16.2; iOS 15 and earlier open but are not as
designed, and have not been seen.

## Looked at and sound

- **Storage.** A private window refuses recordings and pictures in the
  device's database ("Error preparing Blob/File data"); the app carries
  on and fetches each one when it is wanted. Safari's clearing of a
  site's storage after seven days unused is in
  `AUDIT-offline-first.md`, finding 9, and is what the install offer is
  for.
- **Playing a recording.** The app loads it from storage after the tap
  and then plays it; measured, the tap still counts.
- **Copying.** Copying reports first fetches their cards; measured, the
  copy still goes through after a short wait, and the screen shows the
  text to select where it does not.
- **Install offer.** Worded for Safari, Chrome, Firefox and Edge on iOS,
  for apps' built-in browsers, and for an iPad that says it is a Mac.
- **The keyboard.** The answer bar is lifted by the app's own measuring
  of the visible area, which is the iPhone path (`DEBUGGING-on-a-phone.md`).
- **Styling Safari wants prefixed** (`backdrop-filter`, `user-select`,
  `appearance`) is prefixed in the source or by the build.
- **Zoom on focus**: the page's `maximum-scale=1` stops an iPhone zooming
  into a box with small text.
- **Pictures** are redrawn as JPEG before they are sent, so an iPhone's
  own photo format never reaches another device.
- **Dates** are built from numbers or from the server's own stamps, never
  from a written date Safari would refuse.

## For the owner to decide

Put to the owner as questions, not changed here:

- **Autocorrect in the answer box.** Nothing tells an iPhone's keyboard to
  leave a typed answer alone, so it may correct or capitalise it.
- **Recordings made outside Safari.** Chrome, Android and Firefox record
  in a format (WebM) that iPhones before iOS 17.4 cannot play, and that
  later ones have had trouble playing from the device's storage. An
  iPhone's own recordings play everywhere.

## To check on a real iPhone

- Sounds after a call or after leaving the app for a while (fix 2).
- A recording made on a computer in Chrome, played on the iPhone.
- The "When is it?" date box when preparing for a day: an iPhone draws its own
  date control, and it has not been seen in this app's box.
- Downloading a backup or an export from the installed app.
- Known and not the app's to fix: with the ring switch on silent, an
  iPhone mutes the answer sounds but not recordings; and iOS 26 has an
  open fault where an installed app's answer sounds work only the first
  time it is opened.
