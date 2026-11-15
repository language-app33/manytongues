/*
 * Practice by skill: the map (stage C of docs/PLAN-skills-switches-no-english.md).
 *
 * Every word has three sides — how it is written, how it sounds, what it
 * means — and every exercise gives one side and asks for another. Three
 * things describe an exercise:
 *
 *   * its skill: what is given and what is asked for;
 *   * its step: recognise (choose from options) or produce (make the answer);
 *   * where the meaning is, when one is involved: English, a picture, the
 *     language itself, or figures.
 *
 * Pure data and the functions that read it. Nothing here decides how a card
 * climbs; the trainer's doors read it (see WORD_SKILLS_ON there).
 */

/** The five skills, by the names the code uses. */
export type Skill = "US" | "UH" | "WH" | "WM" | "SS";
export type Step = "recognise" | "produce";
export type MeaningIn = "english" | "picture" | "language" | "figures" | "none";

export interface SkillOf {
  skill: Skill;
  step: Step;
  meaning: MeaningIn;
  /** Practice only: never holds a card back or moves it on (R3, R6). */
  practiceOnly?: boolean;
  /** The pick-from-many proof of an "understand" skill (R5). */
  many?: boolean;
}

/** Skill names as a learner reads them. */
export const SKILL_NAME: Record<Skill, string> = {
  US: "Understand it when you see it",
  UH: "Understand it when you hear it",
  WH: "Write what you hear",
  WM: "Write what you mean",
  SS: "Say what you see",
};

/** The order the skills are listed in, and open in. */
export const SKILLS: Skill[] = ["US", "UH", "WH", "WM", "SS"];

const at = (skill: Skill, step: Step, meaning: MeaningIn, extra: Partial<SkillOf> = {}): SkillOf => ({
  skill,
  step,
  meaning,
  ...extra,
});

/**
 * The map: every exercise a word form can be asked, by its type. Types not
 * built yet are listed too, under the ids the plan suggests, so that adding
 * one is adding its definition and nothing here.
 */
export const WORD_SKILL_MAP: Record<string, SkillOf> = {
  /* Understand it when you see it: written → meaning. */
  ar2pick: at("US", "recognise", "english"),
  match: at("US", "recognise", "english"),
  ex2en: at("US", "recognise", "english"),
  ar2en: at("US", "produce", "english"),
  ar2img: at("US", "recognise", "picture"),
  imgmatch: at("US", "recognise", "picture"),
  ar2many: at("US", "recognise", "picture", { many: true }),
  ar2def: at("US", "recognise", "language"),
  oddone: at("US", "recognise", "language"),
  sort: at("US", "recognise", "language", { practiceOnly: true }),
  /* Understand it when you hear it: sound → meaning. */
  rec2en: at("UH", "produce", "english"),
  rec2img: at("UH", "recognise", "picture"),
  rec2many: at("UH", "recognise", "picture", { many: true }),
  rec2def: at("UH", "recognise", "language"),
  recfig: at("UH", "recognise", "figures"),
  recown: at("UH", "recognise", "figures"),
  /* Write what you hear: sound → written. */
  recmatch: at("WH", "recognise", "none"),
  rec2attr: at("WH", "recognise", "none"),
  tr2ar: at("WH", "produce", "none"),
  rec2ar: at("WH", "produce", "none"),
  rec2ctx: at("WH", "produce", "none"),
  /* Write what you mean: meaning → written. */
  en2pick: at("WM", "recognise", "english"),
  en2ar: at("WM", "produce", "english"),
  img2pick: at("WM", "recognise", "picture"),
  img2ar: at("WM", "produce", "picture"),
  ctx2pick: at("WM", "recognise", "language"),
  ctx2ar: at("WM", "produce", "language"),
  def2pick: at("WM", "recognise", "language"),
  def2ar: at("WM", "produce", "language"),
  own2ar: at("WM", "produce", "figures"),
  /* Say what you see: written → sound. */
  say: at("SS", "produce", "none", { practiceOnly: true }),
};

/**
 * Every other exercise this release has, named so that a new one cannot be
 * forgotten: a form that supports any of these stays on the four levels
 * (S3). Verb drills, conversations and their lines, sentences of a scene,
 * and number and time ranges.
 */
export const NOT_A_WORD_SKILL: string[] = [
  "vpattern", "vread", "vwho", "vwhorec", "vrow", "vshift",
  "dlgwhole", "dlgpick", "dlgorder", "gap2pick", "gap2ar", "sen2en", "en2sen",
  "num2fig", "fig2pick", "rec2fig", "fig2own", "ar2own", "fig2num", "own2num", "count2phrase",
  "time2fig", "time2dial", "rec2dial", "clock2own", "time2own", "fig2time", "own2time", "clock2time",
  "dig2fig", "fig2dig",
  "senbuild",
];

export const skillOf = (type: string): SkillOf | null => WORD_SKILL_MAP[type] || null;

/** Whether every one of these types is in the map. */
export const allMapped = (types: string[]): boolean => types.every((t) => !!WORD_SKILL_MAP[t]);

/** The types of one skill among these, in the order given. */
export const ofSkill = (types: string[], skill: Skill): string[] =>
  types.filter((t) => WORD_SKILL_MAP[t] && WORD_SKILL_MAP[t].skill === skill);

/** Recognise exercises that can pass a step: four choices or more, not practice only (R3). */
export const counts = (type: string): boolean => {
  const s = WORD_SKILL_MAP[type];
  return !!s && !s.practiceOnly;
};
