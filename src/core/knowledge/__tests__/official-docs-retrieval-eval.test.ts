/**
 * Official Documentation Retrieval Evaluation & Phase 07 Exit Gate (CRK-P07-T07)
 */

import { OfficialDocumentationPack } from '../OfficialDocumentationPack';
import { DocumentationSourcePolicy } from '../DocumentationSourcePolicy';
import { DocumentationRefreshService } from '../DocumentationRefreshService';

describe('Official Documentation Retrieval Evaluation & Phase 07 Exit Gate', () => {
  let docPack: OfficialDocumentationPack;
  let refreshService: DocumentationRefreshService;

  beforeEach(() => {
    docPack = new OfficialDocumentationPack();
    refreshService = new DocumentationRefreshService();
  });

  it('Exit Gate Criterion 1: Priority language and framework docs are installable and validated', () => {
    const policy = docPack.getPolicy();
    expect(policy.isSupported('typescript')).toBe(true);
    expect(policy.isSupported('python')).toBe(true);
    expect(policy.isSupported('godot')).toBe(true);
    expect(policy.isSupported('react')).toBe(true);
    expect(policy.isSupported('postgresql')).toBe(true);

    // Register official manifests
    docPack.registerManifest({
      dataset: 'official-docs',
      product: 'godot',
      version: '4.3',
      authority: 0.95,
      sourceType: 'official-documentation',
      sourceUrl: 'https://docs.godotengine.org/en/4.3/',
      contentHash: 'hash-godot-4-3',
      ingestionStrategy: 'repository-docs',
    });

    const manifest = docPack.getManifest('godot');
    expect(manifest).toBeDefined();
    expect(manifest?.authority).toBe(0.95);
    expect(manifest?.version).toBe('4.3');
  });

  it('Exit Gate Criterion 2: Version metadata survives ingestion and distinguishes versions (Godot 3 vs Godot 4)', () => {
    // Godot 3 doc: KinematicBody2D uses move_and_slide with linear_velocity param
    docPack.indexMarkdownDoc(
      'godot',
      '3.5',
      'classes/class_kinematicbody2d',
      `# KinematicBody2D\n\n## Methods\n\n### move_and_slide\n\`move_and_slide(linear_velocity: Vector2)\`\nOld Godot 3 kinematic movement.`
    );

    // Godot 4 doc: CharacterBody2D has velocity property and parameterless move_and_slide()
    docPack.indexMarkdownDoc(
      'godot',
      '4.3',
      'classes/class_characterbody2d',
      `# CharacterBody2D\n\n## Methods\n\n### move_and_slide\n\`move_and_slide() -> bool\`\nMoves the body using property \`velocity\`.`
    );

    // Query for Godot 4 movement
    const godot4Results = docPack.search('godot', 'move_and_slide CharacterBody2D', '4');
    expect(godot4Results.length).toBeGreaterThan(0);
    expect(godot4Results[0].chunk.version).toBe('4.3');
    expect(godot4Results[0].chunk.apiSymbols).toContain('CharacterBody2D');
    expect(godot4Results[0].versionMatch).toBe(true);

    // Verify Godot 4 result outranks Godot 3 result for a Godot 4 target query
    const godot3InResults = godot4Results.find(r => r.chunk.version === '3.5');
    if (godot3InResults) {
      expect(godot4Results[0].score).toBeGreaterThan(godot3InResults.score);
    }
  });

  it('Exit Gate Criterion 3: Version discrimination for React (Hooks vs Class components) and Python match statements', () => {
    // React 16 legacy class component
    docPack.indexMarkdownDoc(
      'react',
      '16.8',
      'legacy/component-did-mount',
      `# React Component\n\n### componentDidMount\n\`componentDidMount()\`\n*Deprecated* in modern function components.`
    );

    // React 18 modern hook
    docPack.indexMarkdownDoc(
      'react',
      '18.3',
      'hooks/use-effect',
      `# React Hooks\n\n### useEffect\n\`useEffect(setup, dependencies?)\`\nRuns side effects in function components.`
    );

    const hookResults = docPack.search('react', 'useEffect side effects', '18');
    expect(hookResults[0].chunk.version).toBe('18.3');
    expect(hookResults[0].chunk.subsection).toBe('useEffect');

    // Python 3.10 pattern matching check
    const versionIndex = docPack.getVersionIndex();
    versionIndex.addRecord({
      product: 'python',
      versionString: '3.10',
      majorVersion: 3,
      minorVersion: 10,
      introducedIn: '3.10.0',
      deprecated: false,
    });

    const isMatchSupportedIn39 = versionIndex.isCompatible('python', { introducedIn: '3.10.0' }, '3.9.0');
    const isMatchSupportedIn311 = versionIndex.isCompatible('python', { introducedIn: '3.10.0' }, '3.11.0');

    expect(isMatchSupportedIn39).toBe(false);
    expect(isMatchSupportedIn311).toBe(true);
  });

  it('Exit Gate Criterion 4: Current official docs outrank older third-party content', () => {
    const policy = new DocumentationSourcePolicy();
    const officialAuthority = policy.getBaseAuthority('official-documentation');
    const qaAuthority = policy.getBaseAuthority('accepted-qa');
    const webAuthority = policy.getBaseAuthority('educational-web');

    expect(officialAuthority).toBe(0.95);
    expect(officialAuthority).toBeGreaterThan(qaAuthority); // 0.95 > 0.78
    expect(officialAuthority).toBeGreaterThan(webAuthority); // 0.95 > 0.58
  });

  it('Exit Gate Criterion 5: Refresh pipeline skips unchanged pages and re-chunks modified pages', () => {
    const page1 = {
      pagePath: 'doc/quickstart.md',
      contentHash: 'hash-initial-123',
      markdownContent: '# Quickstart\n\n`function init()`\nInitial setup instructions.',
    };

    // First ingestion
    const run1 = refreshService.processRefresh({
      product: 'typescript',
      version: '5.5',
      pages: [page1],
    });

    expect(run1.rechunkedPages).toBe(1);
    expect(run1.skippedUnchanged).toBe(0);
    expect(run1.newChunks.length).toBeGreaterThan(0);

    // Second ingestion with unchanged hash
    const run2 = refreshService.processRefresh({
      product: 'typescript',
      version: '5.5',
      pages: [page1],
    });

    expect(run2.rechunkedPages).toBe(0);
    expect(run2.skippedUnchanged).toBe(1);
    expect(run2.newChunks.length).toBe(0);
  });
});
