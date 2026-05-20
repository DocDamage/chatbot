import { SpecialistIntent } from '../specialist/SpecialistAgent';

export class SixSigmaIntentClassifier {
  classify(input: string): SpecialistIntent {
    const text = input.toLowerCase();
    if (/\b(cpk|cp\b|cpu|cpl|sample size|gage|r&r|dpmo|sigma|copq|anova|regression)\b/.test(text)) return { kind: text.includes('cpk') ? 'calculator.cpk' : 'calculator', confidence: 0.92 };
    if (/\b(project|charter|sipoc|ctq|dmaic|late deliveries|complaints)\b/.test(text)) return { kind: 'project_coaching', confidence: 0.88 };
    if (/\b(cssbb|certification|exam|study plan|quiz|flashcard|belt)\b/.test(text)) return { kind: 'certification', confidence: 0.85 };
    if (/\b(control chart|doe|experiment|process map|western electric)\b/.test(text)) return { kind: 'simulation', confidence: 0.85 };
    if (/\b(export|excel|minitab|python|jupyter|r script|spss|jmp)\b/.test(text)) return { kind: 'export', confidence: 0.85 };
    if (/\b(reach|rohs|prop 65|tsca|sds|label|supplier|compliance|audit)\b/.test(text)) return { kind: 'compliance', confidence: 0.85 };
    if (/\b(healthcare|manufacturing|software|finance|game development|industry)\b/.test(text)) return { kind: 'industry_playbook', confidence: 0.75 };
    return { kind: 'sixsigma_qa', confidence: 0.65 };
  }
}
