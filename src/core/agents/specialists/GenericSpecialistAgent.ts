import { RAGDocumentStore } from '../../rag/RAGDocumentStore';

export interface SpecialistProfile {
  id: string;
  label: string;
  guardrails: string[];
  workflows: string[];
  tools: string[];
  defaultSources: string[];
}

export interface SpecialistResponse {
  domain: string;
  mode: string;
  response: string;
  sources: string[];
  guardrails: string[];
  tools: string[];
  model: string;
}

export class GenericSpecialistAgent {
  constructor(
    private readonly profile: SpecialistProfile,
    private readonly documentStore?: Pick<RAGDocumentStore, 'searchKeyword'>
  ) {}

  async ask(query: string, mode = 'ask'): Promise<SpecialistResponse> {
    const local = await this.answerFromDomainKnowledge(query, mode);
    if (local) {
      return {
        domain: this.profile.id,
        mode,
        response: local.response,
        sources: local.sources,
        guardrails: this.profile.guardrails,
        tools: this.profile.tools,
        model: 'local-knowledge-base'
      };
    }

    return {
      domain: this.profile.id,
      mode,
      response: this.fallbackWorkflow(query, mode),
      sources: this.profile.defaultSources,
      guardrails: this.profile.guardrails,
      tools: this.profile.tools,
      model: `${this.profile.id}-specialist`
    };
  }

  analyze(query: string) {
    return this.ask(query, 'analyze');
  }

  plan(query: string) {
    return this.ask(query, 'plan');
  }

  verify(query: string) {
    return this.ask(query, 'verify');
  }

  review(query: string) {
    return this.ask(query, 'review');
  }

  private fallbackWorkflow(query: string, mode: string): string {
    return [
      `${this.profile.label} ${mode} workflow for: "${query}"`,
      '',
      'I did not find a direct local knowledge-base record for this exact request, so I am returning the domain workflow instead of inventing facts.',
      '',
      'Workflow:',
      ...this.profile.workflows.map(step => `- ${step}`),
      '',
      'Guardrails:',
      ...this.profile.guardrails.map(rule => `- ${rule}`)
    ].join('\n');
  }

  private async answerFromDomainKnowledge(query: string, mode: string): Promise<{ response: string; sources: string[] } | undefined> {
    if (!this.documentStore) {
      return undefined;
    }

    const searchQuery = `${query} ${this.profile.id} ${this.profile.label}`;
    const results = await this.documentStore.searchKeyword(searchQuery, 25);
    const domainResults = results
      .filter(result => this.isDomainChunk(result.chunk.metadata.source || '', result.chunk.content))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    if (domainResults.length === 0) {
      return undefined;
    }

    const sources = Array.from(new Set(domainResults.map(result => result.chunk.metadata.source || result.chunk.metadata.title || this.profile.defaultSources[0])));
    const context = domainResults.map(result => result.chunk.content.trim()).join('\n\n---\n\n');

    return {
      response: [
        `From the ${this.profile.label} local knowledge base (${mode}):`,
        '',
        context,
        '',
        'Guardrails:',
        ...this.profile.guardrails.map(rule => `- ${rule}`),
        '',
        'Sources:',
        ...sources.map(source => `- ${source}`)
      ].join('\n'),
      sources
    };
  }

  private isDomainChunk(source: string, content: string): boolean {
    const normalizedSource = source.toLowerCase().replace(/\\/g, '/');
    const normalizedContent = content.toLowerCase();
    return normalizedSource.includes(`knowledge-base-public/${this.profile.id}/`) ||
      normalizedContent.includes(`domain: ${this.profile.id}`);
  }
}
