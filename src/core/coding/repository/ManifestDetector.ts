import * as fs from 'fs';
import * as path from 'path';

export interface ManifestRecord { path: string; kind: string; data?: Record<string, unknown>; parseError?: string; }

const JSON_MANIFESTS = new Set(['package.json', 'tsconfig.json', 'jsconfig.json', 'global.json']);

export class ManifestDetector {
  constructor(private readonly workspaceRoot: string) {}

  inspect(files: string[]): ManifestRecord[] {
    return files.filter(file => this.isManifest(file)).map(file => {
      const absolute = path.resolve(this.workspaceRoot, file);
      const kind = path.basename(file).toLowerCase();
      if (!JSON_MANIFESTS.has(kind)) return { path: file.replace(/\\/g, '/'), kind };
      try {
        const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8')) as Record<string, unknown>;
        return { path: file.replace(/\\/g, '/'), kind, data: parsed };
      } catch (error: any) {
        return { path: file.replace(/\\/g, '/'), kind, parseError: error.message };
      }
    });
  }

  private isManifest(file: string): boolean {
    const name = path.basename(file).toLowerCase();
    return JSON_MANIFESTS.has(name) || /^(cargo|go\.mod|go\.sum|go\.work|pyproject|requirements.*|setup\.py|pom\.xml|build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?|package\.swift|cmakelists\.txt|meson\.build|project\.godot|docker-compose\.ya?ml|pnpm-workspace\.yaml|.*\.sln|.*\.csproj|.*\.fsproj|.*\.lock)$/.test(name);
  }
}
