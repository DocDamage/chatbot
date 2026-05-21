export interface CreativeStylePolicyResult {
  allowed: boolean;
  safeStyle?: string;
  safePrompt?: string;
  reason?: string;
  safeAlternative?: string;
  notes: string[];
}

const protectedWorlds = [
  {
    pattern: /\b(lord of the rings|lotr|middle[-\s]?earth|frodo|mordor|gandalf|shire)\b/i,
    safeStyle: 'mythic secondary-world epic fantasy',
    alternative: 'original mythic secondary-world quest with invented places, cultures, and conflicts',
  },
  {
    pattern: /\b(harry potter|hogwarts|wizarding world)\b/i,
    safeStyle: 'boarding-school contemporary fantasy with secret magical institutions',
    alternative: 'original school-of-magic story with new rules, locations, and cast',
  },
  {
    pattern: /\b(star wars|jedi|sith|skywalker|tatooine)\b/i,
    safeStyle: 'space-fantasy rebellion with mystical orders and frontier worlds',
    alternative: 'original space-fantasy conflict with new factions, beliefs, and planets',
  },
];

const livingAuthors = [
  {
    pattern: /\bstephen king\b/i,
    safeStyle: 'small-town supernatural psychological horror',
  },
  {
    pattern: /\bbrandon sanderson\b/i,
    safeStyle: 'high-magic epic fantasy with rigorous invented rules',
  },
  {
    pattern: /\bgeorge r\.?\s*r\.?\s*martin\b/i,
    safeStyle: 'political low fantasy with dynastic conflict and moral ambiguity',
  },
];

export class CreativeStylePolicy {
  static evaluate(prompt: string): CreativeStylePolicyResult {
    const protectedWorld = protectedWorlds.find(entry => entry.pattern.test(prompt));
    const livingAuthor = livingAuthors.find(entry => entry.pattern.test(prompt));

    if (protectedWorld && /\b(?:continue|sequel|with|using|set in|same characters?|returning to)\b/i.test(prompt) && !/\btype\b/i.test(prompt)) {
      return {
        allowed: false,
        reason: 'Request asks to continue or reuse a protected world, characters, places, or lore.',
        safeAlternative: protectedWorld.alternative,
        notes: ['Create original names, places, factions, history, and plot events.'],
      };
    }

    if (livingAuthor && /\b(?:exactly|in|imitate|copy|like|style)\b.{0,24}\b(?:style|voice|prose)\b/i.test(prompt)) {
      return {
        allowed: false,
        reason: 'Request asks for exact living author style imitation.',
        safeAlternative: livingAuthor.safeStyle,
        notes: ['Use broad genre descriptors instead of imitating a living author voice.'],
      };
    }

    if (protectedWorld && /\btype\b/i.test(prompt)) {
      return {
        allowed: true,
        safeStyle: protectedWorld.safeStyle,
        safePrompt: prompt.replace(protectedWorld.pattern, protectedWorld.safeStyle),
        notes: [
          'Do not use protected characters, places, or lore.',
          'Use original names, conflicts, cultures, and scene events.',
        ],
      };
    }

    if (livingAuthor) {
      return {
        allowed: true,
        safeStyle: livingAuthor.safeStyle,
        safePrompt: prompt.replace(livingAuthor.pattern, livingAuthor.safeStyle),
        notes: ['Use broad genre and tone traits without copying author voice.'],
      };
    }

    return {
      allowed: true,
      notes: [],
    };
  }
}
