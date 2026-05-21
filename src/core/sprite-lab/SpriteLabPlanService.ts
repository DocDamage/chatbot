import * as path from 'path';
import { Database } from '../database/Database';
import { LocalToolService } from '../local-tools/LocalToolService';

export type SpriteBackendSlug = 'aseprite' | 'libresprite' | 'pixelorama' | 'internal_sharp' | 'internal_python';

export interface SpriteBackendStatus {
  slug: SpriteBackendSlug;
  label: string;
  available: boolean;
  role: 'primary' | 'fallback' | 'internal';
  detail: string;
}

export interface SpriteWorkflowPlan {
  workflow: 'spritesheet_export' | 'frame_slice' | 'palette_extract' | 'manifest_generate';
  selectedBackend: SpriteBackendStatus;
  fallbackChain: SpriteBackendStatus[];
  inputPath: string;
  outputTarget: string;
  notes: string[];
}

const fallbackOrder: SpriteBackendSlug[] = ['aseprite', 'libresprite', 'pixelorama', 'internal_sharp', 'internal_python'];

export class SpriteLabPlanService {
  constructor(
    private readonly database?: Database,
    private readonly workspaceRoot: string = process.cwd()
  ) {}

  async getStatus(): Promise<{ backends: SpriteBackendStatus[]; selected: SpriteBackendStatus }> {
    const executables = await new LocalToolService(this.database, this.workspaceRoot).listExecutables();
    const backends = fallbackOrder.map(slug => {
      const internal = slug === 'internal_sharp' || slug === 'internal_python';
      const detected = executables.some(item => item.toolSlug === slug && item.detected);
      return {
        slug,
        label: this.labelFor(slug),
        available: internal || detected,
        role: slug === 'aseprite' ? 'primary' : internal ? 'internal' : 'fallback',
        detail: internal
          ? 'Internal backend available through server dependencies.'
          : detected
            ? 'Detected locally. User approval is required before any external tool is started.'
            : 'Not detected yet.'
      } satisfies SpriteBackendStatus;
    });

    const selected = backends.find(backend => backend.available) || backends[backends.length - 1];
    return { backends, selected };
  }

  async planWorkflow(input: {
    workflow: SpriteWorkflowPlan['workflow'];
    inputPath: string;
    outputTarget?: string;
  }): Promise<SpriteWorkflowPlan> {
    const inputPath = this.resolveWorkspacePath(input.inputPath);
    const outputTarget = this.resolveWorkspacePath(input.outputTarget || this.defaultOutputTarget(input.workflow, inputPath));
    const status = await this.getStatus();

    return {
      workflow: input.workflow,
      selectedBackend: status.selected,
      fallbackChain: status.backends,
      inputPath,
      outputTarget,
      notes: [
        'This service only prepares Sprite Lab workflow intent.',
        'External tool startup stays behind the guarded LocalToolRunner and user approval flow.',
        'Fallback order is Aseprite, LibreSprite, Pixelorama, internal Sharp, then internal Python.'
      ]
    };
  }

  private resolveWorkspacePath(requestedPath: string): string {
    const resolved = path.resolve(this.workspaceRoot, requestedPath);
    const relative = path.relative(this.workspaceRoot, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Sprite Lab paths must stay inside the workspace.');
    }
    return resolved;
  }

  private defaultOutputTarget(workflow: SpriteWorkflowPlan['workflow'], inputPath: string): string {
    const parsed = path.parse(inputPath);
    const base = path.join('data', 'sprite-lab', parsed.name);
    switch (workflow) {
      case 'spritesheet_export': return `${base}.sheet.png`;
      case 'frame_slice': return path.join(base, 'frames');
      case 'palette_extract': return `${base}.palette.json`;
      case 'manifest_generate': return `${base}.manifest.json`;
    }
  }

  private labelFor(slug: SpriteBackendSlug): string {
    switch (slug) {
      case 'aseprite': return 'Aseprite';
      case 'libresprite': return 'LibreSprite';
      case 'pixelorama': return 'Pixelorama';
      case 'internal_sharp': return 'Internal Sharp PNG Tools';
      case 'internal_python': return 'Internal Python Image Tools';
    }
  }
}
