export interface WorkflowComponentResult {
  domain: string;
  component: string;
  input: string;
  intent: string;
  guidance: string[];
  artifacts: string[];
  validation: string[];
  guardrails: string[];
}

const domainGuardrails: Record<string, string[]> = {
  business: [
    'Separate assumptions from known facts.',
    'Tie recommendations to metrics, customers, and constraints.'
  ],
  engineering: [
    'State assumptions and units.',
    'Use conservative safety margins and recommend professional review for high-risk builds.'
  ],
  geography: [
    'Avoid flattening cultures into stereotypes.',
    'Flag contested borders, categories, and date-sensitive claims.'
  ],
  health: [
    'Educational support only, not diagnosis or medical advice.',
    'Escalate emergency symptoms and medication changes to professionals.'
  ],
  language: [
    'Preserve user intent.',
    'Flag nuance, register, and cultural uncertainty.'
  ],
  legal: [
    'Legal information, not legal advice.',
    'Jurisdiction and current law must be checked.'
  ],
  music: [
    'Create original alternatives instead of copying a protected work.',
    'Avoid full copyrighted lyrics or commercial-song transcriptions.'
  ],
  philosophy: [
    'Represent opposing views fairly.',
    'Use fallacy labels as diagnostics, not dismissals.'
  ],
  security: [
    'Defensive-only security guidance.',
    'Avoid exploit chaining, credential theft, malware, or evasion.'
  ],
  story: [
    'Preserve the creator’s intent and established canon.',
    'Flag continuity risks instead of silently rewriting lore.'
  ]
};

const domainGuidance: Record<string, string[]> = {
  business: [
    'Identify customer, problem, promise, channel, revenue model, and operating constraint.',
    'Turn the request into a testable plan with metrics and next decisions.'
  ],
  engineering: [
    'Classify the design as electrical, mechanical, robotics, CAD, BOM, or safety.',
    'Run first-pass calculations where possible, then list risks and verification steps.'
  ],
  geography: [
    'Define the place, scale, time period, and source type before explaining.',
    'Separate physical geography, political boundaries, demographics, language, and culture.'
  ],
  health: [
    'Route red flags before normal coaching.',
    'Keep guidance educational and recommend clinician review when risk is personal or high.'
  ],
  language: [
    'Identify task type: translate, rewrite, grammar, rhetoric, speech, or readability.',
    'Return before/after guidance or diagnostics while preserving meaning.'
  ],
  legal: [
    'Identify jurisdiction, legal topic, stakes, and deadline sensitivity.',
    'Separate rule text, interpretation, practical risk, and next document to verify.'
  ],
  music: [
    'Classify theory, beat, mix, sample, genre, or arrangement intent.',
    'Return practical musical choices: tempo, key, groove, arrangement, mix checks, or clearance steps.'
  ],
  philosophy: [
    'Map claim, premises, assumptions, objections, and counterexamples.',
    'Separate descriptive, conceptual, and normative reasoning.'
  ],
  security: [
    'Identify assets, trust boundaries, attackers, controls, and abuse cases.',
    'Return defensive checks, severity, evidence, and remediation steps.'
  ],
  story: [
    'Identify plot, character, dialogue, worldbuilding, pacing, or continuity intent.',
    'Return usable creative artifacts plus conflicts, constraints, and revision prompts.'
  ]
};

export function createWorkflowGuidance(domain: string, component: string, input: string): WorkflowComponentResult {
  const focus = component
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/Tool$/, '')
    .toLowerCase();

  return {
    domain,
    component,
    input,
    intent: `${domain}.${focus.replace(/\s+/g, '_')}`,
    guidance: [
      `Focus this component on ${focus}.`,
      ...(domainGuidance[domain] || ['Classify the request, gather evidence, run tools, verify output, and return structured guidance.'])
    ],
    artifacts: [
      'classification',
      'evidence summary',
      'actionable output',
      'risks or caveats',
      'verification checklist'
    ],
    validation: [
      'Check the answer uses the requested domain and mode.',
      'Check unsupported claims are labeled as assumptions.',
      'Check the output gives the user a concrete next step.'
    ],
    guardrails: domainGuardrails[domain] || ['Use domain-specific safety boundaries.']
  };
}
