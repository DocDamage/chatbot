import * as fs from 'fs';
import * as path from 'path';
import { Database } from '../database/Database';
import { LocalToolService, ExecutedLocalToolRun, PlannedLocalToolRun } from '../local-tools/LocalToolService';

export type ExternalSpriteBackendSlug = 'aseprite' | 'libresprite' | 'pixelorama';
export type ExternalSpriteWorkflow = 'spritesheet_export' | 'frame_slice' | 'manifest_generate';

export interface SpriteExternalToolOptions {
  sheetType?: 'horizontal' | 'vertical' | 'rows' | 'columns' | 'packed';
  dataFormat?: 'json-array' | 'json-hash';
  trim?: boolean;
  trimSprite?: boolean;
  ignoreEmpty?: boolean;
  mergeDuplicates?: boolean;
  splitLayers?: boolean;
  allLayers?: boolean;
  splitTags?: boolean;
  splitSlices?: boolean;
  splitGrid?: boolean;
  extrude?: boolean;
  tag?: string;
  frameRange?: string;
  layerNames?: string[];
  ignoreLayerNames?: string[];
}

export interface SpriteExternalToolInput {
  backend: ExternalSpriteBackendSlug;
  workflow: ExternalSpriteWorkflow;
  inputPath: string;
  outputTarget?: string;
  cwd?: string;
  approvedByUser?: boolean;
  options?: SpriteExternalToolOptions;
}

export interface SpriteExternalToolCommand {
  backend: ExternalSpriteBackendSlug;
  workflow: ExternalSpriteWorkflow;
  toolSlug: ExternalSpriteBackendSlug;
  args: string[];
  cwd: string;
  inputPath: string;
  outputTarget: string;
  outputFiles: string[];
  outputDirectories: string[];
  notes: string[];
}

export interface PlannedSpriteExternalToolRun extends PlannedLocalToolRun {
  adapter: SpriteExternalToolCommand;
}

export interface ExecutedSpriteExternalToolRun extends ExecutedLocalToolRun {
  adapter: SpriteExternalToolCommand;
}

interface OutputLayout {
  inputPath: string;
  outputTarget: string;
  sheetPath: string;
  dataPath: string;
  framePattern: string;
  frameDir: string;
  manifestPath: string;
}

export class SpriteExternalToolAdapter {
  constructor(
    private readonly database?: Database,
    private readonly workspaceRoot: string = process.cwd()
  ) {}

  buildCommand(input: SpriteExternalToolInput): SpriteExternalToolCommand {
    this.assertBackend(input.backend);
    this.assertWorkflow(input.workflow);
    if (input.backend === 'pixelorama') {
      throw new Error('Pixelorama external execution is not enabled yet because its CLI export arguments vary by build. Use internal Sprite Lab actions or Aseprite/LibreSprite for approved CLI export.');
    }

    const cwd = this.resolveWorkspacePath(input.cwd || '.');
    const layout = this.resolveOutputLayout(input.workflow, input.inputPath, input.outputTarget);
    return this.buildAsepriteCompatibleCommand(input.backend, input.workflow, layout, cwd, input.options || {});
  }

  async planRun(input: SpriteExternalToolInput): Promise<PlannedSpriteExternalToolRun> {
    const adapter = this.buildCommand(input);
    const plan = await new LocalToolService(this.database, this.workspaceRoot).planRun({
      toolSlug: adapter.toolSlug,
      args: adapter.args,
      cwd: path.relative(this.workspaceRoot, adapter.cwd) || '.',
      riskLevel: 'medium',
      approvedByUser: input.approvedByUser === true
    });
    return { ...plan, adapter };
  }

  async run(input: SpriteExternalToolInput): Promise<ExecutedSpriteExternalToolRun> {
    const adapter = this.buildCommand(input);
    for (const outputDir of adapter.outputDirectories) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const result = await new LocalToolService(this.database, this.workspaceRoot).planAndExecute({
      toolSlug: adapter.toolSlug,
      args: adapter.args,
      cwd: path.relative(this.workspaceRoot, adapter.cwd) || '.',
      riskLevel: 'medium',
      approvedByUser: input.approvedByUser === true
    });
    return { ...result, adapter };
  }

  private buildAsepriteCompatibleCommand(
    backend: 'aseprite' | 'libresprite',
    workflow: ExternalSpriteWorkflow,
    layout: OutputLayout,
    cwd: string,
    options: SpriteExternalToolOptions
  ): SpriteExternalToolCommand {
    const args = this.baseAsepriteArgs(layout.inputPath, options);
    const outputFiles: string[] = [];
    const outputDirectories = new Set<string>();

    switch (workflow) {
      case 'spritesheet_export':
        args.push('--sheet', layout.sheetPath, '--data', layout.dataPath, '--format', options.dataFormat || 'json-array', '--sheet-type', options.sheetType || 'rows');
        this.appendAsepriteMetadataFlags(args);
        outputFiles.push(layout.sheetPath, layout.dataPath);
        outputDirectories.add(path.dirname(layout.sheetPath));
        outputDirectories.add(path.dirname(layout.dataPath));
        break;
      case 'frame_slice':
        args.push('--save-as', layout.framePattern);
        outputFiles.push(layout.framePattern);
        outputDirectories.add(layout.frameDir);
        break;
      case 'manifest_generate':
        args.push('--sheet', layout.sheetPath, '--data', layout.manifestPath, '--format', options.dataFormat || 'json-array', '--sheet-type', options.sheetType || 'rows');
        this.appendAsepriteMetadataFlags(args);
        outputFiles.push(layout.sheetPath, layout.manifestPath);
        outputDirectories.add(path.dirname(layout.sheetPath));
        outputDirectories.add(path.dirname(layout.manifestPath));
        break;
    }

    this.appendOptionalAsepriteFlags(args, options);

    return {
      backend,
      workflow,
      toolSlug: backend,
      args,
      cwd,
      inputPath: layout.inputPath,
      outputTarget: layout.outputTarget,
      outputFiles,
      outputDirectories: [...outputDirectories],
      notes: [
        `${backend} is started through LocalToolRunner only after explicit approval.`,
        'The adapter uses batch mode, fixed allowlisted flags, and no shell invocation.'
      ]
    };
  }

  private baseAsepriteArgs(inputPath: string, options: SpriteExternalToolOptions): string[] {
    const args = ['-b'];
    if (options.allLayers) args.push('--all-layers');
    if (options.splitLayers) args.push('--split-layers');
    if (options.splitGrid) args.push('--split-grid');
    for (const layerName of options.layerNames || []) args.push('--layer', layerName);
    for (const layerName of options.ignoreLayerNames || []) args.push('--ignore-layer', layerName);
    args.push(inputPath);
    if (options.tag) args.push('--tag', options.tag);
    if (options.frameRange) args.push('--frame-range', options.frameRange);
    return args;
  }

  private appendAsepriteMetadataFlags(args: string[]): void {
    args.push('--list-tags', '--list-slices', '--list-layers');
  }

  private appendOptionalAsepriteFlags(args: string[], options: SpriteExternalToolOptions): void {
    if (options.trim) args.push('--trim');
    if (options.trimSprite) args.push('--trim-sprite');
    if (options.ignoreEmpty) args.push('--ignore-empty');
    if (options.mergeDuplicates) args.push('--merge-duplicates');
    if (options.splitTags) args.push('--split-tags');
    if (options.splitSlices) args.push('--split-slices');
    if (options.extrude) args.push('--extrude');
  }

  private resolveOutputLayout(workflow: ExternalSpriteWorkflow, inputPath: string, outputTarget?: string): OutputLayout {
    const resolvedInput = this.resolveWorkspacePath(inputPath);
    const parsed = path.parse(resolvedInput);
    const defaultBase = path.join(this.workspaceRoot, 'data', 'sprite-lab', parsed.name);
    const requestedOutput = outputTarget ? this.resolveWorkspacePath(outputTarget) : this.defaultOutputTarget(workflow, defaultBase);
    const targetIsDirectory = !path.extname(requestedOutput);
    const outputBase = targetIsDirectory ? path.join(requestedOutput, parsed.name) : path.join(path.dirname(requestedOutput), path.parse(requestedOutput).name);
    const frameDir = targetIsDirectory ? requestedOutput : path.dirname(requestedOutput);

    return {
      inputPath: resolvedInput,
      outputTarget: requestedOutput,
      sheetPath: targetIsDirectory ? `${outputBase}.sheet.png` : this.withExtension(requestedOutput, '.png'),
      dataPath: targetIsDirectory ? `${outputBase}.sheet.json` : this.withExtension(requestedOutput, '.json'),
      framePattern: path.join(frameDir, `${parsed.name}-{frame000}.png`),
      frameDir,
      manifestPath: targetIsDirectory ? `${outputBase}.manifest.json` : this.withExtension(requestedOutput, '.manifest.json')
    };
  }

  private defaultOutputTarget(workflow: ExternalSpriteWorkflow, defaultBase: string): string {
    switch (workflow) {
      case 'spritesheet_export': return `${defaultBase}.sheet.png`;
      case 'frame_slice': return path.join(defaultBase, 'frames');
      case 'manifest_generate': return `${defaultBase}.manifest.json`;
    }
  }

  private withExtension(filePath: string, extension: string): string {
    return path.join(path.dirname(filePath), `${path.parse(filePath).name}${extension}`);
  }

  private resolveWorkspacePath(requestedPath: string): string {
    const resolved = path.resolve(this.workspaceRoot, requestedPath);
    const relative = path.relative(this.workspaceRoot, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Sprite external tool paths must stay inside the workspace.');
    }
    return resolved;
  }

  private assertBackend(backend: string): asserts backend is ExternalSpriteBackendSlug {
    if (!['aseprite', 'libresprite', 'pixelorama'].includes(backend)) {
      throw new Error(`Unsupported external sprite backend: ${backend}`);
    }
  }

  private assertWorkflow(workflow: string): asserts workflow is ExternalSpriteWorkflow {
    if (!['spritesheet_export', 'frame_slice', 'manifest_generate'].includes(workflow)) {
      throw new Error(`Unsupported external sprite workflow: ${workflow}`);
    }
  }
}
