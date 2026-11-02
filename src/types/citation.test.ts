/**
 * Unit Tests for Citation & Provenance Schemas (CRK-P15-T01, T02, T03, T04)
 */

import {
  citationRefSchema,
  claimSourceAssociationSchema,
  sourceCardSchema,
  sourcesDrawerDataSchema,
  whyThisAnswerDiagnosticsSchema,
} from './citation';

describe('Citation & Provenance Schemas', () => {
  it('validates structured CitationRef schema (CRK-P15-T01)', () => {
    const citation = {
      id: 'cit-godot-01',
      sourceId: 'src-godot-docs',
      datasetId: 'godot-docs-4.7',
      title: 'Godot Engine 4.7 Documentation',
      sourceUrl: 'https://docs.godotengine.org/en/4.7/classes/class_node.html',
      version: '4.7',
      chunkId: 'chk-node-001',
      quoteStart: 10,
      quoteEnd: 85,
      authority: 0.95,
      score: 0.88,
    };

    const parsed = citationRefSchema.parse(citation);
    expect(parsed.id).toBe('cit-godot-01');
    expect(parsed.authority).toBe(0.95);
  });

  it('validates ClaimSourceAssociation distinguishing response vs sentence level (CRK-P15-T02)', () => {
    const assoc = {
      claimId: 'clm-01',
      claimText: 'CharacterBody3D requires move_and_slide() without velocity arguments.',
      citationIds: ['cit-godot-01'],
      chunkIds: ['chk-node-001'],
      sourceId: 'src-godot-docs',
      datasetId: 'godot-docs-4.7',
      version: '4.7',
      level: 'sentence' as const,
      confidence: 0.92,
    };

    const parsed = claimSourceAssociationSchema.parse(assoc);
    expect(parsed.level).toBe('sentence');

    const responseAssoc = {
      ...assoc,
      claimId: 'clm-02',
      claimText: 'Full response discussing 3D player controller migration.',
      level: 'response' as const,
    };
    const parsedResponse = claimSourceAssociationSchema.parse(responseAssoc);
    expect(parsedResponse.level).toBe('response');
  });

  it('validates SourceCard and SourcesDrawerData schema (CRK-P15-T03)', () => {
    const card = {
      id: 'sc-1',
      title: 'Godot 4.7 documentation',
      category: 'official_docs' as const,
      categoryLabel: 'Official documentation',
      version: '4.7',
      authority: 0.95,
      sourceUrl: 'https://docs.godotengine.org/en/4.7/',
      snippet: 'Node is the base class for all scene objects.',
      badges: ['Official documentation', 'v4.7', '0.95 authority'],
      action: {
        type: 'open_url' as const,
        target: 'https://docs.godotengine.org/en/4.7/',
        label: 'Open source',
      },
    };

    const drawer = {
      totalSources: 1,
      compactLabel: 'Sources (1)',
      cards: [card],
      unresolvedCitations: [],
    };

    const parsed = sourcesDrawerDataSchema.parse(drawer);
    expect(parsed.compactLabel).toBe('Sources (1)');
    expect(parsed.cards[0].action.label).toBe('Open source');
  });

  it('validates WhyThisAnswerDiagnostics strictly excluding private reasoning (§2758, CRK-P15-T04)', () => {
    const diag = {
      requestId: 'req-123',
      traceId: 'trc-123',
      selectedIntent: 'framework_api_query',
      taskType: 'coding_question',
      contextTypes: ['official_docs', 'developer_qa'],
      packIds: ['pack-godot', 'pack-stack-exchange'],
      retrievalCandidateCount: 15,
      selectedSourceCount: 3,
      modelRoute: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        policy: 'coding_high_reasoning',
        fallbackUsed: false,
      },
      toolStatus: [],
      promptPolicyVersion: 'prompt-envelope-v2.1',
      retrievalPolicyVersion: 'retrieval-policy-v1.4',
      botProfileVersion: 'default-profile-v1.0',
      warnings: [],
    };

    const parsed = whyThisAnswerDiagnosticsSchema.parse(diag);
    expect(parsed.selectedSourceCount).toBe(3);
    // Explicit assertion that private chain of thought is not in the schema
    expect((parsed as any).chainOfThought).toBeUndefined();
    expect((parsed as any).rawPrompt).toBeUndefined();
  });
});
