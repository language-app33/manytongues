import type { Module } from "./types.ts";
/*
 * Which of a learner's decks a number system is filed into (0.541).
 *
 * A deck in the system's language, and only the deck that names this
 * system as its source. A deck sent without the field at all came from a
 * server older than the choice, and takes every system in its language as
 * it always did; null means the deck has no numbers to give.
 */
export function modulesForSystem<D extends Module & { courseLanguage?: string }>(
  modules: D[],
  languageId: string,
  systemId: string,
): D[] {
  return modules.filter(
    (d) =>
      (d.lang || d.courseLanguage) === languageId &&
      (d.numbersSystemId === undefined || d.numbersSystemId === systemId),
  );
}
