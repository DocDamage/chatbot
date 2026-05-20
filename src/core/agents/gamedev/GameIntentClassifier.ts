import { SpecialistIntent } from '../specialist/SpecialistAgent';

export class GameIntentClassifier {
  classify(input: string): SpecialistIntent {
    const text = input.toLowerCase();
    if (/\b(ttk|time-to-kill|hp|damage|dps|cooldown|drop rate|xp curve|balance)\b/.test(text)) return { kind: 'balance', confidence: 0.9 };
    if (/\b(godot|unity|unreal|phaser|pygame|gdscript|blueprint|c#|typescript)\b/.test(text)) return { kind: 'engine code', confidence: 0.85 };
    if (/\b(prototype|playable|scene|script)\b/.test(text)) return { kind: 'prototype', confidence: 0.8 };
    if (/\b(shader|vfx|material)\b/.test(text)) return { kind: 'shader', confidence: 0.75 };
    if (/\b(level|map|encounter|boss)\b/.test(text)) return { kind: 'level', confidence: 0.75 };
    return { kind: 'design', confidence: 0.65 };
  }
}
