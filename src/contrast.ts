/*
 * Whether a space's colour can be used as the app's accent (0.543).
 *
 * A space's colour is shown only on its own sign-in page, as the accent the
 * app already uses for highlights and borders. A faint colour there would
 * make those hard to see, so a colour is used only if it stands out from
 * the page in both the light and the dark theme: at least 3:1, the WCAG
 * figure for things that aren't text. Otherwise the app's own accent stays.
 * Pure, so the Spaces tab and the sign-in page give the same answer.
 */

/** The page backgrounds, as `--bg` sets them in src/index.css. */
export const PAGE_LIGHT = "#f4f6fa";
export const PAGE_DARK = "#141a2a";
export const MIN_CONTRAST = 3;

/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return NaN;
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** The contrast ratio between two #rrggbb colours, 1 to 21. NaN if either isn't one. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Whether `hex` stands out enough from both page backgrounds to be an accent. */
export function usableAccent(hex: string): boolean {
  return contrastRatio(hex, PAGE_LIGHT) >= MIN_CONTRAST && contrastRatio(hex, PAGE_DARK) >= MIN_CONTRAST;
}
