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
});
