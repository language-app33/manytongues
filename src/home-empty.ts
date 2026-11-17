/*
 * Why the home screen has nothing to offer, when it has nothing (0.639).
 *
 * The home screen used to ask whether the device held any card at all,
 * anywhere. A learner who had picked a space with nothing for them still
 * got every button, greyed out, a saved session from another space, and
 * a warning about exercise types written for a teacher. It now asks what
 * can be practised in the space on screen, and when the answer is
 * nothing, it says why in one line — the same Empty the Cards and
 * Progress tabs use.
 *
 * Kept apart from the screen so the order of the reasons can be tested on
 * plain numbers. The order is the order a learner can act on them: a
 * language switched off is one tap away, cards that are here but not
 * ready are the teacher's to finish, and no cards at all is either a
 * course to join or a course still being filled.
 */

export type HomeEmpty =
  /** This space's practisable cards are all in languages switched off. */
  | { kind: "langs"; langs: string[] }
  /** There are cards here, and none of them can be practised yet. */
  | { kind: "not-ready" }
  /** No cards here at all: `courses` is how many of this space's courses
      the learner is in, which decides between "join one" and "wait". */
  | { kind: "no-cards"; courses: number };

export function whyHomeIsEmpty({ practisable, offLangs, cardsHere, coursesHere }: {
  /** How many cards can be practised here, as Start session would deal them. */
  practisable: number;
  /** The switched-off languages that hold practisable cards in this space. */
  offLangs: string[];
  /** How many cards this space holds, practisable or not, in any language. */
  cardsHere: number;
  /** How many of this space's courses the learner is in. */
  coursesHere: number;
}): HomeEmpty | null {
  if (practisable > 0) return null;
  if (offLangs.length) return { kind: "langs", langs: offLangs };
  if (cardsHere > 0) return { kind: "not-ready" };
  return { kind: "no-cards", courses: coursesHere };
}

/**
 * The one line the home screen says, for every reason (0.641). Short, and
 * the same for "no cards yet" and "not ready yet": either way the student
 * is waiting on their teacher, and the reason is the teacher's business.
 * `langsOn` is how many of the student's languages are still switched on,
 * which is what "the selected language" counts.
 */
export function homeEmptySays(why: HomeEmpty, langsOn = 1): string {
  if (why.kind === "langs") {
    return `Nothing to practice in the selected ${langsOn === 1 ? "language" : "languages"}. Switch on a language to get started.`;
  }
  if (why.kind === "no-cards" && why.courses === 0) return "Join a course to get started!";
  return "Nothing to practice yet!";
}

/** "French", "French and Spanish", "Arabic, French and Spanish". */
export function listOf(names: string[]): string {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
