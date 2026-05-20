export interface NutritionMacroInput {
  query?: string;
  calories?: number;
  bodyWeightLb?: number;
  goal?: 'fat_loss' | 'maintenance' | 'muscle_gain';
}

export class NutritionMacroTool {
  run(input: NutritionMacroInput = {}) {
    const query = input.query || '';
    const calories = input.calories || this.extractCalories(query) || 2200;
    const bodyWeightLb = input.bodyWeightLb || this.extractWeight(query);
    const goal = input.goal || this.inferGoal(query);
    const proteinGrams = bodyWeightLb ? Math.round(bodyWeightLb * (goal === 'muscle_gain' ? 0.9 : 0.8)) : Math.round((calories * 0.3) / 4);
    const fatCalories = calories * (goal === 'fat_loss' ? 0.25 : 0.28);
    const fatGrams = Math.round(fatCalories / 9);
    const carbGrams = Math.max(0, Math.round((calories - proteinGrams * 4 - fatGrams * 9) / 4));

    return {
      domain: 'health',
      tool: 'NutritionMacroTool',
      goal,
      calories,
      macros: {
        proteinGrams,
        carbsGrams: carbGrams,
        fatGrams
      },
      notes: [
        bodyWeightLb
          ? `Protein target uses ${bodyWeightLb} lb body weight as an educational planning estimate.`
          : 'No body weight was detected, so protein uses a calorie-percentage estimate.',
        'Adjust for medical conditions, medications, training load, food preferences, and clinician guidance.',
        'For eating-disorder history, diabetes, kidney disease, pregnancy, or major weight changes, use clinician-supervised nutrition advice.'
      ]
    };
  }

  private extractCalories(query: string): number | undefined {
    const match = query.match(/\b(\d{3,5})\s*(?:cal|calories|kcal)\b/i);
    return match ? Number(match[1]) : undefined;
  }

  private extractWeight(query: string): number | undefined {
    const match = query.match(/\b(\d{2,3})\s*(?:lb|lbs|pounds)\b/i);
    return match ? Number(match[1]) : undefined;
  }

  private inferGoal(query: string): 'fat_loss' | 'maintenance' | 'muscle_gain' {
    if (/\b(cut|fat loss|lose weight|weight loss)\b/i.test(query)) return 'fat_loss';
    if (/\b(bulk|gain muscle|muscle gain|build muscle)\b/i.test(query)) return 'muscle_gain';
    return 'maintenance';
  }
}
