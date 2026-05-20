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
});
