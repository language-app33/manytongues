/*
 * What a module is called on screen.
 *
 * A module is anything a teacher hands a course to learn from: a deck, a
 * unit on the course's path, or a personal set (0.672). "Module" is the
 * word for any of them — a tab, a list, a card's "which modules is it in".
 * Where the screen is about one module, it says which kind it is, so a
 * teacher looking at a unit reads "Delete unit", not "Delete module".
 * Imports nothing.
 */

export type ModuleKind = "deck" | "unit" | "personal set";

/** Which kind a module is, in the words the screen uses for it. */
export function moduleKind(m: { unit?: unknown; set?: unknown } | null | undefined): ModuleKind {
  if (m && m.unit === true) return "unit";
  if (m && m.set) return "personal set";
  return "deck";
}

/** The same, with a capital, to start a label or a sentence. */
export function moduleKindCap(m: { unit?: unknown; set?: unknown } | null | undefined): string {
  const k = moduleKind(m);
  return k.charAt(0).toUpperCase() + k.slice(1);
}
