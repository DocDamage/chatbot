import fs from 'fs';
import os from 'os';
import path from 'path';
import { LocalToolService } from './LocalToolService';

describe('LocalToolService policy and persistence branches', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'local-tools-'));
  const database = {
    getType: () => 'sqlite',
    query: jest.fn(async (sql: string) => {
      if (sql.includes('FROM local_executables') && sql.includes('SELECT le.*')) return { rows: [] };
      return { rows: [] };
    })
  } as any;
  const service = new LocalToolService(database, root);

  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it('covers workspace safety, approval policy, argument normalization, and JSON parsing', () => {
    expect((service as any).resolveWorkspacePath('.')).toBe(root);
    expect((service as any).normalizeArgs([1, true])).toEqual(['1', 'true']);
    expect((service as any).requiresApproval('ask_each_run', 'low')).toBe(true);
    expect((service as any).requiresApproval('never', 'medium')).toBe(true);
    expect((service as any).requiresApproval('never', 'high')).toBe(true);
    expect((service as any).requiresApproval('never', 'low')).toBe(false);
    expect((service as any).parseJson(null, ['fallback'])).toEqual(['fallback']);
    expect((service as any).parseJson({ value: 1 }, [])).toEqual({ value: 1 });
    expect((service as any).parseJson('{"value":1}', {})).toEqual({ value: 1 });
    expect((service as any).parseJson('{bad', { fallback: true })).toEqual({ fallback: true });
    expect(() => (service as any).resolveWorkspacePath('../outside')).toThrow('must stay inside');
  });

  it('covers executable discovery and known-path classification', () => {
    const bin = path.join(root, 'bin');
    fs.mkdirSync(bin);
    const executable = path.join(bin, 'demo-tool');
    fs.writeFileSync(executable, '');
    const previousPath = process.env.PATH;
    process.env.PATH = bin;
    expect((service as any).findExecutableCandidates('demo-tool')).toContain(path.resolve(executable));
    process.env.PATH = previousPath;
    expect((service as any).isKnownPath(path.join(root, 'local-tools', 'demo'))).toBe(true);
    expect((service as any).isKnownPath(path.join(root, 'Steam', 'steamapps', 'demo'))).toBe(true);
    expect((service as any).isKnownPath(path.join('C:', 'Program Files', 'demo'))).toBe(true);
    expect((service as any).isKnownPath(path.join(root, 'other', 'demo'))).toBe(false);
    const knownPaths = (service as any).knownExecutablePaths('demo', 'aseprite');
    if (process.platform === 'win32') {
      expect(knownPaths.length).toBeGreaterThan(0);
    } else {
      expect(knownPaths).toEqual([]);
    }
  });

  it('covers Windows installation discovery paths on every host', () => {
    const originalPlatform = process.platform;
    const originalProgramFiles = process.env.ProgramFiles;
    const originalProgramFilesX86 = process.env['ProgramFiles(x86)'];
    const originalPath = process.env.PATH;
    const programFiles = path.join(root, 'Program Files');
    const programFilesX86 = path.join(root, 'Program Files (x86)');
    const bin = path.join(root, 'windows-bin');

    fs.mkdirSync(path.join(programFiles, 'Aseprite'), { recursive: true });
    fs.mkdirSync(path.join(programFiles, 'Steam', 'steamapps', 'common', 'Aseprite'), { recursive: true });
    fs.mkdirSync(path.join(programFiles, 'Blender Foundation', 'Blender'), { recursive: true });
    fs.mkdirSync(path.join(programFiles, 'Godot'), { recursive: true });
    fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(path.join(programFiles, 'Aseprite', 'Aseprite.exe'), '');
    fs.writeFileSync(path.join(bin, 'demo.exe'), '');

    try {
      Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' });
      process.env.ProgramFiles = programFiles;
      process.env['ProgramFiles(x86)'] = programFilesX86;
      process.env.PATH = bin;

      expect((service as any).knownExecutablePaths('demo', 'aseprite').length).toBeGreaterThan(2);
      expect((service as any).knownExecutablePaths('demo', 'blender').length).toBeGreaterThan(1);
      expect((service as any).knownExecutablePaths('demo', 'godot').length).toBeGreaterThan(1);
      expect((service as any).knownExecutablePaths('demo')).toContain(path.join(root, 'local-tools', 'demo', 'demo.exe'));
      expect((service as any).findExecutableCandidates('demo')).toContain(path.resolve(bin, 'demo.exe'));
    } finally {
      Object.defineProperty(process, 'platform', { configurable: true, value: originalPlatform });
      process.env.ProgramFiles = originalProgramFiles;
      process.env['ProgramFiles(x86)'] = originalProgramFilesX86;
      process.env.PATH = originalPath;
    }
  });

  it('covers executable resolution, listing, manual registration, and detection updates', async () => {
    await expect((service as any).resolveExecutable(database)).rejects.toThrow('toolSlug or executablePath');
    await expect((service as any).resolveExecutable(database, 'missing')).rejects.toThrow('No enabled executable');
    await expect((service as any).resolveExecutable(database, undefined, 'tool.exe')).resolves.toMatchObject({ executable_path: path.resolve('tool.exe') });

    database.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT le.*, tc.slug')) {
        return { rows: [{ id: 'e1', tool_id: null, name: 'demo', executable_path: 'demo', detected: 1, detection_method: null, enabled: 0, trust_level: null, approval_policy: null }] };
      }
      if (sql.includes('SELECT id, slug, name FROM tool_catalog')) return { rows: [{ id: 't1', slug: 'demo', name: 'Demo' }] };
      if (sql.includes('SELECT id FROM local_executables')) return { rows: [{ id: 'existing' }] };
      return { rows: [] };
    });
    const listed = await service.listExecutables();
    expect(listed[0]).toMatchObject({ toolName: 'demo', detected: true, enabled: false, detectionMethod: 'manual' });
    const registered = await service.registerManualExecutable({ name: 'demo', executablePath: 'tool.exe', toolSlug: 'demo', enabled: true });
    expect(registered).toMatchObject({ toolId: 't1', toolSlug: 'demo', detected: false, enabled: true });
    await (service as any).recordDetection(database, registered);

    database.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id FROM local_executables')) return { rows: [] };
      return { rows: [] };
    });
    await (service as any).recordDetection(database, registered);
    expect(database.query).toHaveBeenCalled();
  });
});
