// How language itself works, how to learn one, and the common myths.

export function howLanguageWorks(): string {
  return [
    `HOW LANGUAGE WORKS — the machinery under every human language`,
    ``,
    `▸ SOUNDS (phonetics/phonology): every language picks a small set of sounds from the huge range humans can make. Which ones, and which differences 'count', is why an accent is hard — your ear was trained on your first language's set.`,
    `▸ WORDS (morphology): words are built from pieces (morphemes) — 'un-break-able'. Some languages pack a whole sentence into one long word; others keep pieces separate.`,
    `▸ ORDER (syntax): the rules for arranging words. English is Subject-Verb-Object ('I eat rice'); Japanese is Subject-Object-Verb ('I rice eat'); both are perfectly logical.`,
    `▸ MEANING (semantics) & USE (pragmatics): what words mean, and what they mean in context — 'can you pass the salt?' isn't really a yes/no question.`,
    `▸ WRITING SYSTEMS: alphabets (letters = sounds, like English), abjads (mostly consonants, like Arabic/Hebrew), syllabaries (symbol = syllable, like Japanese kana), and logographies (symbol = word/idea, like Chinese characters).`,
    `▸ CHANGE: languages are always drifting — sounds shift, grammar simplifies, words are borrowed. Latin didn't 'die'; it turned into Spanish, French, Italian, and the rest.`,
    ``,
    `The big idea: there is no 'primitive' or 'advanced' language. Every human language is a complete, rule-governed system fully capable of expressing anything its speakers need.`,
  ].join("\n");
}

export function learnLanguage(): string {
  return [
    `HOW TO ACTUALLY LEARN A LANGUAGE — what the science says works`,
    `BOTTOM LINE: language is a skill you build with frequent, meaningful use — not a subject you memorize. Input + reps + speaking, over time.`,
    ``,
    `  1. COMPREHENSIBLE INPUT — flood yourself with the language at a level you MOSTLY understand (shows, graded readers, podcasts). Understanding real messages is how the brain acquires grammar without drilling rules.`,
    `  2. HIGH-FREQUENCY WORDS FIRST — the top ~1,000 words cover most everyday speech. Learn those before rare vocabulary.`,
    `  3. SPACED REPETITION — review words/phrases across increasing intervals (flashcard apps do this). Beats cramming, which fades in days.`,
    `  4. SPEAK EARLY AND BADLY — output forces recall and exposes gaps. Waiting until you're 'ready' just delays fluency.`,
    `  5. LITTLE AND OFTEN — 20 minutes daily crushes 3 hours once a week. Languages need frequency, not marathons.`,
    `  6. IMMERSE CHEAPLY — change your phone's language, follow creators, label your house. Make the language unavoidable.`,
    ``,
    `Honest timeline: for an English speaker, 'easier' languages (Spanish, French) take roughly 600-750 class hours to reach working fluency; 'harder' ones (Mandarin, Arabic, Japanese) roughly 2,200 — because they share less with English, not because they're 'harder' in any absolute sense.`,
  ].join("\n");
}

export function linguisticsMyths(): string {
  const myths = [
    ["'Some languages are primitive or simpler than others.'", "False. Every language is a complete system. 'Simple-looking' ones often hide huge complexity elsewhere (tone, or a rich case/verb system). No human language is more 'evolved' than another."],
    ["'Eskimos have 100 words for snow.'", "A distortion. Inuit languages build long words from pieces, so 'snow' compounds pile up — but English has plenty too (sleet, slush, blizzard, powder). It doesn't reveal some special snow-consciousness."],
    ["'You can't learn a language as an adult.'", "False. Adults learn languages routinely — often FASTER at grammar and vocabulary than kids. Kids mostly win on ACCENT and having years of pressure-free input, not on some closing brain-window."],
    ["'Bilingualism confuses children / delays speech.'", "False. Bilingual kids hit language milestones on time and gain real cognitive flexibility. Mixing languages ('code-switching') is a skill, not confusion."],
    ["'There's a single correct, proper version of a language.'", "A social judgment, not a linguistic fact. 'Standard' dialects are the ones with power/prestige — dialects and accents follow their own consistent rules and aren't 'wrong'."],
  ];
  return [
    `LANGUAGE MYTHS vs REALITY`,
    ``,
    ...myths.map(([m, r]) => `▸ MYTH: ${m}\n   REALITY: ${r}`),
    ``,
    `The linguist's stance: describe how people ACTUALLY speak, don't rank languages or dialects. Every one is a full, rule-governed system.`,
  ].join("\n");
}
