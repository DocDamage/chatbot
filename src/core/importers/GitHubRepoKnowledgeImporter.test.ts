import { GitHubRepoKnowledgeImporter } from './GitHubRepoKnowledgeImporter';

describe('GitHubRepoKnowledgeImporter', () => {
  it('imports repository metadata into a wiki page without copying source files', async () => {
    const write = jest.fn().mockReturnValue({ slug: 'repo-imports/example-repo' });
    const fetcher = jest.fn(async (url: string) => {
      if (url.endsWith('/repos/example/repo')) {
        return {
          data: {
            name: 'repo',
            description: 'Useful repo',
            default_branch: 'main',
            language: 'TypeScript',
            topics: ['rag'],
            license: { spdx_id: 'MIT' }
          }
        };
      }
      if (url.includes('/git/trees/')) {
        return {
          data: {
            tree: [
              { path: 'README.md', type: 'blob', size: 100 },
              { path: 'src/index.ts', type: 'blob', size: 200 },
              { path: 'src/index.test.ts', type: 'blob', size: 200 }
            ]
          }
        };
      }
      if (url.endsWith('/readme')) {
        return { data: { content: Buffer.from('# Repo\nShort readme').toString('base64') } };
      }
      throw new Error(`Unhandled URL: ${url}`);
    });

    const importer = new GitHubRepoKnowledgeImporter({
      wiki: { write } as any,
      fetcher
    });
    const result = await importer.importRepo({ owner: 'example', repo: 'repo', category: 'test' });

    expect(result.repo).toBe('example/repo');
    expect(result.files.map(file => file.type)).toContain('source');
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      slug: 'repo-imports/example-repo',
      content: expect.stringContaining('It does not copy source code')
    }));
  });

  it('imports recommended repositories with RAG ingestion and handles API warning fallbacks', async () => {
    const write = jest.fn().mockReturnValue({ slug: 'repo-imports/mock-repo' });
    const addText = jest.fn().mockResolvedValue([{ id: 'chunk_1' }, { id: 'chunk_2' }]);

    const fetcher = jest.fn(async (url: string) => {
      if (url.endsWith('/readme')) {
        throw new Error('README not found');
      }
      if (url.includes('/git/trees/')) {
        return {
          data: {
            tree: [
              { path: 'config.yaml', type: 'blob', size: 50 },
              { path: 'LICENSE', type: 'blob', size: 1000 },
              { path: 'unknown.xyz', type: 'blob', size: 10 }
            ]
          }
        };
      }
      if (url.includes('/repos/')) {
        return {
          data: {
            name: 'sample-repo',
            description: 'Sample repository',
            default_branch: 'main',
            language: 'Python',
            topics: ['graph', 'search'],
            license: { spdx_id: 'Apache-2.0' }
          }
        };
      }
      throw new Error(`Unhandled URL: ${url}`);
    });

    const importer = new GitHubRepoKnowledgeImporter({
      wiki: { write } as any,
      documentManager: { addText } as any,
      fetcher,
      token: 'fake_gh_token'
    });

    const results = await importer.importRecommended({ ingestToRag: true, limit: 2 });
    expect(results.length).toBe(2);
    expect(results[0].chunks).toBe(2);
    expect(results[0].warnings.length).toBeGreaterThan(0);
    expect(results[0].files.some(f => f.type === 'config')).toBe(true);
    expect(results[0].files.some(f => f.type === 'license')).toBe(true);
  });
});
