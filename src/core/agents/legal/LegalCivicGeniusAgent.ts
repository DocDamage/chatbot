import { GenericSpecialistAgent } from '../specialists/GenericSpecialistAgent';
import { CaseLawSummaryTool } from '../../tools/legal/CaseLawSummaryTool';
import { ContractClauseExplainerTool } from '../../tools/legal/ContractClauseExplainerTool';
import { JurisdictionRouterTool } from '../../tools/legal/JurisdictionRouterTool';
import { LegalRiskChecklistTool } from '../../tools/legal/LegalRiskChecklistTool';
import { PlainEnglishLegalTool } from '../../tools/legal/PlainEnglishLegalTool';
import { StatuteLookupTool } from '../../tools/legal/StatuteLookupTool';

const profile = {
  id: "legal",
  label: "Legal / Civic Genius",
  guardrails: [
    "Not legal advice.",
    "Jurisdiction is required for specific legal analysis.",
    "Current law must be checked.",
    "Separate law text from interpretation.",
    "Recommend an attorney for high-stakes issues."
  ],
  workflows: [
    "Identify jurisdiction and legal/civic intent.",
    "Retrieve law/civic records from local KB.",
    "Explain in plain English with risk boundaries."
  ],
  tools: [
    "StatuteLookupTool",
    "CaseLawSummaryTool",
    "ContractClauseExplainerTool",
    "JurisdictionRouterTool",
    "LegalRiskChecklistTool",
    "PlainEnglishLegalTool"
  ],
  defaultSources: [
    "knowledge-base-public/legal/overview.md"
  ]
};

export class LegalCivicGeniusAgent extends GenericSpecialistAgent {
  private statuteLookupTool = new StatuteLookupTool();
  private caseLawSummaryTool = new CaseLawSummaryTool();
  private contractClauseExplainerTool = new ContractClauseExplainerTool();
  private jurisdictionRouterTool = new JurisdictionRouterTool();
  private legalRiskChecklistTool = new LegalRiskChecklistTool();
  private plainEnglishLegalTool = new PlainEnglishLegalTool();

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

  contract(query: string) {
    return this.ask(query, 'contract');
  }

  risk(query: string) {
    return this.ask(query, 'risk');
  }

  civic(query: string) {
    return this.ask(query, 'civic');
  }

  private toolFirstResponse(query: string, mode: string) {
    const text = query.toLowerCase();
    const jurisdiction = this.jurisdictionRouterTool.run({ query });
    const results: Array<Record<string, any>> = [jurisdiction];

    if (mode === 'contract' || /\b(contract|clause|agreement|indemn|liability|non-compete|confidential|termination|venue|governing law)\b/.test(text)) {
      results.push(this.contractClauseExplainerTool.run({ query, text: query }));
      results.push(this.legalRiskChecklistTool.run({ query, issue: query }));
    } else if (mode === 'risk' || /\b(risk|sued|lawsuit|liable|liability|deadline|criminal|eviction|custody|tax audit|arrest)\b/.test(text)) {
      results.push(this.legalRiskChecklistTool.run({ query, issue: query }));
    } else if (mode === 'civic' || /\b(permit|license|vote|court form|public records|city|county|agency|benefits)\b/.test(text)) {
      results.push(this.statuteLookupTool.run({ query, topic: query, jurisdiction: jurisdiction.jurisdiction }));
      results.push(this.plainEnglishLegalTool.run({ query, concept: 'civic process' }));
    } else if (/\b(statute|law|code|regulation|ordinance)\b/.test(text)) {
      results.push(this.statuteLookupTool.run({ query, topic: query, jurisdiction: jurisdiction.jurisdiction }));
    } else if (/\b(case|holding|court|precedent)\b/.test(text)) {
      results.push(this.caseLawSummaryTool.run({ query, caseName: query }));
    } else if (/\b(explain|plain english|mean|means|rights|obligations)\b/.test(text)) {
      results.push(this.plainEnglishLegalTool.run({ query, concept: query }));
    } else {
      return undefined;
    }

    return {
      domain: 'legal',
      mode,
      response: [
        `Legal / Civic Genius (${mode})`,
        '',
        `Request: ${query}`,
        '',
        'Legal information, not legal advice. Current law and jurisdiction must be checked.',
        '',
        'Legal tool results:',
        ...results.map(result => `- ${result.tool}: ${JSON.stringify(result, null, 2)}`),
        '',
        'Guardrails:',
        ...profile.guardrails.map(rule => `- ${rule}`)
      ].join('\n'),
      sources: ['deterministic legal tools'],
      guardrails: profile.guardrails,
      tools: results.map(result => String(result.tool || 'legal-tool')),
      model: 'legal-tools'
    };
  }
}
