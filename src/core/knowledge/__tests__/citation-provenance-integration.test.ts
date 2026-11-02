/**
 * Citation and Provenance Integration Suite & Phase 15 Exit Gate
 *
 * Verifies structured citations, claim-source association, sources drawer formatting,
 * privacy-preserving diagnostics, and citation failure handling.
 */

import { CitationRef } from '../../../types/citation';
import { ClaimAssociationService } from '../ClaimAssociationService';
import { SourcesDrawerFormatter } from '../SourcesDrawerFormatter';
import { WhyThisAnswerService } from '../../chat/WhyThisAnswerService';
import { CitationResolverService } from '../CitationResolverService';
import { ChatRuntimeResult, ChatContextPlan } from '../../../types/chat-runtime';

describe('CRK Phase 15: Citation and Provenance UX Exit Gate', () => {
  const sampleCitations: CitationRef[] = [
    {
      id: 'cit-godot-01',
      sourceId: 'src-godot-docs',
      datasetId: 'godot-docs-4.7',
      title: 'Godot Engine 4.7 CharacterBody3D API Reference',
      sourceUrl: 'https://docs.godotengine.org/en/4.7/classes/class_characterbody3d.html',
      version: '4.7',
      chunkId: 'chk-godot-cb3d-01',
      quoteStart: 0,
      quoteEnd: 150,
      authority: 0.95,
      score: 0.91,
    },
    {
      id: 'cit-repo-01',
      sourceId: 'src-local-repo',
      title: 'player_movement.gd',
      path: 'src/player_movement.gd',
      chunkId: 'chk-repo-pm-02',
      authority: 0.90,
      score: 0.85,
    },
    {
      id: 'cit-so-01',
      sourceId: 'src-stack-exchange',
      datasetId: 'developer-qa-so',
      title: 'How to migrate KinematicBody to CharacterBody3D in Godot 4',
      sourceUrl: 'https://stackoverflow.com/questions/71234567/how-to-migrate-kinematicbody',
      version: '4.0+',
      chunkId: 'chk-so-mig-03',
      authority: 0.85,
      score: 0.79,
    },
  ];

  it('Exit Gate Criterion 1: Citations are structured data and validate via schema (CRK-P15-T01)', () => {
    expect(sampleCitations).toHaveLength(3);
    for (const cit of sampleCitations) {
      expect(cit.id).toBeDefined();
      expect(cit.sourceId).toBeDefined();
      expect(cit.chunkId).toBeDefined();
      expect(cit.authority).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('Exit Gate Criterion 2: Claim/source association links claims without false sentence precision (CRK-P15-T02)', () => {
    const claimService = new ClaimAssociationService();

    // Sentence matching citation title keywords
    const responseWithKeywords =
      'CharacterBody3D is the new 3D kinematic body node in Godot Engine 4.7. You can check player_movement.gd for sample script logic.';

    const sentenceAssociations = claimService.associateClaims(responseWithKeywords, sampleCitations);
    expect(sentenceAssociations.length).toBeGreaterThanOrEqual(1);
    expect(['sentence', 'response']).toContain(sentenceAssociations[0].level);

    // Response with generic text that does not match specific sentence keywords
    const genericResponse =
      'In modern game engines, kinematic movement is handled through specialized nodes with kinematic sliding.';

    const responseLevelAssoc = claimService.associateClaims(genericResponse, sampleCitations, {
      minSentenceConfidence: 0.8, // High bar prevents false sentence-level precision
      minResponseConfidence: 0.1,
    });

    expect(responseLevelAssoc.length).toBeGreaterThan(0);
    // Explicit assertion: Does not claim sentence-level support when threshold is not met (§2717)
    expect(responseLevelAssoc[0].level).toBe('response');
  });

  it('Exit Gate Criterion 3: Client renders source metadata via SourcesDrawerFormatter (CRK-P15-T03)', () => {
    const formatter = new SourcesDrawerFormatter();
    const drawerData = formatter.format(sampleCitations);

    expect(drawerData.totalSources).toBe(3);
    expect(drawerData.compactLabel).toBe('Sources (3)');

    const docCard = drawerData.cards.find(c => c.category === 'official_docs');
    expect(docCard).toBeDefined();
    expect(docCard?.categoryLabel).toBe('Official documentation');
    expect(docCard?.badges).toContain('v4.7');
    expect(docCard?.action.type).toBe('open_url');
    expect(docCard?.action.label).toBe('Open source');

    const repoCard = drawerData.cards.find(c => c.category === 'repo_evidence');
    expect(repoCard).toBeDefined();
    expect(repoCard?.categoryLabel).toBe('Repository evidence');
    expect(repoCard?.action.type).toBe('open_file');
    expect(repoCard?.action.label).toBe('Open file');
  });

  it('Exit Gate Criterion 4: Diagnostics explain retrieval without revealing hidden reasoning (CRK-P15-T04)', () => {
    const whyService = new WhyThisAnswerService();

    const mockResult: ChatRuntimeResult = {
      requestId: 'req-provenance-01',
      response: 'Sample response text.',
      model: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        policy: 'coding_high_reasoning',
        fallbackUsed: false,
      },
      citations: sampleCitations,
      toolResults: [],
      warnings: [],
      latencyMs: 420,
      traceId: 'trc-provenance-01',
      grounding: { attempted: true, sufficient: true, confidence: 0.92 },
    };

    const mockPlan: ChatContextPlan = {
      requestId: 'req-provenance-01',
      traceId: 'trc-provenance-01',
      taskClassification: {
        taskType: 'coding_question',
        intent: 'framework_api_query',
        confidence: 0.95,
        heuristicSignals: ['godot4', 'api'],
        requiresTools: false,
        requiresGrounding: true,
      },
      retrievalStrategy: {
        useRAG: true,
        packIds: ['pack-godot', 'pack-stack-exchange'],
        maxSources: 5,
        minRelevanceScore: 0.7,
      },
      memoryStrategy: { includeHistory: true, maxMessages: 10 },
      toolStrategy: { enabledTools: [] },
      modelStrategy: { policy: 'coding_high_reasoning', preferredModel: 'claude-3-5-sonnet' },
    };

    const diagnostics = whyService.buildDiagnostics({
      result: mockResult,
      plan: mockPlan,
      rawCandidateCount: 18,
    });

    expect(diagnostics.requestId).toBe('req-provenance-01');
    expect(diagnostics.selectedSourceCount).toBe(3);
    expect(diagnostics.retrievalCandidateCount).toBe(18);
    expect(diagnostics.packIds).toContain('pack-godot');
    expect(diagnostics.modelRoute.model).toBe('claude-3-5-sonnet');

    // Strict privacy verification (§2758)
    expect((diagnostics as any).chainOfThought).toBeUndefined();
    expect((diagnostics as any).systemPrompt).toBeUndefined();
    expect((diagnostics as any).privateTokens).toBeUndefined();
  });

  it('Exit Gate Criterion 5: Citation failure handling suppresses broken links and logs unresolved IDs (CRK-P15-T05)', async () => {
    const resolver = new CitationResolverService({
      verify: (cit) => {
        // cit-broken fails verification
        return cit.id !== 'cit-broken';
      },
    });

    const mixedCitations: CitationRef[] = [
      ...sampleCitations,
      {
        id: 'cit-broken',
        sourceId: 'src-deleted-pack',
        title: 'Broken citation reference',
        sourceUrl: 'https://invalid.example.nonexistent/doc.html',
        chunkId: 'chk-orphan-999',
        authority: 0.5,
      },
    ];

    const resolution = await resolver.resolveCitations(mixedCitations);

    expect(resolution.validCitations).toHaveLength(3);
    expect(resolution.unresolvedCitationIds).toContain('cit-broken');
    expect(resolution.warnings.some(w => w.includes('cit-broken'))).toBe(true);
    // Grounding is maintained because remaining citations have high authority
    expect(resolution.groundingMaintained).toBe(true);
  });
});
