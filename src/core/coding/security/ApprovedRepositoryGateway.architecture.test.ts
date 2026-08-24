import fs from 'fs';
import os from 'os';
import path from 'path';
import { ApprovedRepositoryGateway } from './ApprovedRepositoryGateway';

describe('ApprovedRepositoryGateway architecture metadata', () => {
  it('returns only approved-root-relative file metadata', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-metadata-'));
    try {
      fs.mkdirSync(path.join(root, 'src'));
      fs.writeFileSync(path.join(root, 'src', 'index.ts'), 'export const value = 1;');
      const gateway = new ApprovedRepositoryGateway(root);

      expect(gateway.describePath('src/index.ts')).toEqual({
        path: 'src/index.ts',
        size: 23,
        kind: 'file'
      });
      expect(() => gateway.describePath('../outside.ts')).toThrow(/outside the workspace/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
