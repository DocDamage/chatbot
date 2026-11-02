import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SpriteExternalToolAdapter } from './SpriteExternalToolAdapter';

describe('SpriteExternalToolAdapter', () => {
  let tempDir: string;
  let originalPixeloramaTemplate: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprite-adapter-test-'));
    fs.mkdirSync(path.join(tempDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'assets', 'hero.aseprite'), 'fake sprite', 'utf8');
    originalPixeloramaTemplate = process.env.PIXELORAMA_CLI_ARGS_JSON;
    delete process.env.PIXELORAMA_CLI_ARGS_JSON;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (originalPixeloramaTemplate === undefined) delete process.env.PIXELORAMA_CLI_ARGS_JSON;
    else process.env.PIXELORAMA_CLI_ARGS_JSON = originalPixeloramaTemplate;
  });

  it('builds Aseprite sheet export args without shell chaining', () => {
    const command = new SpriteExternalToolAdapter(undefined, tempDir).buildCommand({
      backend: 'aseprite',
      workflow: 'spritesheet_export',
      inputPath: 'assets/hero.aseprite'
    });

    expect(command.args).toContain('-b');
    expect(command.args).toContain('--sheet');
    expect(command.args).toContain('--data');
    expect(command.args.join(' ')).not.toContain('&&');
  });

  it('rejects paths outside the workspace', () => {
    const adapter = new SpriteExternalToolAdapter(undefined, tempDir);

    expect(() => adapter.buildCommand({
      backend: 'aseprite',
      workflow: 'spritesheet_export',
      inputPath: '../secret.aseprite'
    })).toThrow(/workspace/i);
  });

  it('blocks Pixelorama until a CLI template is configured', () => {
    const adapter = new SpriteExternalToolAdapter(undefined, tempDir);

    expect(() => adapter.buildCommand({
      backend: 'pixelorama',
      workflow: 'spritesheet_export',
      inputPath: 'assets/hero.aseprite'
    })).toThrow(/Pixelorama CLI template/i);
  });

  it('builds Aseprite palette extraction through the Lua exporter', () => {
    const command = new SpriteExternalToolAdapter(undefined, tempDir).buildCommand({
      backend: 'aseprite',
      workflow: 'palette_extract',
      inputPath: 'assets/hero.aseprite'
    });

    expect(command.args).toContain('--script-param');
    expect(command.args).toContain('--script');
    expect(command.outputFiles[0]).toMatch(/palette\.json$/);
  });

  it('rejects unsupported backends, unsupported workflows, and LibreSprite palette extraction', () => {
    const adapter = new SpriteExternalToolAdapter(undefined, tempDir);

    expect(() => adapter.buildCommand({
      backend: 'invalid_backend' as any,
      workflow: 'spritesheet_export',
      inputPath: 'assets/hero.aseprite'
    })).toThrow('Unsupported external sprite backend');

    expect(() => adapter.buildCommand({
      backend: 'aseprite',
      workflow: 'invalid_workflow' as any,
      inputPath: 'assets/hero.aseprite'
    })).toThrow('Unsupported external sprite workflow');

    expect(() => adapter.buildCommand({
      backend: 'libresprite',
      workflow: 'palette_extract',
      inputPath: 'assets/hero.aseprite'
    })).toThrow('External palette extraction currently requires Aseprite');
  });

  it('builds Aseprite commands with all optional flags, layer filters, and output formatting', () => {
    const adapter = new SpriteExternalToolAdapter(undefined, tempDir);

    const cmd = adapter.buildCommand({
      backend: 'aseprite',
      workflow: 'spritesheet_export',
      inputPath: 'assets/hero.aseprite',
      outputTarget: 'dist/sprites.png',
      cwd: 'assets',
      options: {
        sheetType: 'packed',
        dataFormat: 'json-hash',
        allLayers: true,
        splitLayers: true,
        splitGrid: true,
        layerNames: ['Layer1', 'Layer2'],
        ignoreLayerNames: ['Background'],
        tag: 'walk',
        frameRange: '0,3',
        trim: true,
        trimSprite: true,
        ignoreEmpty: true,
        mergeDuplicates: true,
        splitTags: true,
        splitSlices: true,
        extrude: true
      }
    });

    expect(cmd.args).toContain('--all-layers');
    expect(cmd.args).toContain('--split-layers');
    expect(cmd.args).toContain('--split-grid');
    expect(cmd.args).toContain('Layer1');
    expect(cmd.args).toContain('Background');
    expect(cmd.args).toContain('walk');
    expect(cmd.args).toContain('0,3');
    expect(cmd.args).toContain('--trim');
    expect(cmd.args).toContain('--trim-sprite');
    expect(cmd.args).toContain('--ignore-empty');
    expect(cmd.args).toContain('--merge-duplicates');
    expect(cmd.args).toContain('--split-tags');
    expect(cmd.args).toContain('--split-slices');
    expect(cmd.args).toContain('--extrude');
    expect(cmd.args).toContain('json-hash');
    expect(cmd.args).toContain('packed');
  });

  it('builds frame_slice and manifest_generate workflows with directory targets', () => {
    const adapter = new SpriteExternalToolAdapter(undefined, tempDir);

    const sliceCmd = adapter.buildCommand({
      backend: 'aseprite',
      workflow: 'frame_slice',
      inputPath: 'assets/hero.aseprite',
      outputTarget: 'dist/frames'
    });
    expect(sliceCmd.args).toContain('--save-as');
    expect(sliceCmd.outputFiles[0]).toContain('{frame000}.png');

    const manifestCmd = adapter.buildCommand({
      backend: 'libresprite',
      workflow: 'manifest_generate',
      inputPath: 'assets/hero.aseprite',
      outputTarget: 'dist/custom.json'
    });
    expect(manifestCmd.args).toContain('--data');
    expect(manifestCmd.outputFiles).toContain(path.join(tempDir, 'dist/custom.manifest.json'));
  });

  it('handles Pixelorama template configuration and expansions across workflows', () => {
    const adapter = new SpriteExternalToolAdapter(undefined, tempDir);

    // Invalid JSON
    process.env.PIXELORAMA_CLI_ARGS_JSON = '{ bad json';
    expect(() => adapter.buildCommand({
      backend: 'pixelorama',
      workflow: 'spritesheet_export',
      inputPath: 'assets/hero.aseprite'
    })).toThrow('must be a JSON string array');

    // Non-array
    process.env.PIXELORAMA_CLI_ARGS_JSON = '{"not":"array"}';
    expect(() => adapter.buildCommand({
      backend: 'pixelorama',
      workflow: 'spritesheet_export',
      inputPath: 'assets/hero.aseprite'
    })).toThrow('must be a JSON string array');

    // Valid template
    process.env.PIXELORAMA_CLI_ARGS_JSON = JSON.stringify([
      '--input', '{input}',
      '--output', '{output}',
      '--sheet', '{sheet}',
      '--manifest', '{manifest}',
      '--palette', '{palette}'
    ]);

    const manifestCmd = adapter.buildCommand({
      backend: 'pixelorama',
      workflow: 'manifest_generate',
      inputPath: 'assets/hero.aseprite'
    });
    expect(manifestCmd.outputFiles).toHaveLength(2);

    const sliceCmd = adapter.buildCommand({
      backend: 'pixelorama',
      workflow: 'frame_slice',
      inputPath: 'assets/hero.aseprite'
    });
    expect(sliceCmd.outputFiles).toHaveLength(1);

    const paletteCmd = adapter.buildCommand({
      backend: 'pixelorama',
      workflow: 'palette_extract',
      inputPath: 'assets/hero.aseprite'
    });
    expect(paletteCmd.outputFiles).toHaveLength(1);
  });
});
