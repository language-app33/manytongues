/*
 * The theme this device last used, kept apart from the document (0.643).
 *
 * The theme is a setting, and settings are read from storage only once the
 * app has loaded. Until then the loading screen had no theme at all, which
 * is the dark one, and the page around it followed the device. So a light
 * device opening the app went light, dark, light: the flash on every
 * launch, and on every return the phone treated as a launch.
 *
 * A copy in localStorage can be read before anything renders, by
 * main.tsx for the page and by the loading screen for itself.
 */

const KEY = "arabic-trainer:theme";
const KNOWN = ["auto", "light", "dark"];

export function rememberedTheme(): string {
  try {
    const t = localStorage.getItem(KEY) || "";
    return KNOWN.includes(t) ? t : "auto";
  } catch (e) {
    return "auto";
  }
}

export function rememberTheme(theme: string) {
  try {
    if (KNOWN.includes(theme)) localStorage.setItem(KEY, theme);
  } catch (e) {
    /* Private browsing: the next launch follows the device, as before. */
  }
}

/** Pin the page's own background to it, before the first paint. */
export function applyRememberedTheme() {
  if (typeof document === "undefined") return;
  const t = rememberedTheme();
  document.documentElement.dataset.theme = t;
  document.documentElement.style.colorScheme = t === "auto" ? "light dark" : t;
}
