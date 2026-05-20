export interface MedicalSourceRouterInput {
  query?: string;
}

export class MedicalSourceRouterTool {
  run(input: MedicalSourceRouterInput = {}) {
    const query = input.query || '';
    const category = this.classify(query);

    return {
      domain: 'health',
      tool: 'MedicalSourceRouterTool',
      category,
      preferredSources: this.sourcesFor(category),
      sourceDateRequirement: 'For medical claims, prefer current government, academic medical center, specialty society, or peer-reviewed sources and check publication/update dates.',
      caution: 'This router names source types only; it does not verify live medical guidance by itself.'
    };
  }

  private classify(query: string): string {
    if (/\b(medication|drug|dose|interaction|side effect|ibuprofen|acetaminophen|ssri|antibiotic)\b/i.test(query)) return 'medication_safety';
    if (/\b(symptom|pain|fever|rash|cough|dizzy|shortness|chest)\b/i.test(query)) return 'symptoms_triage';
    if (/\b(nutrition|calorie|macro|protein|diet)\b/i.test(query)) return 'nutrition';
    if (/\b(workout|fitness|exercise|strength|cardio)\b/i.test(query)) return 'fitness';
    if (/\b(anatomy|muscle|bone|joint|nerve)\b/i.test(query)) return 'anatomy';
    return 'general_health_education';
  }

  private sourcesFor(category: string): string[] {
    const common = ['CDC/NIH or national public-health agencies', 'major academic medical centers', 'peer-reviewed review articles'];
    if (category === 'medication_safety') return ['FDA/MedlinePlus drug records', 'pharmacist or prescribing clinician', ...common];
    if (category === 'symptoms_triage') return ['emergency/urgent-care guidance from health systems', 'CDC/NIH condition pages', 'clinician evaluation'];
    if (category === 'nutrition') return ['registered dietitian guidance', 'USDA/NIH nutrition references', ...common];
    if (category === 'fitness') return ['ACSM-style exercise guidance', 'physical therapist or sports medicine clinician when injured', ...common];
    return common;
  }
}
