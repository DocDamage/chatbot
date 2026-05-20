import { GenericSpecialistAgent } from '../specialists/GenericSpecialistAgent';
import { GrammarDiagnosticTool } from '../../tools/language/GrammarDiagnosticTool';
import { ReadabilityTool } from '../../tools/language/ReadabilityTool';
import { RhetoricAnalyzerTool } from '../../tools/language/RhetoricAnalyzerTool';
import { SpeechOutlineTool } from '../../tools/language/SpeechOutlineTool';
import { ToneRewriteTool } from '../../tools/language/ToneRewriteTool';
import { TranslationTool } from '../../tools/language/TranslationTool';

const profile = {
  id: "language",
  label: "Language / Communication Genius",
  guardrails: [
    "Preserve user intent.",
    "Flag uncertainty in translation nuance.",
    "Avoid manipulative persuasion for harmful goals."
  ],
  workflows: [
    "Classify translation, rewrite, rhetoric, grammar, or speech intent.",
    "Preserve meaning while adjusting tone or structure.",
    "Return before/after or diagnostic guidance."
  ],
  tools: [
    "TranslationTool",
    "ToneRewriteTool",
    "ReadabilityTool",
    "RhetoricAnalyzerTool",
    "GrammarDiagnosticTool",
    "SpeechOutlineTool"
  ],
  defaultSources: [
    "knowledge-base-public/language/overview.md"
  ]
};

export class LanguageGeniusAgent extends GenericSpecialistAgent {
  private translationTool = new TranslationTool();
  private toneRewriteTool = new ToneRewriteTool();
  private readabilityTool = new ReadabilityTool();
  private rhetoricAnalyzerTool = new RhetoricAnalyzerTool();
  private grammarDiagnosticTool = new GrammarDiagnosticTool();
  private speechOutlineTool = new SpeechOutlineTool();

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

  translate(query: string) {
    return this.ask(query, 'translate');
  }

  rewrite(query: string) {
    return this.ask(query, 'rewrite');
  }

  rhetoric(query: string) {
    return this.ask(query, 'rhetoric');
  }

  speech(query: string) {
    return this.ask(query, 'speech');
  }

  private toolFirstResponse(query: string, mode: string) {
    const text = query.toLowerCase();
    const results: Array<Record<string, any>> = [];

    if (mode === 'translate' || /\b(translate|translation|spanish|french|to english|to spanish|to french)\b/.test(text)) {
      results.push(this.translationTool.run({ query }));
    } else if (mode === 'rhetoric' || /\b(rhetoric|persuade|persuasive|argument|ethos|pathos|logos)\b/.test(text)) {
      results.push(this.rhetoricAnalyzerTool.run({ query }));
      results.push(this.readabilityTool.run({ query }));
    } else if (mode === 'speech' || /\b(speech|presentation|talk|outline)\b/.test(text)) {
      results.push(this.speechOutlineTool.run({ query }));
      results.push(this.rhetoricAnalyzerTool.run({ query }));
    } else if (mode === 'rewrite' || /\b(rewrite|tone|make this|professional|polite|concise|friendly|firm)\b/.test(text)) {
      results.push(this.toneRewriteTool.run({ query }));
      results.push(this.readabilityTool.run({ query }));
    } else if (/\b(grammar|proofread|punctuation|spelling|readability|readable)\b/.test(text)) {
      results.push(this.grammarDiagnosticTool.run({ query }));
      results.push(this.readabilityTool.run({ query }));
    } else {
      return undefined;
    }

    return {
      domain: 'language',
      mode,
      response: [
        `Language / Communication Genius (${mode})`,
        '',
        `Request: ${query}`,
        '',
        'Language tool results:',
        ...results.map(result => `- ${result.tool}: ${JSON.stringify(result, null, 2)}`),
        '',
        'Guardrails:',
        ...profile.guardrails.map(rule => `- ${rule}`)
      ].join('\n'),
      sources: ['deterministic language tools'],
      guardrails: profile.guardrails,
      tools: results.map(result => String(result.tool || 'language-tool')),
      model: 'language-tools'
    };
  }
}
