export type CodeContextKind =
  | 'user_request'
  | 'source_file'
  | 'related_test'
  | 'type_definition'
  | 'package_script'
  | 'architecture_note'
  | 'past_fix'
  | 'general_knowledge';

export interface CodeContextItem {
  kind: CodeContextKind;
  label: string;
  content: string;
  estimatedTokens: number;
}

export interface CodeContextInput {
  userRequest: string;
  fileExcerpts?: Array<{ path: string; content: string }>;
  relatedTests?: Array<{ path: string; content: string }>;
  typeDefinitions?: Array<{ path: string; content: string }>;
  packageScripts?: Record<string, string>;
  architectureNotes?: string[];
  pastFixes?: string[];
  generalKnowledge?: string[];
}

export interface CodeContext {
  tokenBudget: number;
  estimatedTokens: number;
  items: CodeContextItem[];
}

export class CodeContextBudgeter {
  constructor(private readonly tokenBudget: number = 4000) {}

  build(input: CodeContextInput): CodeContext {
    const candidates: CodeContextItem[] = [
      this.item('user_request', 'User request', input.userRequest),
      ...(input.fileExcerpts || []).map(file => this.item('source_file', file.path, file.content)),
      ...(input.relatedTests || []).map(file => this.item('related_test', file.path, file.content)),
      ...(input.typeDefinitions || []).map(file => this.item('type_definition', file.path, file.content)),
      ...Object.entries(input.packageScripts || {}).map(([name, command]) => this.item('package_script', name, `${name}: ${command}`)),
      ...(input.architectureNotes || []).map((note, index) => this.item('architecture_note', `architecture-${index + 1}`, note)),
      ...(input.pastFixes || []).map((fix, index) => this.item('past_fix', `past-fix-${index + 1}`, fix)),
      ...(input.generalKnowledge || []).map((knowledge, index) => this.item('general_knowledge', `knowledge-${index + 1}`, knowledge))
    ];

    const selected: CodeContextItem[] = [];
    let used = 0;
    for (let index = 0; index < candidates.length; index++) {
      const candidate = candidates[index];
      const remaining = this.tokenBudget - used;
      if (remaining <= 0) break;
      const remainingCandidates = candidates.length - index - 1;
      const maxForThisItem = Math.max(1, remaining - remainingCandidates);

      if (candidate.estimatedTokens <= maxForThisItem) {
        selected.push(candidate);
        used += candidate.estimatedTokens;
      } else if (maxForThisItem > 0) {
        const trimmed = this.trimToTokens(candidate.content, maxForThisItem);
        const trimmedItem = this.item(candidate.kind, candidate.label, trimmed);
        selected.push(trimmedItem);
        used += trimmedItem.estimatedTokens;
      }
    }

    return {
      tokenBudget: this.tokenBudget,
      estimatedTokens: used,
      items: selected
    };
  }

  private item(kind: CodeContextKind, label: string, content: string): CodeContextItem {
    return {
      kind,
      label,
      content,
      estimatedTokens: this.estimateTokens(content)
    };
  }

  private estimateTokens(content: string): number {
    return Math.max(1, Math.ceil(content.length / 4));
  }

  private trimToTokens(content: string, tokens: number): string {
    return content.slice(0, Math.max(0, tokens * 4));
  }
}
