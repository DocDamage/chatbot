import { ApprovedRepositoryGateway } from '../security/ApprovedRepositoryGateway';
import { ContextEvidence } from '../types';
import { RepositorySnapshot } from '../repository/RepositoryIntelligence';
import { SymbolIndex } from '../index/SymbolIndex';

export interface RetrievalRequest { query: string; files?: string[]; symbols?: string[]; diagnostics?: Array<{ file?: string; message: string }>; maxItems?: number; }

export class StructuralRetriever {
  constructor(
    workspaceRoot: string,
    private readonly snapshot: RepositorySnapshot,
    private readonly index: SymbolIndex,
    private readonly gateway = new ApprovedRepositoryGateway(workspaceRoot)
  ) {}

  retrieve(request: RetrievalRequest): ContextEvidence[] {
    const maxItems = request.maxItems || 24;
    const results: ContextEvidence[] = [];
    const addFile = (file: string, kind: ContextEvidence['kind'], reason: string, confidence: number) => {
      const existing = results.find(item => item.path === file);
      if (existing) {
        if (confidence > existing.confidence) Object.assign(existing, { kind, reason, confidence });
        return;
      }
      try {
        const record = this.snapshot.files.find(item => item.path === file);
        if (!record || record.binary) return;
        const content = this.gateway.readTextFile(file, 24000).content;
        results.push({ kind, label: file, content, path: file, authority: 'repository', reason, confidence });
      } catch { /* files can disappear between snapshot and retrieval */ }
    };
    for (const file of request.files || []) addFile(file, 'source', 'user-mentioned path', 1);
    for (const diagnostic of request.diagnostics || []) if (diagnostic.file) addFile(diagnostic.file, 'diagnostic', `diagnostic: ${diagnostic.message}`, 1);
    for (const symbol of request.symbols || []) {
      for (const match of this.index.findDefinitions(symbol)) addFile(match.file, 'symbol', `definition of ${symbol}`, match.confidence);
      for (const match of this.index.findReferences(symbol).slice(0, 5)) addFile(match.file, 'symbol', `reference to ${symbol}`, match.confidence * 0.85);
    }
    for (const instruction of this.snapshot.instructions) {
      if (!results.some(item => item.path === instruction.path)) results.push({ kind: 'instruction', label: instruction.path, content: instruction.content, path: instruction.path, authority: 'repository', reason: 'applicable repository instruction', confidence: 1 });
    }
    for (const manifest of this.snapshot.manifests) addFile(manifest.path, 'dependency', `manifest for detected project state (${manifest.kind})`, 0.82);
    for (const plan of this.snapshot.commandPlans.filter(command => command.supported)) {
      const sourceFiles = this.snapshot.files.filter(file => file.language === plan.source || file.path.toLowerCase().includes(plan.source.toLowerCase())).slice(0, 2);
      for (const file of sourceFiles) addFile(file.path, 'dependency', `supports ${plan.executable} ${plan.purpose} command`, 0.72);
    }
    const relatedFiles = new Set((request.files || []).map(file => file.replace(/\\/g, '/')));
    for (const symbol of request.symbols || []) for (const match of this.index.findDefinitions(symbol)) relatedFiles.add(match.file);
    for (const relationship of this.snapshot.relationships) {
      if (!relatedFiles.has(relationship.from) && !relatedFiles.has(relationship.to)) continue;
      const related = relatedFiles.has(relationship.from) ? relationship.to : relationship.from;
      if (this.snapshot.files.some(file => file.path === related)) addFile(related, relationship.kind === 'tests' ? 'test' : relationship.kind === 'depends_on' ? 'dependency' : 'source', `${relationship.kind} relationship`, Math.min(0.88, relationship.confidence));
    }
    for (const file of this.snapshot.files.filter(item => this.isTest(item.path)).slice(0, 8)) addFile(file.path, 'test', 'related test convention', 0.65);
    const terms = request.query.toLowerCase().split(/[^a-z0-9_$-]+/).filter(term => term.length > 2);
    for (const file of this.snapshot.files) {
      if (!terms.length) continue;
      const pathScore = terms.filter(term => file.path.toLowerCase().includes(term)).length;
      let contentScore = 0;
      if (!file.binary && file.size <= 200000 && this.isSearchable(file.path) && pathScore === 0) {
        try {
          const content = this.gateway.readTextFile(file.path, 24000).content.toLowerCase();
          contentScore = terms.filter(term => content.includes(term)).length;
        } catch { /* stale files are ignored */ }
      }
      const score = pathScore + contentScore;
      if (score) addFile(file.path, 'source', `${pathScore ? 'path' : 'content'} matches request (${score} term${score === 1 ? '' : 's'})`, Math.min(0.8, score / terms.length));
    }
    return results.sort((a, b) => b.confidence - a.confidence).slice(0, maxItems);
  }

  private isTest(file: string): boolean { return /(^|\/)(__tests__|tests?)(\/|$)|\.(test|spec)\./i.test(file); }

  private isSearchable(file: string): boolean {
    return /\.(?:c|cc|cpp|cxx|cs|css|fs|fsi|fsx|go|h|hh|hpp|hxx|html?|java|js|jsx|json|kt|kts|lua|m|md|mm|mjs|py|pyi|rs|scss|sh|sql|swift|toml|ts|tsx|txt|xml|yaml|yml)$/i.test(file)
      || /(^|\/)(?:Dockerfile|Makefile|CMakeLists\.txt)$/i.test(file);
  }
}
