import axios from 'axios';
import { LocalKnowledgeWiki } from '../wiki/LocalKnowledgeWiki';
import { DocumentManager } from '../rag/DocumentManager';

export interface RepoImportTarget {
  owner: string;
  repo: string;
  branch?: string;
  category?: string;
  notes?: string;
}

export interface RepoImportResult {
  repo: string;
  slug: string;
  title: string;
  files: Array<{ path: string; type: string; size?: number }>;
  topics: string[];
  language?: string;
  license?: string;
  defaultBranch: string;
  wikiPage?: string;
  chunks?: number;
  warnings: string[];
}

export const recommendedRepoImports: RepoImportTarget[] = [
  { owner: 'safishamsi', repo: 'graphify', category: 'graph-indexing', notes: 'Knowledge graph and code/doc graph indexing inspiration.' },
  { owner: 'opensemanticsearch', repo: 'open-semantic-entity-search-api', category: 'entity-linking', notes: 'Entity extraction, normalization, and semantic search concepts.' },
  { owner: 'SemanticMediaWiki', repo: 'SemanticMediaWiki', category: 'semantic-wiki', notes: 'Typed properties and queryable wiki knowledge model.' },
  { owner: 'gyorilab', repo: 'indra', category: 'claim-graphs', notes: 'Evidence-backed scientific claim and causal graph assembly.' },
  { owner: 'behzad-njf', repo: 'InsightAI', category: 'safe-db-qa', notes: 'Read-only SQL, schema-aware answers, and grounded database summaries.' },
  { owner: 'Darsh-999', repo: 'Multi-Agent-SQL-Generator', category: 'safe-db-qa', notes: 'Schema grouping and SQL agent workflow ideas.' },
  { owner: 'vLannaAi', repo: 'noy-db', category: 'private-memory', notes: 'Local/private document and memory storage ideas.' },
  { owner: 'turnleafbook7768', repo: 'db9-wiki', category: 'local-wiki', notes: 'Agent-native markdown wiki pattern.' },
  { owner: 'zxt-01', repo: 'Memory-Like-A-Tree', category: 'private-memory', notes: 'Tree-like memory lifecycle and confidence concepts.' },
  { owner: 'DocDamage', repo: 'RepoCortex', branch: 'ci-fixes-attempt', category: 'repo-governance', notes: 'Repo intelligence, governance, golden tasks, and operator cockpit patterns.' }
];

type Fetcher = (url: string, config?: Record<string, any>) => Promise<{ data: any }>;

export class GitHubRepoKnowledgeImporter {
  constructor(
    private readonly options: {
      wiki?: LocalKnowledgeWiki;
      documentManager?: DocumentManager;
      fetcher?: Fetcher;
      token?: string;
    } = {}
  ) {}

  async importRecommended(options: { ingestToRag?: boolean; limit?: number } = {}): Promise<RepoImportResult[]> {
    const targets = recommendedRepoImports.slice(0, options.limit || recommendedRepoImports.length);
    const results: RepoImportResult[] = [];
    for (const target of targets) {
      results.push(await this.importRepo(target, { ingestToRag: options.ingestToRag }));
    }
    return results;
  }

  async importRepo(target: RepoImportTarget, options: { ingestToRag?: boolean } = {}): Promise<RepoImportResult> {
    const fetcher = this.options.fetcher || axios.get;
    const headers = this.options.token ? { Authorization: `Bearer ${this.options.token}` } : undefined;
    const warnings: string[] = [];
    const repoFullName = `${target.owner}/${target.repo}`;

    const repoResponse = await fetcher(`https://api.github.com/repos/${repoFullName}`, { headers });
    const repo = repoResponse.data;
    const defaultBranch = target.branch || repo.default_branch || 'main';

    let treeItems: Array<{ path: string; type: string; size?: number }> = [];
    try {
      const treeResponse = await fetcher(
        `https://api.github.com/repos/${repoFullName}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
        { headers }
      );
      treeItems = (treeResponse.data.tree || [])
        .filter((item: any) => item.type === 'blob')
        .map((item: any) => ({ path: item.path, type: this.classifyPath(item.path), size: item.size }))
        .slice(0, 400);
    } catch (error: any) {
      warnings.push(`Could not fetch repository tree: ${error.message}`);
    }

    let readme = '';
    try {
      const readmeResponse = await fetcher(`https://api.github.com/repos/${repoFullName}/readme`, { headers });
      readme = Buffer.from(readmeResponse.data.content || '', 'base64').toString('utf8').slice(0, 4000);
    } catch (error: any) {
      warnings.push(`Could not fetch README: ${error.message}`);
    }

    const result: RepoImportResult = {
      repo: repoFullName,
      slug: `repo-imports/${target.owner}-${target.repo}`,
      title: `${repo.name || target.repo} Repo Import`,
      files: treeItems,
      topics: repo.topics || [],
      language: repo.language,
      license: repo.license?.spdx_id,
      defaultBranch,
      warnings
    };

    const pageContent = this.buildWikiPage(target, result, repo.description || '', readme);
    if (this.options.wiki) {
      const page = this.options.wiki.write({
        slug: result.slug,
        title: result.title,
        content: pageContent,
        frontmatter: {
          domain: 'knowledge-os',
          source: `https://github.com/${repoFullName}`,
          source_type: 'github_repository',
          authority: 'external',
          category: target.category || 'repo-import',
          license: result.license || 'unknown'
        }
      });
      result.wikiPage = page.slug;
    }

    if (options.ingestToRag && this.options.documentManager) {
      const chunks = await this.options.documentManager.addText(pageContent, {
        source: `github:${repoFullName}`,
        title: result.title,
        domain: 'knowledge-os',
        sourceType: 'github_repository',
        authority: 'external',
        trustScore: 0.72,
        repo: repoFullName,
        category: target.category || 'repo-import'
      }, {
        generateEmbeddings: false
      });
      result.chunks = chunks.length;
    }

    return result;
  }

  private buildWikiPage(target: RepoImportTarget, result: RepoImportResult, description: string, readme: string): string {
    const fileSummary = result.files.reduce<Record<string, number>>((acc, file) => {
      acc[file.type] = (acc[file.type] || 0) + 1;
      return acc;
    }, {});
    const notableFiles = result.files
      .filter(file => /readme|package\.json|pyproject|requirements|docker|mcp|schema|eval|test|docs?\//i.test(file.path))
      .slice(0, 40);

    return [
      `# ${result.title}`,
      '',
      `Repository: https://github.com/${result.repo}`,
      `Default branch: ${result.defaultBranch}`,
      `Primary language: ${result.language || 'unknown'}`,
      `License: ${result.license || 'unknown'}`,
      `Category: ${target.category || 'repo-import'}`,
      '',
      '## Why This Matters',
      target.notes || description || 'Imported as a candidate architecture/source pattern for the chatbot knowledge system.',
      '',
      '## File Type Summary',
      ...Object.entries(fileSummary).map(([type, count]) => `- ${type}: ${count}`),
      '',
      '## Notable Files',
      ...(notableFiles.length ? notableFiles.map(file => `- ${file.path}`) : ['- No notable files detected from tree metadata.']),
      '',
      '## README Excerpt',
      readme ? readme.slice(0, 3000) : 'README was not available from the GitHub API.',
      '',
      '## Import Notes',
      '- This import stores repository metadata and short README excerpts only.',
      '- It does not copy source code into the chatbot knowledge base.',
      '- Review repository licenses before using implementation details directly.'
    ].join('\n');
  }

  private classifyPath(filePath: string): string {
    const lower = filePath.toLowerCase();
    if (lower.endsWith('.md') || lower.includes('/docs/')) return 'docs';
    if (/\.(test|spec)\.(ts|tsx|js|jsx|py|rb)$/.test(lower) || lower.includes('/test')) return 'tests';
    if (lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml') || lower.endsWith('.toml')) return 'config';
    if (/\.(ts|tsx|js|jsx|py|rb|php|java|go|rs)$/.test(lower)) return 'source';
    if (/license|copying/.test(lower)) return 'license';
    return 'other';
  }
}
