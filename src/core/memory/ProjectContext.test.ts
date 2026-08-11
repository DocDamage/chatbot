import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProjectContext } from './ProjectContext';

describe('ProjectContext discovery branches', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-context-'));
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('loads context, detects languages/frameworks, and builds a prompt', async () => {
    fs.writeFileSync(path.join(root, 'AGENTS.md'), 'Use focused modules.');
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      description: 'A test project',
      dependencies: { express: '1', react: '1', fastify: '1', next: '1', vue: '1', angular: '1', tailwindcss: '1', prisma: '1' },
      devDependencies: { jest: '1' }
    }));
    fs.writeFileSync(path.join(root, 'requirements.txt'), 'django\nfastapi\nflask\npytest');
    fs.writeFileSync(path.join(root, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(root, '.eslintrc.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(root, '.prettierrc'), '{}');
    fs.writeFileSync(path.join(root, 'README.md'), '# Readme');
    fs.mkdirSync(path.join(root, 'src', 'server'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'server', 'index.ts'), 'export {};');
    fs.writeFileSync(path.join(root, 'src', 'App.tsx'), 'export {};');
    fs.writeFileSync(path.join(root, '.env.example'), 'KEY=value');
    fs.writeFileSync(path.join(root, 'notes.yaml'), 'notes: true');

    const context = new ProjectContext(root);
    const info = await context.load();
    expect(info.type).toBe('react');
    expect(info.language).toContain('TypeScript');
    expect(info.frameworks).toEqual(expect.arrayContaining(['Express', 'React', 'Django', 'FastAPI', 'Flask', 'pytest']));
    expect(context.getCustomContext()).toContain('focused modules');
    expect(context.buildContextPrompt()).toContain('# Project:');
    expect(context.buildContextPrompt()).toContain('Project Notes');
    expect(context.getContext()).toBe(info);
  });

  it('detects each supported project type and description fallback', async () => {
    const detect = async (files: Record<string, string>): Promise<string> => {
      for (const [name, content] of Object.entries(files)) {
        const target = path.join(root, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content);
      }
      const context = new ProjectContext(root);
      return (await (context as any).detectProjectType()) as string;
    };

    expect(await detect({ 'next.config.js': '' })).toBe('nextjs');
    fs.rmSync(path.join(root, 'next.config.js'));
    expect(await detect({ 'package.json': JSON.stringify({ dependencies: { react: '1' } }) })).toBe('react');
    fs.rmSync(path.join(root, 'package.json'));
    expect(await detect({ 'package.json': JSON.stringify({ devDependencies: { typescript: '1' } }) })).toBe('typescript');
    fs.rmSync(path.join(root, 'package.json'));
    expect(await detect({ 'package.json': JSON.stringify({}) })).toBe('nodejs');
    fs.rmSync(path.join(root, 'package.json'));
    expect(await detect({ 'manage.py': '', 'requirements.txt': '' })).toBe('django');
    fs.rmSync(path.join(root, 'manage.py'));
    expect(await detect({ 'requirements.txt': 'fastapi' })).toBe('fastapi');
    fs.writeFileSync(path.join(root, 'requirements.txt'), 'numpy');
    expect(await detect({})).toBe('python');
    fs.rmSync(path.join(root, 'requirements.txt'));
    expect(await detect({})).toBe('unknown');

    fs.writeFileSync(path.join(root, 'README.md'), '# Title\n\nA short project description.');
    const fallback = new ProjectContext(root);
    expect(await (fallback as any).extractDescription()).toBe('A short project description.');
    fs.writeFileSync(path.join(root, 'package.json'), '{bad');
    expect(await (fallback as any).extractDescription()).toBe('A short project description.');
  });

  it('covers structure filtering, key-file discovery, malformed reads, and template creation', async () => {
    fs.mkdirSync(path.join(root, 'node_modules', 'ignored'), { recursive: true });
    fs.mkdirSync(path.join(root, 'visible'), { recursive: true });
    fs.writeFileSync(path.join(root, '.hidden'), 'hidden');
    fs.writeFileSync(path.join(root, '.env.example'), 'KEY=value');
    fs.writeFileSync(path.join(root, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(root, '.eslintrc.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }));
    fs.writeFileSync(path.join(root, 'visible', 'file.ts'), 'export {};');
    fs.writeFileSync(path.join(root, 'visible', 'ignored.txt'), 'ignored');
    const context = new ProjectContext(root, { maxDepth: 0 });
    const structure = await (context as any).scanStructure(root, 1);
    expect(structure.children).toBeUndefined();
    const normal = new ProjectContext(root);
    const normalStructure = await (normal as any).scanStructure(root, 0);
    expect(normalStructure.children?.some((child: any) => child.name === 'visible')).toBe(true);
    expect((await (normal as any).identifyKeyFiles()).length).toBeGreaterThan(0);
    expect(await (normal as any).detectLanguages()).toEqual(expect.arrayContaining(['TypeScript']));
    expect((await (normal as any).extractConventions()).length).toBeGreaterThan(0);
    expect((normal as any).readJson('missing.json')).toBeNull();
    fs.writeFileSync(path.join(root, 'bad.json'), '{bad');
    expect((normal as any).readJson('bad.json')).toBeNull();
    expect((normal as any).fileContains('missing.txt', 'x')).toBe(false);
    expect((normal as any).walkDir(path.join(root, 'missing'), 2)).toEqual([]);
    ProjectContext.createTemplate(root);
    expect(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')).toContain('Project Context');
  });
});
