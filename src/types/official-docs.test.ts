import {
  officialDocManifestSchema,
  officialDocChunkSchema,
  versionIndexRecordSchema,
  SUPPORTED_DOC_LANGUAGES,
  SUPPORTED_DOC_FRAMEWORKS,
} from './official-docs';

describe('Official Docs Schemas (CRK-P07)', () => {
  it('validates a correct official documentation manifest', () => {
    const manifest = {
      dataset: 'official-docs',
      product: 'godot',
      version: '4.3',
      authority: 0.95,
      sourceType: 'official-documentation',
      sourceUrl: 'https://docs.godotengine.org/en/4.3/',
      contentHash: 'a1b2c3d4e5f6',
      ingestionStrategy: 'repository-docs',
    };

    const parsed = officialDocManifestSchema.parse(manifest);
    expect(parsed.product).toBe('godot');
    expect(parsed.authority).toBe(0.95);
    expect(parsed.sourceType).toBe('official-documentation');
    expect(parsed.language).toBe('en');
  });

  it('validates a semantic documentation chunk', () => {
    const chunk = {
      id: 'chunk-godot-characterbody2d-01',
      product: 'godot',
      version: '4.3',
      page: 'classes/class_characterbody2d',
      headingHierarchy: ['Nodes', 'CollisionObject2D', 'CharacterBody2D', 'Methods'],
      subsection: 'move_and_slide',
      content: 'Moves the body based on velocity and handles collisions.',
      codeExamples: ['velocity = Vector2(100, 0)\nmove_and_slide()'],
      apiSymbols: ['CharacterBody2D', 'move_and_slide'],
      anchors: ['#move-and-slide'],
      deprecationNotes: [],
      tokenCount: 42,
    };

    const parsed = officialDocChunkSchema.parse(chunk);
    expect(parsed.subsection).toBe('move_and_slide');
    expect(parsed.codeExamples).toHaveLength(1);
    expect(parsed.apiSymbols).toContain('move_and_slide');
  });

  it('validates version indexing records and lists priority domains', () => {
    const record = {
      product: 'react',
      versionString: '18.3.1',
      majorVersion: 18,
      minorVersion: 3,
      patchVersion: 1,
      deprecated: false,
      introducedIn: '18.0.0',
      isLts: true,
    };

    const parsed = versionIndexRecordSchema.parse(record);
    expect(parsed.majorVersion).toBe(18);
    expect(parsed.isLts).toBe(true);

    expect(SUPPORTED_DOC_LANGUAGES).toContain('typescript');
    expect(SUPPORTED_DOC_LANGUAGES).toContain('python');
    expect(SUPPORTED_DOC_LANGUAGES).toContain('gdscript');
    expect(SUPPORTED_DOC_FRAMEWORKS).toContain('godot');
    expect(SUPPORTED_DOC_FRAMEWORKS).toContain('react');
    expect(SUPPORTED_DOC_FRAMEWORKS).toContain('postgresql');
  });
});
