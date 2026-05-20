export interface MedicationInteractionInput {
  query?: string;
}

const medicationWarnings = [
  {
    pattern: /\b(ibuprofen|naproxen|advil|aleve|nsaid)\b/i,
    warning: 'NSAIDs can increase bleeding risk, affect kidneys, irritate the stomach, and interact with blood thinners or some blood-pressure medicines.'
  },
  {
    pattern: /\b(acetaminophen|tylenol|paracetamol)\b/i,
    warning: 'Acetaminophen overdose can damage the liver; avoid stacking multiple products that contain it.'
  },
  {
    pattern: /\b(warfarin|eliquis|apixaban|xarelto|rivaroxaban|blood thinner)\b/i,
    warning: 'Blood thinners have serious bleeding-interaction risks. Check with a clinician or pharmacist before adding OTC medicines or supplements.'
  },
  {
    pattern: /\b(ssri|sertraline|fluoxetine|prozac|zoloft|snri|venlafaxine)\b/i,
    warning: 'Some antidepressants can interact with other serotonergic drugs and may require tapering rather than abrupt stopping.'
  },
  {
    pattern: /\b(grapefruit)\b/i,
    warning: 'Grapefruit can affect metabolism of some medications, including certain statins and blood-pressure medicines.'
  }
];

export class MedicationInteractionWarningTool {
  run(input: MedicationInteractionInput = {}) {
    const query = input.query || '';
    const warnings = medicationWarnings
      .filter(item => item.pattern.test(query))
      .map(item => item.warning);

    return {
      domain: 'health',
      tool: 'MedicationInteractionWarningTool',
      detectedWarnings: warnings,
      action:
        warnings.length > 0
          ? 'Verify interactions with a pharmacist, prescribing clinician, or an authoritative drug-interaction checker before changing medication use.'
          : 'No specific medication interaction was detected from the text alone. Provide exact drug names, doses, age, pregnancy status, conditions, and supplements to a clinician or pharmacist for real screening.',
      hardBoundaries: [
        'Do not start, stop, combine, or change medication dose based only on chatbot guidance.',
        'Seek urgent help for trouble breathing, swelling, fainting, severe rash, overdose, or severe allergic reaction.'
      ]
    };
  }
}
