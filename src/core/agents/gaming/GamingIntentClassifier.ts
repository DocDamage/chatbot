import { SpecialistIntent } from '../specialist/SpecialistAgent';

export class GamingIntentClassifier {
  classify(input: string): SpecialistIntent {
    const text = input.toLowerCase();
    if (/\b(speedrun|speedrunning|route|routing|glitchless|any%|100%)\b/.test(text)) return { kind: 'speedrunning', confidence: 0.9 };
    if (/\b(lore|canon|timeline|franchise|character|ending)\b/.test(text)) return { kind: 'lore', confidence: 0.86 };
    if (/\b(mod|modding|rom hack|save editor|emulat)\b/.test(text)) return { kind: 'modding', confidence: 0.84 };
    if (/\b(platform|console|hardware|pc|switch|playstation|xbox|steam deck)\b/.test(text)) return { kind: 'platform', confidence: 0.82 };
    if (/\b(strategy|meta|ranked|esports|matchup|competitive)\b/.test(text)) return { kind: 'strategy', confidence: 0.82 };
    if (/\b(prototype|implement|build|godot|unity|unreal|phaser|gamemaker|rpg maker|controller|script)\b/.test(text)) return { kind: 'gamedev', confidence: 0.86 };
    if (/\b(design|combat|economy|progression|level|hud|game feel|accessibility|playtest)\b/.test(text)) return { kind: 'game analysis', confidence: 0.78 };
    return { kind: 'gaming', confidence: 0.65 };
  }
}
