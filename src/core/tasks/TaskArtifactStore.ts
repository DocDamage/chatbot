import fs from 'node:fs';
import path from 'node:path';

export interface ChatTaskArtifact {
  name: string;
  path: string;
  url: string;
  mimeType: string;
  kind: 'game' | 'spreadsheet' | 'chart' | 'document' | 'supporting-data';
}

export class TaskArtifactStore {
  readonly root: string;
  private readonly workspaceRoot: string;

  constructor(workspaceRoot = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.root = path.join(this.workspaceRoot, 'data', 'chat-task-artifacts');
    fs.mkdirSync(this.root, { recursive: true });
  }

  write(
    sessionId: string,
    fileName: string,
    content: string | Buffer,
    kind: ChatTaskArtifact['kind'],
    mimeType: string
  ): ChatTaskArtifact {
    const safeSessionId = this.safeSegment(sessionId, 'session');
    const safeFileName = this.safeFileName(fileName);
    const directory = path.join(this.root, safeSessionId);
    fs.mkdirSync(directory, { recursive: true });
    const artifactPath = path.join(directory, safeFileName);
    fs.writeFileSync(artifactPath, content);

    return {
      name: safeFileName,
      path: path.relative(this.workspaceRoot, artifactPath).replace(/\\/g, '/'),
      url: `/api/task-artifacts/${encodeURIComponent(safeSessionId)}/${encodeURIComponent(safeFileName)}`,
      mimeType,
      kind
    };
  }

  resolve(sessionId: string, fileName: string): string | undefined {
    const safeSessionId = this.safeSegment(sessionId, 'session');
    const safeFileName = this.safeFileName(fileName);
    const candidate = path.resolve(this.root, safeSessionId, safeFileName);
    const expectedRoot = path.resolve(this.root, safeSessionId);
    if (!candidate.startsWith(`${expectedRoot}${path.sep}`) || !fs.existsSync(candidate)) {
      return undefined;
    }
    return candidate;
  }

  private safeSegment(value: string, fallback: string): string {
    return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || fallback;
  }

  private safeFileName(value: string): string {
    const extension = path.extname(value).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12);
    const base = path.basename(value, path.extname(value));
    return `${this.safeSegment(base, 'artifact').slice(0, 80)}${extension}`;
  }
}
