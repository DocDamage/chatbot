import * as fs from 'fs';
import * as path from 'path';

export interface WorkspaceInstruction { path: string; scope: string; content: string; precedence: number; trustedForPolicy: false; }

const INSTRUCTION_NAMES = ['AGENTS.md', 'CLAUDE.md', '.cursorrules', '.github/copilot-instructions.md', 'CONTRIBUTING.md', 'README.md'];

export class WorkspaceInstructionResolver {
  constructor(private readonly workspaceRoot: string) {}

  resolve(files: string[], targetPath?: string): WorkspaceInstruction[] {
    const target = targetPath ? path.resolve(this.workspaceRoot, targetPath) : this.workspaceRoot;
    const candidates = files.filter(file => INSTRUCTION_NAMES.includes(file.replace(/\\/g, '/')) || INSTRUCTION_NAMES.some(name => file.replace(/\\/g, '/').endsWith(`/${name}`)));
    return candidates
      .map(file => {
        const absolute = path.resolve(this.workspaceRoot, file);
        const scope = path.dirname(absolute);
        if (!(target === scope || target.startsWith(`${scope}${path.sep}`))) return undefined;
        try {
          return { path: file.replace(/\\/g, '/'), scope, content: fs.readFileSync(absolute, 'utf8'), precedence: scope.length, trustedForPolicy: false as const };
        } catch { return undefined; }
      })
      .filter((value): value is WorkspaceInstruction => Boolean(value))
      .sort((a, b) => a.precedence - b.precedence);
  }
}
