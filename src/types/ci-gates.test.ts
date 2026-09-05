import {
  CIGateScopeSchema,
  PRCIGateNameSchema,
  ReleaseOnlyCIGateNameSchema,
  CIGateNameSchema
} from './ci-gates';

describe('ci-gates types (§48)', () => {
  it('validates CI gate scopes', () => {
    expect(CIGateScopeSchema.safeParse('pr').success).toBe(true);
    expect(CIGateScopeSchema.safeParse('release_only').success).toBe(true);
    expect(CIGateScopeSchema.safeParse('nightly').success).toBe(false);
  });

  it('validates all 13 PR CI gate names', () => {
    const prGates = [
      'chat-runtime-unit',
      'chat-runtime-integration',
      'conversation-state',
      'context-planner',
      'knowledge-manifest',
      'knowledge-db-migrations',
      'knowledge-adapter-fixtures',
      'retrieval-evals',
      'tool-truth-evals',
      'golden-chat-smoke',
      'client-knowledge-ui',
      'client-feedback-ui',
      'diagnostics-redaction'
    ];
    expect(prGates.length).toBe(13);
    for (const gate of prGates) {
      expect(PRCIGateNameSchema.safeParse(gate).success).toBe(true);
      expect(CIGateNameSchema.safeParse(gate).success).toBe(true);
    }
  });

  it('validates all 5 release-only CI gate names', () => {
    const releaseGates = [
      'full-golden-suite',
      'live-provider-canary',
      'default-pack-evaluation',
      'knowledge-refresh-canary',
      'large-index-performance'
    ];
    expect(releaseGates.length).toBe(5);
    for (const gate of releaseGates) {
      expect(ReleaseOnlyCIGateNameSchema.safeParse(gate).success).toBe(true);
      expect(CIGateNameSchema.safeParse(gate).success).toBe(true);
    }
  });
});
