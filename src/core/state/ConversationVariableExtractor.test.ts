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
});
