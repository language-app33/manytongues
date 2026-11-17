/*
 * How to install the app, in the words of the browser it is open in (0.642).
 *
 * The offer on the home screen used to say "Use your browser's Share menu,
 * then Add to Home Screen" to everyone. That is Safari on an iPhone. On
 * Android there is no Share menu to look in, Samsung Internet hides it
 * under "Add page to", an app's built-in browser cannot install anything
 * at all, and Firefox on a computer has no way to install a site — so the
 * offer there was a promise nobody could keep.
 *
 * Read off the user agent, because that is the only thing that says which
 * browser this is. Kept apart from the screen so every browser's line can
 * be tested on a plain string.
 */

export interface InstallHow {
  /** The first sentence: what to do and why. */
  lead: string;
  /** Where the button is, in this browser. Empty where the browser's own
      installer is offered instead, as an Install button. */
  steps: string;
}

export interface Agent {
  ua: string;
  /** navigator.maxTouchPoints: an iPad asking for the desktop site says
      it is a Mac, and this is what gives it away. */
  touch?: number;
}

const LEAD_PHONE = "Add ManyTongues to your home screen to keep your cards safe and open it like an app.";
const LEAD_COMPUTER = "Install ManyTongues to keep your cards safe and open it like an app.";

/* The browsers built into other apps. None of them can add anything to a
   home screen, so the only useful thing to say is to get out of them. */
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Twitter|Snapchat|musical_ly|TikTok|BytedanceWebview|Line\/|MicroMessenger|GSA\/|Pinterest/i;

/**
 * What the offer should say here, or null where this browser cannot install
 * a site at all and the offer is better left off.
 *
 * `canPrompt` is whether the browser has handed over its own installer
 * (Chrome, Edge and Samsung Internet do, when they judge the site ready).
 * With it the offer is one Install button and needs no directions.
 */
export function installHow({ ua, touch = 0 }: Agent, canPrompt = false): InstallHow | null {
  const ipad = /Macintosh/.test(ua) && touch > 1;
  const ios = /iPhone|iPad|iPod/.test(ua) || ipad;
  const android = /Android/.test(ua);

  if (ios) {
    if (IN_APP.test(ua)) {
      return { lead: LEAD_PHONE, steps: "Open this page in Safari first: this app's own browser cannot add it to your home screen." };
    }
    if (/CriOS/.test(ua)) {
      return { lead: LEAD_PHONE, steps: "Tap the Share button at the top right of the address bar, then “Add to Home Screen”." };
    }
    if (/FxiOS/.test(ua)) {
      return { lead: LEAD_PHONE, steps: "Tap the menu (☰), then Share, then “Add to Home Screen”." };
    }
    if (/EdgiOS/.test(ua)) {
      return { lead: LEAD_PHONE, steps: "Tap the menu (⋯) at the bottom, then Share, then “Add to Home Screen”." };
    }
    /* Safari, and anything else on iOS, which is Safari underneath. Newer
       versions tuck Share behind ⋯ beside the address. */
    return { lead: LEAD_PHONE, steps: "Tap the Share button (the square with an arrow, under ⋯ if you don't see it), then “Add to Home Screen”." };
  }

  if (android) {
    if (canPrompt) return { lead: LEAD_PHONE, steps: "" };
    if (IN_APP.test(ua) || /; wv\)/.test(ua)) {
      return { lead: LEAD_PHONE, steps: "Open this page in Chrome first: this app's own browser cannot add it to your home screen." };
    }
    if (/SamsungBrowser/.test(ua)) {
      return { lead: LEAD_PHONE, steps: "Tap the menu (☰) at the bottom, then “Add page to”, then “Home screen”." };
    }
    if (/Firefox/.test(ua)) {
      return { lead: LEAD_PHONE, steps: "Tap the menu (⋮), then “Add to Home screen”." };
    }
    if (/EdgA/.test(ua)) {
      return { lead: LEAD_PHONE, steps: "Tap the menu (⋯) at the bottom, then “Add to phone”." };
    }
    if (/OPR\//.test(ua)) {
      return { lead: LEAD_PHONE, steps: "Tap the menu (⋮), then “Add to”, then “Home screen”." };
    }
    /* Chrome, and the many browsers built on it that keep its menu. */
    return { lead: LEAD_PHONE, steps: "Tap the menu (⋮) at the top right, then “Add to Home screen”." };
  }

  /* A computer. */
  if (canPrompt) return { lead: LEAD_COMPUTER, steps: "" };
  if (/Firefox/.test(ua)) return null; // Firefox cannot install a site on a computer
  if (/Edg\//.test(ua)) {
    return { lead: LEAD_COMPUTER, steps: "Open the menu (⋯), then Apps, then “Install this site as an app”." };
  }
  if (/Chrome\//.test(ua)) {
    return { lead: LEAD_COMPUTER, steps: "Click the install icon at the right of the address bar, or open the menu (⋮), then “Cast, save and share”, then “Install page as app”." };
  }
  if (/Safari\//.test(ua) && /Macintosh/.test(ua)) {
    return { lead: "Add ManyTongues to your Dock to keep your cards safe and open it like an app.", steps: "Choose File in the menu bar, then “Add to Dock”." };
  }
  return { lead: LEAD_PHONE, steps: "Look in your browser's menu for “Add to Home screen” or “Install”." };
}
