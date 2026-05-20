import { GenericSpecialistAgent } from '../specialists/GenericSpecialistAgent';
import { AnatomyLookupTool } from '../../tools/health/AnatomyLookupTool';
import { FitnessPlanTool } from '../../tools/health/FitnessPlanTool';
import { MedicalSourceRouterTool } from '../../tools/health/MedicalSourceRouterTool';
import { MedicationInteractionWarningTool } from '../../tools/health/MedicationInteractionWarningTool';
import { NutritionMacroTool } from '../../tools/health/NutritionMacroTool';
import { RedFlagTriageTool } from '../../tools/health/RedFlagTriageTool';

const profile = {
  id: "health",
  label: "Medical / Health / Anatomy Genius",
  guardrails: [
    "Not a doctor.",
    "Emergency symptoms trigger urgent-care advice.",
    "No diagnosis as certainty.",
    "No medication changes without a clinician.",
    "Source-date checking required."
  ],
  workflows: [
    "Classify anatomy, nutrition, fitness, medication, or red-flag triage.",
    "Route red flags before normal coaching.",
    "Return educational guidance with safety boundaries."
  ],
  tools: [
    "AnatomyLookupTool",
    "MedicalSourceRouterTool",
    "NutritionMacroTool",
    "FitnessPlanTool",
    "RedFlagTriageTool",
    "MedicationInteractionWarningTool"
  ],
  defaultSources: [
    "knowledge-base-public/health/overview.md"
  ]
};

export class HealthGeniusAgent extends GenericSpecialistAgent {
  private anatomyLookupTool = new AnatomyLookupTool();
  private medicalSourceRouterTool = new MedicalSourceRouterTool();
  private nutritionMacroTool = new NutritionMacroTool();
  private fitnessPlanTool = new FitnessPlanTool();
  private redFlagTriageTool = new RedFlagTriageTool();
  private medicationInteractionWarningTool = new MedicationInteractionWarningTool();

  constructor(documentStore?: any) {
    super(profile, documentStore);
  }

  override async ask(query: string, mode = 'ask') {
    const toolResponse = this.toolFirstResponse(query, mode);
    if (toolResponse) {
      return toolResponse;
    }

    return super.ask(query, mode);
  }

  anatomy(query: string) {
    return this.ask(query, 'anatomy');
  }

  fitness(query: string) {
    return this.ask(query, 'fitness');
  }

  nutrition(query: string) {
    return this.ask(query, 'nutrition');
  }

  redFlags(query: string) {
    return this.ask(query, 'red-flags');
  }

  medication(query: string) {
    return this.ask(query, 'medication');
  }

  private toolFirstResponse(query: string, mode: string) {
    const text = query.toLowerCase();
    const triage = this.redFlagTriageTool.run({ query });
    const sourceRouter = this.medicalSourceRouterTool.run({ query });
    const results: Array<Record<string, any>> = [triage, sourceRouter];

    if (triage.level === 'emergency') {
      return this.formatToolResult(query, mode, results, 'Emergency red flag detected. Seek emergency help now before using educational guidance.');
    }

    if (mode === 'red-flags' || /\b(chest pain|stroke|can't breathe|cannot breathe|suicidal|self harm|severe bleeding|anaphylaxis|seizure|worst headache|red flag|urgent)\b/.test(text)) {
      return this.formatToolResult(query, mode, results, 'Triage boundary check completed.');
    }

    if (mode === 'medication' || /\b(medication|medicine|drug|dose|interaction|side effect|ibuprofen|acetaminophen|tylenol|warfarin|eliquis|xarelto|ssri|antibiotic|grapefruit)\b/.test(text)) {
      results.push(this.medicationInteractionWarningTool.run({ query }));
      return this.formatToolResult(query, mode, results, 'Medication safety check completed.');
    }

    if (mode === 'nutrition' || /\b(nutrition|calorie|calories|macro|macros|protein|carb|fat|diet|cut|bulk|lose weight|gain muscle)\b/.test(text)) {
      results.push(this.nutritionMacroTool.run({ query }));
      return this.formatToolResult(query, mode, results, 'Nutrition planning estimate completed.');
    }

    if (mode === 'fitness' || /\b(workout|fitness|exercise|strength|cardio|run|mobility|training|lift|gym)\b/.test(text)) {
      results.push(this.fitnessPlanTool.run({ query }));
      return this.formatToolResult(query, mode, results, 'Fitness planning scaffold completed.');
    }

    if (mode === 'anatomy' || /\b(anatomy|muscle|bone|joint|nerve|knee|shoulder|spine|back|heart|acl|meniscus|rotator cuff)\b/.test(text)) {
      results.push(this.anatomyLookupTool.run({ query }));
      return this.formatToolResult(query, mode, results, 'Anatomy tutoring lookup completed.');
    }

    if (/\b(symptom|pain|fever|rash|cough|dizzy|health)\b/.test(text)) {
      return this.formatToolResult(query, mode, results, 'General symptom safety boundary check completed.');
    }

    return undefined;
  }

  private formatToolResult(query: string, mode: string, results: Array<Record<string, any>>, lead: string) {
    return {
      domain: 'health',
      mode,
      response: [
        `Medical / Health / Anatomy Genius (${mode})`,
        '',
        `Request: ${query}`,
        '',
        lead,
        '',
        'Health tool results:',
        ...results.map(result => `- ${result.tool}: ${JSON.stringify(result, null, 2)}`),
        '',
        'Guardrails:',
        ...profile.guardrails.map(rule => `- ${rule}`)
      ].join('\n'),
      sources: ['deterministic health tools'],
      guardrails: profile.guardrails,
      tools: results.map(result => String(result.tool || 'health-tool')),
      model: 'health-tools'
    };
  }
}
