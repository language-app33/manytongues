/*
 * The card on Home under the progress ring (0.664): a shape drawn in the
 * logo's own style, a fact about a dialect or a regional language, and the
 * fact's source a tap away.
 *
 * Why it is there. The home screen had a lot of open space once Weak spots
 * and Build a session moved to Focused training (0.650), and the owner
 * wanted it to be more engaging without being one more readout of the
 * learner's own numbers. A fact about how language varies is a small
 * reason to look, and it changes after every finished session, each time
 * the app is opened (0.674) and on coming back to it after half an hour
 * or more (0.675), so there is something new each time a learner comes
 * back.
 *
 * The facts are the ones the owner approved on the review page, each
 * checked against the source it names (November 2026). The shapes are
 * twenty variations on the logo: hand-drawn loops at one line weight, the
 * small dot, and the speech bubble from the empty home screen. Shapes and
 * facts rotate separately (the owner's 2a), so a fact meets a different
 * shape each time round.
 *
 * Plain data and plain functions, so the tests can read them without a
 * build step. The drawing is in HomeCard in ArabicTrainer.tsx.
 */

export type HomeFact = {
  /** Stable, so the card can be pointed at in a report. */
  id: string;
  /** What the fact is about: "Italy". Not shown since 0.665 (the card's
      title came off), kept so a fact can be found and named in a report. */
  about: string;
  /** The fact itself: one or two sentences, about 110 characters at most. */
  text: string;
  /** Where it comes from, opened in the browser from the card. */
  source: string;
  sourceName: string;
};

/* Approved on the review page; each checked against its source. */
export const HOME_FACTS: HomeFact[] = [
  { id: "f2", about: "Italy", text: "By one estimate, only 2.5% of Italians spoke standard Italian when Italy unified in 1861.",
    source: "https://en.wikipedia.org/wiki/Italian_language", sourceName: "Wikipedia: Italian language" },
  { id: "f4", about: "Papua New Guinea", text: "Papua New Guinea has over 800 languages, more than any other country.",
    source: "https://www.ethnologue.com/insights/countries-most-languages/", sourceName: "Ethnologue" },
  { id: "f6", about: "Switzerland", text: "German-speaking Swiss talk in their own dialects every day, but mostly write in Standard German.",
    source: "https://en.wikipedia.org/wiki/Swiss_German", sourceName: "Wikipedia: Swiss German" },
  { id: "f7", about: "Palestinian Arabic", text: "In Palestinian towns, qaf is often a glottal stop. In villages it can be a k, and among Bedouin a g.",
    source: "https://en.wikipedia.org/wiki/Palestinian_Arabic", sourceName: "Wikipedia: Palestinian Arabic" },
  { id: "f10", about: "Chinese", text: "Mandarin and Cantonese speakers often can't understand each other but share one standard written Chinese.",
    source: "https://en.wikipedia.org/wiki/Written_vernacular_Chinese", sourceName: "Wikipedia: Written vernacular Chinese" },
  { id: "f11", about: "Basque", text: "Basque is a language isolate: no link to any other living language has ever been established.",
    source: "https://en.wikipedia.org/wiki/Basque_language", sourceName: "Wikipedia: Basque language" },
  { id: "f12", about: "Maltese", text: "Maltese grew out of Arabic but is written in the Latin alphabet. It's the EU's only Semitic official language.",
    source: "https://en.wikipedia.org/wiki/Maltese_language", sourceName: "Wikipedia: Maltese language" },
  { id: "f15", about: "Andorra", text: "Andorra is the only country where Catalan is the sole official language.",
    source: "https://en.wikipedia.org/wiki/Languages_of_Andorra", sourceName: "Wikipedia: Languages of Andorra" },
  { id: "f18", about: "Okinawa", text: "The Ryukyuan languages of southern Japan are related to Japanese, but Japanese speakers can't understand them.",
    source: "https://en.wikipedia.org/wiki/Ryukyuan_languages", sourceName: "Wikipedia: Ryukyuan languages" },
  { id: "f19", about: "Hindi and Urdu", text: "Everyday Hindi and Urdu are close enough to understand each other, but are written in different scripts.",
    source: "https://www.britannica.com/topic/Hindustani-language", sourceName: "Britannica" },
  { id: "f20", about: "Yiddish", text: "“A language is a dialect with an army and navy” was made famous by the Yiddish linguist Max Weinreich.",
    source: "https://en.wikipedia.org/wiki/A_language_is_a_dialect_with_an_army_and_navy", sourceName: "Wikipedia" },
  { id: "f28", about: "Wales", text: "Wales aims to have a million people speaking Welsh by 2050.",
    source: "https://www.gov.wales/ambitious-plans-almost-double-number-welsh-speakers-launched", sourceName: "Welsh Government" },
  { id: "f37", about: "Egyptian Arabic", text: "Egyptian Arabic is widely understood across the Arab world, largely thanks to Egyptian films and TV.",
    source: "https://en.wikipedia.org/wiki/Egyptian_Arabic", sourceName: "Wikipedia: Egyptian Arabic" },
  { id: "f41", about: "Sardinian", text: "Many linguists consider Sardinian one of the Romance languages closest to Latin.",
    source: "https://www.britannica.com/topic/Sardinian-language", sourceName: "Britannica: Sardinian language" },
  { id: "f43", about: "Nigeria", text: "Nigeria has over 500 languages and Nigerian Pidgin is widely used as a shared language between their speakers.",
    source: "https://en.wikipedia.org/wiki/Languages_of_Nigeria", sourceName: "Wikipedia: Languages of Nigeria" },
  { id: "f49", about: "Gullah", text: "Gullah, spoken on the US Sea Islands, is an English-based creole with strong West African influence.",
    source: "https://www.britannica.com/topic/Gullah", sourceName: "Britannica: Gullah" },
  { id: "f51", about: "Arabic dialects", text: "To ask \"what?\", Arabic speakers often say \"shu\" in the Levant, \"eh\" in Egypt, and and \"shnu\" in Morocco.",
    source: "https://www.middleeasteye.net/discover/five-major-spoken-arabic-dialects-unique", sourceName: "Middle East Eye" },
  { id: "f53", about: "South Sudan", text: "Juba Arabic is an Arabic-based pidgin or creole widely spoken in South Sudan.",
    source: "https://en.wikipedia.org/wiki/Juba_Arabic", sourceName: "Wikipedia: Juba Arabic" },
  { id: "f54", about: "Arabic script", text: "The Arabic alphabet is also used to write Persian, Urdu and Pashto.",
    source: "https://www.britannica.com/topic/Arabic-alphabet", sourceName: "Britannica: Arabic alphabet" },
  { id: "f55", about: "Arabizi", text: "Arabic speakers often type in Latin letters, using numbers like 3 and 7 for ع and ح. It's called Arabizi.",
    source: "https://en.wikipedia.org/wiki/Arabic_chat_alphabet", sourceName: "Wikipedia: Arabic chat alphabet" },
  { id: "f56", about: "Huế, Vietnam", text: "Central Vietnamese accents, such as Huế's, are often said to be the hardest for other Vietnamese to follow.",
    source: "https://vietcetera.com/en/from-north-centre-to-south-exploring-vietnams-linguistic-diversity", sourceName: "Vietcetera" },
  { id: "f59", about: "Ladino", text: "Ladino, or Judaeo-Spanish, grew from the Spanish of Jews expelled from Spain in 1492.",
    source: "https://www.britannica.com/topic/Ladino-language", sourceName: "Britannica: Ladino" },
  { id: "f66", about: "Switzerland", text: "Romansh is Switzerland's fourth national language, spoken by under 1% of the population.",
    source: "https://www.aboutswitzerland.eda.admin.ch/en/allegra-a-look-at-romansh-switzerlands-fourth-language", sourceName: "Swiss government" },
  { id: "f68", about: "Corsica", text: "Corsican, spoken on the French island of Corsica, is closer to Tuscan Italian than to French.",
    source: "https://en.wikipedia.org/wiki/Corsican_language", sourceName: "Wikipedia: Corsican" },
  { id: "f74", about: "Brittany", text: "Breton, spoken in Brittany in France, is a Celtic language related to Welsh and Cornish.",
    source: "https://www.britannica.com/topic/Breton-language", sourceName: "Britannica: Breton" },
  { id: "f84", about: "Swahili", text: "Swahili has borrowed many words from Arabic through centuries of trade.",
    source: "https://www.britannica.com/topic/Swahili-language", sourceName: "Britannica: Swahili" },
  { id: "f85", about: "Andes", text: "Quechua is spoken by millions in the Andes and is an official language in Peru and Bolivia.",
    source: "https://www.britannica.com/topic/Quechua", sourceName: "Britannica: Quechua" },
  { id: "f88", about: "ABC islands", text: "Papiamento, spoken in Aruba, Curaçao and Bonaire, mixes Portuguese, Spanish and Dutch roots.",
    source: "https://en.wikipedia.org/wiki/Papiamento", sourceName: "Wikipedia: Papiamento" },
  { id: "f93", about: "Sign languages", text: "Sign languages have dialects too: Black ASL grew in segregated schools in the American South.",
    source: "https://en.wikipedia.org/wiki/Black_American_Sign_Language", sourceName: "Wikipedia: Black ASL" },
  { id: "f94", about: "Nüshu", text: "Nüshu is a script that was used among women in Jiangyong County, Hunan, China.",
    source: "https://en.wikipedia.org/wiki/N%C3%BCshu", sourceName: "Wikipedia: Nüshu" },
  { id: "f95", about: "World languages", text: "Of the world's roughly 7,000 languages, only about 4,000 have a developed writing system.",
    source: "https://www.ethnologue.com/faq/how-many-languages-unwritten", sourceName: "Ethnologue" },
  { id: "f100", about: "Yiddish", text: "Yiddish mixes German roots with Hebrew, Aramaic and Slavic words.",
    source: "https://www.britannica.com/topic/Yiddish-language", sourceName: "Britannica: Yiddish" },
  { id: "f102", about: "Levant", text: "In Levantine Arabic, \"biddi\" means \"I want\". It grew from an older phrase meaning \"in my wish\".",
    source: "https://en.wiktionary.org/wiki/%D8%A8%D8%AF", sourceName: "Wiktionary: بد" },
  { id: "f110", about: "Arab world", text: "Arabic-speaking children grow up speaking a dialect but learn to read and write in Standard Arabic.",
    source: "https://www.frontiersin.org/articles/10.3389/fpsyg.2018.00356/full", sourceName: "Frontiers in Psychology (2018)" },
  { id: "f111", about: "Middle East", text: "Maimonides wrote his Guide for the Perplexed in Judeo-Arabic: Arabic written in Hebrew letters.",
    source: "https://en.wikipedia.org/wiki/The_Guide_for_the_Perplexed", sourceName: "Wikipedia: The Guide for the Perplexed" },
  { id: "f112", about: "Caucasus", text: "Juhuri, spoken by the Mountain Jews of the Caucasus, is a Persian-related language rich in Hebrew words.",
    source: "https://www.jewishlanguages.org/judeo-tat-juhuri", sourceName: "Jewish Language Project: Juhuri" },
  { id: "f131", about: "Maldives", text: "The first nine letters of Thaana, the Maldives' script, were made from Arabic numerals.",
    source: "https://en.wikipedia.org/wiki/Thaana", sourceName: "Wikipedia: Thaana" },
  { id: "f132", about: "Thailand", text: "Isan, the everyday speech of northeast Thailand, is very close to the Lao spoken across the Mekong in Laos.",
    source: "https://en.wikipedia.org/wiki/Isan_language", sourceName: "Wikipedia: Isan language" },
  { id: "f147", about: "Kenya", text: "Sheng, born in Nairobi's poorer districts, mixes Swahili grammar with English and other words.",
    source: "https://en.wikipedia.org/wiki/Sheng_slang", sourceName: "Wikipedia: Sheng slang" },
  { id: "f148", about: "West Africa", text: "Across West Africa, Hausa, Wolof, Fula and others are written in Arabic letters, called the Ajami script.",
    source: "https://en.wikipedia.org/wiki/Ajami_script", sourceName: "Wikipedia: Ajami script" },
  { id: "f150", about: "Senegal", text: "Only about 40% of Senegalese are native Wolof speakers, but most people in Senegal speak it.",
    source: "https://en.wikipedia.org/wiki/Wolof_language", sourceName: "Wikipedia: Wolof language" },
  { id: "f156", about: "Massachusetts", text: "Wampanoag went unspoken in Massachusetts for over a century. Since 1993 it has been revived from old records.",
    source: "https://www.pbs.org/newshour/show/we-still-live-here-details-effort-to-restore-wampanoag-language", sourceName: "PBS NewsHour: Wampanoag revival" },
  { id: "f165", about: "Nicaragua", text: "In 1980s Nicaragua, deaf children at new schools created their own language, Nicaraguan Sign Language.",
    source: "https://en.wikipedia.org/wiki/Nicaraguan_Sign_Language", sourceName: "Wikipedia: Nicaraguan Sign Language" },
  { id: "f166", about: "United States", text: "American Sign Language is closer to French Sign Language than to British Sign Language.",
    source: "https://www.nidcd.nih.gov/health/american-sign-language", sourceName: "US National Institute on Deafness" },
  { id: "f168", about: "Hawaii", text: "The Hawaiian alphabet has just 13 letters: five vowels and eight consonants, including the ʻokina.",
    source: "https://en.wikipedia.org/wiki/Hawaiian_alphabet", sourceName: "Wikipedia: Hawaiian alphabet" },
  { id: "f169", about: "Queensland", text: "Guugu Yimithirr speakers in Australia use north, south, east and west where English says left or right.",
    source: "https://en.wikipedia.org/wiki/Guugu_Yimithirr_language", sourceName: "Wikipedia: Guugu Yimithirr language" },
  { id: "f174", about: "Queensland", text: "Dyirbal speakers once switched to a special \"mother-in-law\" vocabulary in front of certain relatives.",
    source: "https://en.wikipedia.org/wiki/Dyirbal_language", sourceName: "Wikipedia: Dyirbal language" },
  { id: "f175", about: "Cherokee Nation", text: "Sequoyah finished a writing system for Cherokee in 1821, and within years many Cherokee could read it.",
    source: "https://education.nationalgeographic.org/resource/sequoyah-and-creation-cherokee-syllabary/", sourceName: "National Geographic" },
  { id: "f176", about: "Mexico", text: "English got \"tomato\", \"avocado\", \"chili\" and \"chocolate\" from Nahuatl, the Aztecs' language, via Spanish.",
    source: "https://www.merriam-webster.com/wordplay/words-from-nahuatl-the-language-of-the-aztecs", sourceName: "Merriam-Webster: Words from Nahuatl" },
  { id: "f181", about: "Buenos Aires", text: "Buenos Aires slang called vesre swaps syllables: \"café\" becomes \"feca\" and \"pagar\" (pay) becomes \"garpar\".",
    source: "https://en.wikipedia.org/wiki/Vesre", sourceName: "Wikipedia: Vesre" },
  { id: "f194", about: "Australia", text: "Australians love shortening words: \"arvo\" is afternoon, \"servo\" a petrol station and \"brekkie\" breakfast.",
    source: "https://lens.monash.edu/@politics-society/2023/02/17/1385377/brekkies-barbies-mozzies-why-do-aussies-shorten-so-many-words", sourceName: "Monash Lens" },
  { id: "f197", about: "Britain", text: "Polari, a slang once used by gay men in Britain, has many Italian-based words, like \"bona\" (good).",
    source: "https://wp.lancs.ac.uk/fabulosa/whats-polari/", sourceName: "Lancaster University: What's Polari?" },
  { id: "f200", about: "Scandinavia", text: "Danes, Norwegians and Swedes often talk in their own languages and can usually follow each other.",
    source: "https://www.let.rug.nl/gooskens/pdf/publ_speechcom_2010.pdf", sourceName: "Gooskens et al., Speech Communication 2010" },
];

/* ------------------------------------------------------------------
   The shapes. Each is a list of marks: a stroked line in one of the
   logo's colours, or the logo's small dot. Colours are names, not
   values, so the card can give the lavender and the dot the shade that
   shows on the theme it is drawn on. All of them are drawn on a 240 by
   150 box.
   ------------------------------------------------------------------ */

export type ShapeColour = "yellow" | "coral" | "mint" | "lavender";
export type Mark =
  | { kind: "line"; d: string; colour: ShapeColour; width: number; transform?: string }
  | { kind: "dot"; x: number; y: number; r: number; transform?: string };

const W = 7;

/* A repeatable wobble, so the same shape is drawn the same every time. */
function wobble(seed: number): () => number {
  let s = (seed * 7919 + 104729) % 233280;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

/* Points round a slightly irregular ellipse. */
function points(cx: number, cy: number, rx: number, ry: number, seed: number): [number, number][] {
  const r = wobble(seed), out: [number, number][] = [];
  for (let k = 0; k < 6; k++) {
    const a = (2 * Math.PI * k) / 6 + (r() - 0.5) * 0.35, f = 1 + (r() - 0.5) * 0.26;
    out.push([cx + rx * f * Math.cos(a), cy + ry * f * Math.sin(a)]);
  }
  return out;
}

const n1 = (v: number) => v.toFixed(1);

/* A smooth closed curve through the points. */
function smooth(p: [number, number][]): string {
  const n = p.length;
  let d = `M${n1(p[0][0])} ${n1(p[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    d += `C${n1(p1[0] + (p2[0] - p0[0]) / 6)} ${n1(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${n1(p2[0] - (p3[0] - p1[0]) / 6)} ${n1(p2[1] - (p3[1] - p1[1]) / 6)} ${n1(p2[0])} ${n1(p2[1])}`;
  }
  return d + "Z";
}

const loop = (cx: number, cy: number, rx: number, ry: number, colour: ShapeColour, seed: number, rot = 0): Mark =>
  ({ kind: "line", d: smooth(points(cx, cy, rx, ry, seed)), colour, width: W, transform: rot ? `rotate(${rot} ${cx} ${cy})` : undefined });

const dot = (x: number, y: number, r = 5): Mark => ({ kind: "dot", x, y, r });

/* A speech bubble: the same loop, opened at angle `a` (degrees, 90 is
   straight down) and drawn on out to a tail, as one continuous line. */
function bubble(cx: number, cy: number, rx: number, ry: number, colour: ShapeColour, seed: number, a: number): Mark {
  const p = points(cx, cy, rx, ry, seed), n = p.length, line: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    for (let k = 0; k < 24; k++) {
      const t = k / 24, u = 1 - t;
      line.push([
        u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0],
        u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1],
      ]);
    }
  }
  const t0 = (a * Math.PI) / 180, gap = 0.2;
  const off = ([x, y]: [number, number]) => {
    let d = Math.atan2((y - cy) / ry, (x - cx) / rx) - t0;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  };
  /* Start just after the opening, so the tail closes it. */
  let start = line.findIndex((q, i) => off(q) > gap && off(line[(i - 1 + line.length) % line.length]) <= gap);
  if (start < 0) start = 0;
  const ring = line.slice(start).concat(line.slice(0, start)).filter((q) => Math.abs(off(q)) > gap);
  const tip = [cx + rx * 1.42 * Math.cos(t0 + 0.32), cy + ry * 1.42 * Math.sin(t0 + 0.32)];
  return { kind: "line", colour, width: W,
    d: "M" + ring.map((q) => `${n1(q[0])} ${n1(q[1])}`).join("L") + `L${n1(tip[0])} ${n1(tip[1])}Z` };
}

/* The logo's own four loops, as public/logo.svg draws them, scaled to sit
   in the middle of the box. */
const LOGO_AT = "translate(48 9) scale(.72)";
const LOGO: Mark[] = [
  { kind: "line", colour: "yellow", width: 9.7, transform: LOGO_AT, d: "M60 40C100 10 150 30 150 70C150 110 110 130 80 120C40 108 30 70 60 40Z" },
  { kind: "line", colour: "coral", width: 9.7, transform: LOGO_AT, d: "M90 70C130 50 182 80 172 122C162 162 110 177 85 150C60 128 60 88 90 70Z" },
  { kind: "line", colour: "mint", width: 9.7, transform: LOGO_AT, d: "M40 100C60 70 112 90 116 126C120 162 80 186 50 166C20 146 22 120 40 100Z" },
  { kind: "line", colour: "lavender", width: 9.7, transform: LOGO_AT, d: "M72 18C96 0 128 14 122 46C116 72 90 76 72 60C54 46 50 34 72 18Z" },
  { kind: "dot", x: 98, y: 96, r: 8, transform: LOGO_AT },
];

/* A loose spiral, for the one shape that is a curl rather than a loop. */
function curl(): Mark {
  const r = wobble(45);
  let d = "";
  for (let th = 0.4; th <= 3.4 * Math.PI; th += 0.22) {
    const k = (5 + 6.2 * th) * (1 + (r() - 0.5) * 0.08);
    d += (d ? "L" : "M") + `${n1(118 + k * 1.25 * Math.cos(th))} ${n1(76 + k * Math.sin(th))}`;
  }
  return { kind: "line", d, colour: "yellow", width: W };
}

export type HomeShape = { name: string; marks: Mark[] };

export const HOME_SHAPES: HomeShape[] = [
  { name: "The logo's loops", marks: LOGO },
  { name: "Two loops meeting", marks: [loop(98, 75, 44, 38, "yellow", 2, -10), loop(146, 78, 42, 36, "coral", 3, 15), dot(122, 77)] },
  { name: "A chain of three", marks: [loop(72, 80, 34, 30, "mint", 4), loop(120, 70, 34, 32, "yellow", 5), loop(168, 80, 34, 30, "coral", 6), dot(120, 70, 4.5)] },
  { name: "A loop within a loop", marks: [loop(120, 75, 62, 52, "lavender", 7), loop(134, 84, 24, 20, "coral", 8), dot(102, 62)] },
  { name: "A bubble, typing", marks: [bubble(120, 68, 60, 42, "mint", 9, 122), dot(102, 68), dot(120, 68), dot(138, 68)] },
  { name: "Two bubbles talking", marks: [bubble(90, 58, 46, 32, "yellow", 10, 118), bubble(150, 94, 46, 32, "coral", 11, 62)] },
  { name: "A constellation", marks: [loop(52, 50, 17, 15, "yellow", 12), loop(96, 104, 21, 18, "mint", 13), loop(142, 46, 19, 16, "coral", 14),
    loop(186, 98, 23, 19, "lavender", 15), loop(206, 38, 11, 10, "yellow", 16), dot(122, 78, 4), dot(62, 122, 3), dot(172, 30, 3)] },
  { name: "A rising chain", marks: [loop(58, 110, 27, 22, "mint", 17), loop(98, 90, 27, 22, "yellow", 18), loop(138, 68, 27, 22, "coral", 19),
    loop(178, 46, 27, 22, "lavender", 20), dot(178, 46, 4.5)] },
  { name: "Ripples", marks: [loop(120, 75, 66, 52, "lavender", 21), loop(120, 76, 44, 34, "mint", 22), loop(121, 77, 21, 16, "yellow", 23), dot(121, 77, 4)] },
  { name: "A bubble and a loop", marks: [bubble(102, 70, 50, 40, "coral", 24, 124), loop(152, 86, 36, 32, "mint", 25), dot(152, 86)] },
  { name: "Islands", marks: [loop(58, 84, 32, 23, "mint", 26, -8), loop(110, 56, 27, 20, "yellow", 27), loop(150, 98, 35, 24, "lavender", 28, 6),
    loop(196, 60, 23, 18, "coral", 29), dot(110, 56, 4.5)] },
  { name: "An orbit", marks: [loop(120, 78, 46, 40, "yellow", 30), loop(64, 44, 17, 14, "mint", 31), loop(182, 114, 19, 15, "lavender", 32),
    loop(190, 38, 11, 9, "coral", 33), dot(120, 78)] },
  { name: "A stack", marks: [loop(120, 40, 32, 21, "coral", 34), loop(115, 75, 36, 23, "yellow", 35), loop(123, 110, 32, 21, "mint", 36), dot(115, 75, 4.5)] },
  { name: "Two links", marks: [loop(98, 75, 48, 30, "lavender", 37, -25), loop(142, 75, 48, 30, "mint", 38, 25), dot(120, 75)] },
  { name: "A chorus", marks: [bubble(60, 66, 30, 23, "yellow", 40, 115), bubble(120, 86, 30, 23, "lavender", 41, 70), bubble(180, 62, 30, 23, "coral", 42, 65), dot(120, 86, 4.5)] },
  { name: "A curl", marks: [curl(), dot(118, 76), loop(198, 36, 13, 11, "coral", 46)] },
  { name: "A conversation", marks: [bubble(96, 40, 42, 23, "yellow", 47, 118), bubble(146, 76, 42, 23, "mint", 48, 62), bubble(98, 112, 38, 21, "coral", 49, 118)] },
  { name: "A crossing", marks: [loop(120, 75, 72, 26, "coral", 50), loop(120, 75, 27, 58, "mint", 51), dot(120, 75)] },
  { name: "Four together", marks: [loop(98, 56, 31, 26, "yellow", 52), loop(142, 56, 31, 26, "coral", 53), loop(98, 96, 31, 26, "mint", 54),
    loop(142, 96, 31, 26, "lavender", 55), dot(120, 76)] },
  { name: "Two meeting", marks: [loop(86, 75, 36, 31, "yellow", 56), dot(86, 75), loop(154, 75, 36, 31, "coral", 57), dot(154, 75)] },
];

/* ------------------------------------------------------------------
   Which card shows. One count per device, moved on by each finished
   session, each time the app is opened (0.674) and on coming back to it
   after half an hour or more (0.675); the shape and the fact are read off
   it separately, so the twenty shapes and the facts
   drift past each other.
   ------------------------------------------------------------------ */

export function homeCardAt(turn: number): { shape: HomeShape; fact: HomeFact } {
  const k = Math.max(0, Math.floor(turn) || 0);
  return { shape: HOME_SHAPES[k % HOME_SHAPES.length], fact: HOME_FACTS[k % HOME_FACTS.length] };
}

/* ------------------------------------------------------------------
   The small line inside the Practice button: what pressing it deals,
   in a few words. The longer line that sat above the button (homeLine)
   said the same at more length; the button carries it now.
   ------------------------------------------------------------------ */

export function practiceLine({ review, climbing, fresh, behind }: {
  review: number; climbing: number; fresh: number; behind: boolean;
}): string {
  const parts: string[] = [];
  if (review) parts.push(`${review} to review`);
  if (climbing) parts.push(`${climbing} in progress`);
  if (fresh) parts.push(`${fresh} new`);
  else if (behind && (review || climbing)) parts.push("new cards wait");
  return parts.length ? parts.join(" · ") : "All caught up";
}

/* ------------------------------------------------------------------
   Before the facts (0.666). A student who has not started, or is on
   their first day, gets a welcome on the card instead of a fact, under
   the logo's own loops. The facts arrive from the second day they
   practise (the owner's 1b): coming back is the clearest sign someone
   has really started, and the facts are a small reward for it.

   Read off the practice log, which counts questions answered by day and
   syncs, so it follows the student across their devices. "Learning" is
   any day of practice other than today: a student who practised
   yesterday sees facts this morning before practising again, since
   "come back tomorrow" would be wrong by then.
   ------------------------------------------------------------------ */

export type HomeStage = "new" | "first" | "learning";

export function homeStage(log: Record<string, unknown> | undefined, today: string): HomeStage {
  const days = Object.entries(log || {}).filter(([, n]) => Number(n) > 0).map(([d]) => d);
  if (!days.length) return "new";
  return days.some((d) => d !== today) ? "learning" : "first";
}

/* The owner's wording (3a), with "cards", never "words". */
export const HOME_WELCOME: Record<Exclude<HomeStage, "learning">, string> = {
  new: "Welcome! Your first session takes just a few minutes.",
  first: "Great start! Come back tomorrow and your cards will begin to stick.",
};
