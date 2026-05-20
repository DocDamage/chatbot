import { GenericSpecialistAgent } from '../specialists/GenericSpecialistAgent';
import { ArgumentMapTool } from '../../tools/philosophy/ArgumentMapTool';
import { CounterargumentTool } from '../../tools/philosophy/CounterargumentTool';
import { EthicalFrameworkTool } from '../../tools/philosophy/EthicalFrameworkTool';
import { FallacyDetectionTool } from '../../tools/philosophy/FallacyDetectionTool';
import { PhilosophyTimelineTool } from '../../tools/philosophy/PhilosophyTimelineTool';
import { SocraticQuestionTool } from '../../tools/philosophy/SocraticQuestionTool';

const profile = {
  id: "philosophy",
  label: "Philosophy / Logic / Debate Genius",
  guardrails: [
    "Represent opposing views fairly.",
    "Separate descriptive claims from normative claims.",
    "Do not use fallacy labels as dismissive shortcuts."
  ],
  workflows: [
    "Classify argument, debate, ethics, or timeline intent.",
    "Map claims, reasons, objections, and assumptions.",
    "Return fair counterarguments and reasoning checks."
  ],
  tools: [
    "ArgumentMapTool",
    "FallacyDetectionTool",
    "EthicalFrameworkTool",
    "SocraticQuestionTool",
    "PhilosophyTimelineTool",
    "CounterargumentTool"
  ],
  defaultSources: [
    "knowledge-base-public/philosophy/overview.md"
  ]
};

export class PhilosophyGeniusAgent extends GenericSpecialistAgent {
  private argumentMapTool = new ArgumentMapTool();
  private fallacyDetectionTool = new FallacyDetectionTool();
  private ethicalFrameworkTool = new EthicalFrameworkTool();
  private socraticQuestionTool = new SocraticQuestionTool();
  private philosophyTimelineTool = new PhilosophyTimelineTool();
  private counterargumentTool = new CounterargumentTool();

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

  argument(query: string) {
    return this.ask(query, 'argument');
  }

  debate(query: string) {
    return this.ask(query, 'debate');
  }

  ethics(query: string) {
    return this.ask(query, 'ethics');
  }

  private toolFirstResponse(query: string, mode: string) {
    const text = query.toLowerCase();
    const results: Array<Record<string, any>> = [];

    if (mode === 'ethics' || /\b(ethics|ethical|moral|right|wrong|should i|ought|justice|fairness)\b/.test(text)) {
      results.push(this.ethicalFrameworkTool.run({ query }));
      results.push(this.socraticQuestionTool.run({ query }));
    } else if (mode === 'debate' || /\b(debate|counterargument|counter argument|opposing view|steelman|rebuttal)\b/.test(text)) {
      results.push(this.argumentMapTool.run({ query }));
      results.push(this.counterargumentTool.run({ query }));
      results.push(this.fallacyDetectionTool.run({ query }));
    } else if (mode === 'argument' || /\b(argument|fallacy|premise|conclusion|claim|because|therefore|logic)\b/.test(text)) {
      results.push(this.argumentMapTool.run({ query }));
      results.push(this.fallacyDetectionTool.run({ query }));
      results.push(this.socraticQuestionTool.run({ query }));
    } else if (/\b(stoic|stoicism|existential|utilitarian|kant|philosophy timeline|history of philosophy)\b/.test(text)) {
      results.push(this.philosophyTimelineTool.run({ query }));
      results.push(this.socraticQuestionTool.run({ query }));
    } else {
      return undefined;
    }

    return {
      domain: 'philosophy',
      mode,
      response: [
        `Philosophy / Logic / Debate Genius (${mode})`,
        '',
        `Request: ${query}`,
        '',
        'Reasoning tool results:',
        ...results.map(result => `- ${result.tool}: ${JSON.stringify(result, null, 2)}`),
        '',
        'Guardrails:',
        ...profile.guardrails.map(rule => `- ${rule}`)
      ].join('\n'),
      sources: ['deterministic philosophy tools'],
      guardrails: profile.guardrails,
      tools: results.map(result => String(result.tool || 'philosophy-tool')),
      model: 'philosophy-tools'
    };
  }
}
