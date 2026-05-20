export interface RedFlagTriageInput {
  query?: string;
}

const emergencyPatterns = [
  { pattern: /\b(chest pain|pressure in my chest|crushing chest)\b/i, reason: 'possible heart or lung emergency' },
  { pattern: /\b(stroke|face droop|slurred speech|one side weak|sudden weakness)\b/i, reason: 'possible stroke symptoms' },
  { pattern: /\b(can't breathe|cannot breathe|severe shortness of breath|blue lips)\b/i, reason: 'breathing emergency' },
  { pattern: /\b(suicidal|kill myself|end my life|self harm|self-harm)\b/i, reason: 'immediate self-harm risk' },
  { pattern: /\b(severe bleeding|won't stop bleeding|blood loss)\b/i, reason: 'uncontrolled bleeding' },
  { pattern: /\b(anaphylaxis|throat swelling|tongue swelling|severe allergic)\b/i, reason: 'possible severe allergic reaction' },
  { pattern: /\b(seizure|convulsion)\b/i, reason: 'seizure or neurologic emergency' },
  { pattern: /\b(worst headache|sudden severe headache)\b/i, reason: 'sudden severe headache red flag' }
];

const urgentPatterns = [
  { pattern: /\b(high fever|fever.*104|104 ?f|40 ?c)\b/i, reason: 'very high fever' },
  { pattern: /\b(dehydrated|cannot keep fluids|persistent vomiting)\b/i, reason: 'dehydration risk' },
  { pattern: /\b(pregnant.*pain|pregnant.*bleeding)\b/i, reason: 'pregnancy symptom needing prompt care' },
  { pattern: /\b(infection.*spreading|red streak|pus|wound)\b/i, reason: 'possible spreading infection' }
];

export class RedFlagTriageTool {
  run(input: RedFlagTriageInput = {}) {
    const query = input.query || '';
    const emergencyMatches = emergencyPatterns.filter(item => item.pattern.test(query));
    const urgentMatches = urgentPatterns.filter(item => item.pattern.test(query));
    const level = emergencyMatches.length > 0 ? 'emergency' : urgentMatches.length > 0 ? 'urgent' : 'routine_or_unclear';

    return {
      domain: 'health',
      tool: 'RedFlagTriageTool',
      level,
      matchedReasons: [...emergencyMatches, ...urgentMatches].map(item => item.reason),
      action:
        level === 'emergency'
          ? 'Seek emergency help now. In the US, call 911 or local emergency services.'
          : level === 'urgent'
            ? 'Contact urgent care, a nurse line, or a clinician promptly, especially if symptoms are worsening.'
            : 'No emergency red flag was detected from the text alone. Monitor symptoms and contact a clinician if symptoms are severe, worsening, unusual, or persistent.',
      boundaries: [
        'This is educational triage support, not a diagnosis.',
        'When in doubt about severe symptoms, choose urgent professional care.'
      ]
    };
  }
}
