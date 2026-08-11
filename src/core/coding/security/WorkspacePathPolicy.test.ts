import fs from 'fs';
import os from 'os';
import path from 'path';
import { CodingAgent } from '../../agents/CodingAgent';
import { createRepoTools } from '../../tools/RepoTools';
import { isSensitiveWorkspacePath } from './WorkspacePathPolicy';

describe('WorkspacePathPolicy', () => {
  it('classifies credential directories and secret files', () => {
    expect(isSensitiveWorkspacePath('API Keys/ChatGPT API Key.txt')).toBe(true);
    expect(isSensitiveWorkspacePath('.env')).toBe(true);
    expect(isSensitiveWorkspacePath('src/config.ts')).toBe(false);
  });

  it('keeps repository discovery and editing away from credential material', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-secret-policy-'));
    try {
      fs.mkdirSync(path.join(root, 'API Keys'), { recursive: true });
      fs.writeFileSync(path.join(root, 'API Keys', 'provider.txt'), 'secret');
      fs.writeFileSync(path.join(root, '.env'), 'OPENAI_API_KEY=secret');
      fs.writeFileSync(path.join(root, 'src.ts'), 'export const safe = true;');
      const tool = createRepoTools(root).find(candidate => candidate.id === 'read_project_file');
      const result = await tool?.execute({ path: 'API Keys/provider.txt' });
      expect(result?.success).toBe(false);
      expect(new CodingAgent({ workspaceRoot: root }).getRepositorySnapshot().files.map(file => file.path)).toEqual(['src.ts']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
