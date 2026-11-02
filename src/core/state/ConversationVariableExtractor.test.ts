import { ConversationVariableExtractor } from './ConversationVariableExtractor';
import { NormalizedChatRequest } from '../../types/chat-runtime';

describe('ConversationVariableExtractor (CRK-P03-T03)', () => {
  const extractor = new ConversationVariableExtractor();

  const makeReq = (message: string, extra: Partial<NormalizedChatRequest> = {}): NormalizedChatRequest => ({
    requestId: 'req-test-1',
    sessionId: 'sess-test-1',
    message,
    botProfileId: 'default',
    loadedFiles: [],
    loadedAudio: [],
    clientCapabilities: { streaming: false, citations: false, toolApproval: false },
    metadata: {},
    ...extra,
  });

  it('extracts framework and version from explicit statement "this is Godot 4.7"', () => {
    const res = extractor.extract(makeReq('I need help, this is Godot 4.7'));
    expect(res.variables.framework).toBeDefined();
    expect(res.variables.framework.value).toBe('Godot');
    expect(res.variables.framework.confidence).toBe(1.0);
    expect(res.variables.frameworkVersion).toBeDefined();
    expect(res.variables.frameworkVersion.value).toBe('4.7');
    expect(res.variables.frameworkVersion.confidence).toBe(1.0);
  });

  it('extracts language and operating system', () => {
    const res = extractor.extract(makeReq('language is TypeScript on Windows 11'));
    expect(res.variables.programmingLanguage?.value).toBe('TypeScript');
    expect(res.variables.operatingSystem?.value).toBe('Windows 11');
  });

  it('extracts structured metadata fields with highest priority', () => {
    const res = extractor.extract(
      makeReq('help with code', {
        mode: 'coding',
        requestedModelPolicy: 'high-reasoning',
        metadata: {
          repository: 'facebook/react',
          workspaceRoot: '/projects/react',
        },
      })
    );
    expect(res.variables.selectedMode?.value).toBe('coding');
    expect(res.variables.selectedModelPolicy?.value).toBe('high-reasoning');
    expect(res.variables.repository?.value).toBe('facebook/react');
    expect(res.variables.workspaceRoot?.value).toBe('/projects/react');
  });

  it('extracts project facts from loaded files', () => {
    const res = extractor.extract(
      makeReq('check this build', {
        loadedFiles: [{ path: 'C:/dev/game/project.godot' }, { path: 'C:/dev/game/main.gd' }],
      })
    );
    expect(res.variables.framework?.value).toBe('Godot');
    expect(res.variables.programmingLanguage?.value).toBe('GDScript');
  });

  it('flags ambiguous repository switch when target repo is not specified', () => {
    const res = extractor.extract(makeReq('please switch to the other repo'));
    expect(res.variables.repository).toBeUndefined();
    expect(res.ambiguities.length).toBeGreaterThan(0);
    expect(res.ambiguities[0]).toContain('Ambiguous repository switch');
  });

  it.each(['React', 'Vue', 'Angular', 'Next.js', 'Svelte', 'FastAPI', 'Django', 'Flask', 'Express'])('normalizes explicit %s framework names', framework => {
    const result = extractor.extract(makeReq(`using ${framework} 4.2`));
    expect(result.variables.framework.value).toBe(framework);
    expect(result.variables.frameworkVersion.value).toBe('4.2');
  });

  it.each([
    ['ts', 'TypeScript'], ['js', 'JavaScript'], ['javascript', 'JavaScript'],
    ['py', 'Python'], ['python', 'Python'], ['rs', 'Rust'], ['rust', 'Rust'],
    ['go', 'Go'], ['golang', 'Go'], ['gd', 'GDScript'], ['gdscript', 'GDScript'],
    ['cpp', 'C++'], ['cs', 'C#'], ['csharp', 'C#'], ['Kotlin', 'Kotlin'],
  ])('normalizes language %s to %s', (name, expected) => {
    expect(extractor.extract(makeReq(`language is ${name}`)).variables.programmingLanguage.value).toBe(expected);
  });

  it('extracts goals, output format, target and explicit repository switches', () => {
    const result = extractor.extract(makeReq('I want to ship an app. targeting Android, as JSON, switch to repo acme/app'));
    expect(result.variables.userGoal.value).toBe('ship an app');
    expect(result.variables.targetPlatform.value).toBe('Android');
    expect(result.variables.requestedOutput.value).toBe('json');
    expect(result.variables.repository.value).toBe('acme/app');
    expect(result.ambiguities).toEqual([]);
  });

  it('keeps explicit choices when loaded project files suggest a weaker inference', () => {
    const result = extractor.extract(makeReq('using React, language is Python', {
      metadata: { currentProject: 'orbit', programmingLanguage: 'Python' },
      loadedFiles: [{ path: 'project.godot' }, { path: 'cargo.toml' }, { path: 'package.json' }, { path: 'view.tsx' }],
    }));
    expect(result.variables.framework).toMatchObject({ value: 'React', confidence: 1 });
    expect(result.variables.programmingLanguage).toMatchObject({ value: 'Python', confidence: 1 });
    expect(result.variables.currentProject.value).toBe('orbit');
    expect(result.variables.runtimeVersion.value).toBe('node');
  });

  it.each([['main.ts', 'TypeScript'], ['view.tsx', 'TypeScript'], ['main.py', 'Python']])('infers a language from %s after ignoring unknown files', (file, language) => {
    const result = extractor.extract(makeReq('help', { loadedFiles: [{ path: 'README.md' }, { path: file }] }));
    expect(result.variables.programmingLanguage).toMatchObject({ value: language, confidence: 0.75, source: 'inferred' });
  });

  it('ignores empty or wrongly typed metadata and leaves unsupported files unset', () => {
    const result = extractor.extract(makeReq('help with another task', {
      metadata: { repository: '', workspaceRoot: 42, currentProject: false, programmingLanguage: null },
      loadedFiles: [{ path: 'README.md' }],
    }));
    expect(result.variables).toEqual({});
  });
});
