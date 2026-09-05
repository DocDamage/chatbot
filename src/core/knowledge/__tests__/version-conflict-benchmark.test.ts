import { RetrievalPolicyEngine } from '../RetrievalPolicyEngine';
import { RetrievalConflictResolver } from '../RetrievalConflictResolver';
import {
  CandidateEvidence,
  SourceAuthorityTier,
  VersionCompatibilityStatus
} from '../../../types/retrieval-scoring';

describe('Version & Quality Retrieval Conflict Benchmark (§1983-1991, CRK-P09)', () => {
  let engine: RetrievalPolicyEngine;
  let conflictResolver: RetrievalConflictResolver;

  beforeEach(() => {
    engine = new RetrievalPolicyEngine();
    conflictResolver = new RetrievalConflictResolver();
  });

  it('Benchmark 1: Godot 3 answer does not outrank Godot 4.7 docs for a 4.7 project (§1986)', () => {
    const godot3Answer: CandidateEvidence = {
      id: 'godot-3-so',
      content: 'In Godot 3, use yield(get_tree(), "idle_frame")',
      sourceUri: 'https://stackoverflow.com/questions/12345/godot-yield',
      authorityTier: SourceAuthorityTier.ACCEPTED_DEV_QA,
      domain: 'coding',
      publishedAt: '2020-01-01',
      versionContext: {
        product: 'godot',
        projectDetected: '4.7.0',
        sourceVersion: '3.5.0'
      },
      qualitySignals: { isAcceptedAnswer: true, score: 45 },
      rawSimilarity: 0.95, // High similarity from text match
      rawLexical: 0.90
    };

    const godot4Docs: CandidateEvidence = {
      id: 'godot-4-official',
      content: 'In Godot 4, yield was replaced by await get_tree().process_frame',
      sourceUri: 'https://docs.godotengine.org/en/4.7/tutorials/scripting/gdscript.html',
      authorityTier: SourceAuthorityTier.OFFICIAL_DOCS,
      domain: 'coding',
      publishedAt: new Date().toISOString(),
      versionContext: {
        product: 'godot',
        projectDetected: '4.7.0',
        sourceVersion: '4.7.0'
      },
      qualitySignals: { isOfficialStatus: true },
      rawSimilarity: 0.78, // Slightly lower text match
      rawLexical: 0.75
    };

    const ranked = engine.rank([godot3Answer, godot4Docs]);

    // Godot 4 official docs must rank #1 over obsolete Godot 3 answer
    expect(ranked[0].id).toBe('godot-4-official');
    expect(ranked[0].versionStatus).toBe(VersionCompatibilityStatus.EXACT);
    expect(ranked[1].versionStatus).toBe(VersionCompatibilityStatus.OLDER_MAJOR);
    expect(ranked[0].breakdown.finalScore).toBeGreaterThan(ranked[1].breakdown.finalScore);
  });

  it('Benchmark 2: Random blog does not outrank official TypeScript docs (§1987)', () => {
    const randomBlog: CandidateEvidence = {
      id: 'random-blog',
      content: 'Here is my tutorial on TypeScript generics syntax tricks',
      sourceUri: 'https://some-personal-blog.org/ts-generics',
      authorityTier: SourceAuthorityTier.GENERAL_WEB,
      domain: 'web_dev',
      publishedAt: '2022-05-10',
      versionContext: { product: 'typescript', requested: '5.4', sourceVersion: '5.4' },
      qualitySignals: { spamScore: 0.1 },
      rawSimilarity: 0.88,
      rawLexical: 0.85
    };

    const officialTsDocs: CandidateEvidence = {
      id: 'ts-official-docs',
      content: 'TypeScript Handbook: Generics specification and constraints',
      sourceUri: 'https://www.typescriptlang.org/docs/handbook/2/generics.html',
      authorityTier: SourceAuthorityTier.OFFICIAL_DOCS,
      domain: 'web_dev',
      publishedAt: new Date().toISOString(),
      versionContext: { product: 'typescript', requested: '5.4', sourceVersion: '5.4' },
      qualitySignals: { isOfficialStatus: true },
      rawSimilarity: 0.82,
      rawLexical: 0.80
    };

    const ranked = engine.rank([randomBlog, officialTsDocs]);
    expect(ranked[0].id).toBe('ts-official-docs');
    expect(ranked[0].breakdown.authorityScore).toBe(0.95);
    expect(ranked[1].breakdown.authorityScore).toBe(0.42);
  });

  it('Benchmark 3: Old Stack Overflow workaround does not outrank current API docs (§1988)', () => {
    const oldSoWorkaround: CandidateEvidence = {
      id: 'old-so-hack',
      content: 'Node.js 8 does not have fetch, install node-fetch and require it',
      sourceUri: 'https://stackoverflow.com/questions/555/node-fetch-hack',
      authorityTier: SourceAuthorityTier.ACCEPTED_DEV_QA,
      domain: 'coding',
      publishedAt: '2017-06-01', // Very old
      versionContext: { product: 'nodejs', projectDetected: '20.10.0', sourceVersion: '8.0.0' },
      qualitySignals: { isAcceptedAnswer: true, score: 120 },
      rawSimilarity: 0.92
    };

    const modernApiDocs: CandidateEvidence = {
      id: 'node-official-fetch',
      content: 'Node.js 18+ provides global fetch API out of the box with zero dependencies',
      sourceUri: 'https://nodejs.org/docs/latest-v20.x/api/globals.html#fetch',
      authorityTier: SourceAuthorityTier.OFFICIAL_DOCS,
      domain: 'coding',
      publishedAt: new Date().toISOString(),
      versionContext: { product: 'nodejs', projectDetected: '20.10.0', sourceVersion: '20.10.0' },
      qualitySignals: { isOfficialStatus: true },
      rawSimilarity: 0.85
    };

    const ranked = engine.rank([oldSoWorkaround, modernApiDocs]);
    expect(ranked[0].id).toBe('node-official-fetch');
    expect(ranked[0].breakdown.freshnessScore).toBeGreaterThan(0.9);
    expect(ranked[1].breakdown.freshnessScore).toBeLessThan(0.01);
  });

  it('Benchmark 4: Irrelevant high-authority source does NOT beat highly relevant lower source (§1989)', () => {
    const irrelevantW3cSpec: CandidateEvidence = {
      id: 'w3c-spec',
      content: 'Abstract formal syntax definition of CSS Box Model 3',
      sourceUri: 'https://www.w3.org/TR/css-box-3/',
      authorityTier: SourceAuthorityTier.OFFICIAL_SPEC,
      domain: 'web_dev',
      publishedAt: new Date().toISOString(),
      rawSimilarity: 0.12, // Irrelevant to the user's specific practical problem
      rawLexical: 0.10
    };

    const relevantDevQa: CandidateEvidence = {
      id: 'so-flexbox-gap',
      content: 'To create space between flex items in modern browsers, simply use gap: 16px',
      sourceUri: 'https://stackoverflow.com/questions/444/flexbox-gap',
      authorityTier: SourceAuthorityTier.ACCEPTED_DEV_QA,
      domain: 'web_dev',
      publishedAt: new Date().toISOString(),
      qualitySignals: { isAcceptedAnswer: true, score: 85 },
      rawSimilarity: 0.96, // Exact semantic match
      rawLexical: 0.92
    };

    const ranked = engine.rank([irrelevantW3cSpec, relevantDevQa]);
    // Authority alone cannot compensate for complete lack of semantic relevance
    expect(ranked[0].id).toBe('so-flexbox-gap');
    expect(ranked[0].breakdown.finalScore).toBeGreaterThan(ranked[1].breakdown.finalScore);
  });

  it('Benchmark 5: Stale source can still win when user explicitly asks for historical version (§1990)', () => {
    const godot3Source: CandidateEvidence = {
      id: 'godot-3-docs',
      content: 'In Godot 3.5, kinematic body physics uses move_and_slide()',
      sourceUri: 'https://docs.godotengine.org/en/3.5/classes/class_kinematicbody.html',
      authorityTier: SourceAuthorityTier.OFFICIAL_DOCS,
      domain: 'coding',
      publishedAt: '2021-01-01',
      versionContext: {
        product: 'godot',
        requested: '3.5', // Explicit historical request
        sourceVersion: '3.5.0'
      },
      rawSimilarity: 0.85
    };

    const godot4Docs: CandidateEvidence = {
      id: 'godot-4-docs',
      content: 'In Godot 4.7, CharacterBody3D replaces KinematicBody',
      sourceUri: 'https://docs.godotengine.org/en/4.7/classes/class_characterbody3d.html',
      authorityTier: SourceAuthorityTier.OFFICIAL_DOCS,
      domain: 'coding',
      publishedAt: new Date().toISOString(),
      versionContext: {
        product: 'godot',
        requested: '3.5', // User wants 3.5
        sourceVersion: '4.7.0'
      },
      rawSimilarity: 0.84
    };

    const ranked = engine.rank([godot3Source, godot4Docs]);
    expect(ranked[0].id).toBe('godot-3-docs');
    expect(ranked[0].versionStatus).toBe(VersionCompatibilityStatus.EXACT);
    expect(ranked[1].versionStatus).toBe(VersionCompatibilityStatus.KNOWN_INCOMPATIBLE);
  });

  it('Phase 09 Exit Gate: conflict resolution suppresses incompatible versions and records audit conflicts', () => {
    const godot3Answer: CandidateEvidence = {
      id: 'godot-3',
      content: 'yield syntax in Godot 3',
      sourceUri: 'https://stackoverflow.com/questions/1',
      authorityTier: SourceAuthorityTier.ACCEPTED_DEV_QA,
      versionContext: { product: 'godot', requested: '4.7', sourceVersion: '3.2' },
      rawSimilarity: 0.90
    };

    const godot4Docs: CandidateEvidence = {
      id: 'godot-4',
      content: 'await syntax in Godot 4',
      sourceUri: 'https://docs.godotengine.org/en/4.7',
      authorityTier: SourceAuthorityTier.OFFICIAL_DOCS,
      versionContext: { product: 'godot', requested: '4.7', sourceVersion: '4.7' },
      rawSimilarity: 0.82
    };

    const ranked = engine.rank([godot3Answer, godot4Docs]);
    const outcome = conflictResolver.resolveConflicts(ranked, 'godot-yield-syntax');

    expect(outcome.preferred).toHaveLength(1);
    expect(outcome.preferred[0].id).toBe('godot-4');
    expect(outcome.conflicts).toHaveLength(1);
    expect(outcome.conflicts[0].reason).toBe('version_match');
  });
});
