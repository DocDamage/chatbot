import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebsiteWorkspaceService } from './WebsiteWorkspaceService';

describe('WebsiteWorkspaceService', () => {
  it('normalizes a project and escapes preview content', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-website-'));
    try {
      const service = new WebsiteWorkspaceService(workspace);
      const result = service.save({ name: '<site>', pages: [{ slug: 'Home page', title: '<Home>', blocks: [{ type: 'hero', title: '<Hello>', body: 'Safe' }] }] });
      expect(result.project.pages[0].slug).toBe('home-page');
      expect(result.html).toContain('&lt;Hello&gt;');
      expect(service.load()?.name).toBe('<site>');
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
