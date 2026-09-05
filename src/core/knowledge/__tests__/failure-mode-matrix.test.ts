import { FailureModeMatrixHandler, FailureModeCode } from '../FailureModeMatrixHandler';

describe('FailureModeMatrixHandler (Section 35 Compliance)', () => {
  const all19Modes: FailureModeCode[] = [
    'PACK_NOT_INSTALLED',
    'DATASET_UPDATE_FAILED',
    'HALF_INDEXED_VERSION',
    'EMBEDDING_PROVIDER_FAILED',
    'VECTOR_SEARCH_FAILED',
    'LEXICAL_SEARCH_FAILED',
    'RERANKER_FAILED',
    'MODEL_UNAVAILABLE',
    'TOOL_BLOCKED',
    'PROJECT_UNAVAILABLE',
    'USER_DELETES_CONVERSATION',
    'FEEDBACK_WRITE_FAILED',
    'DIAGNOSTICS_PERSISTENCE_FAILED',
    'SOURCE_CITATION_MISSING',
    'STALE_TECHNICAL_SOURCE',
    'CONFLICTING_SOURCES',
    'DISK_LOW_DURING_INSTALL',
    'PROCESS_RESTART_DURING_INSTALL',
    'MALICIOUS_RETRIEVED_INSTRUCTIONS'
  ];

  it('covers every one of the 19 canonical failure modes defined in Section 35 table', () => {
    expect(all19Modes).toHaveLength(19);
    for (const mode of all19Modes) {
      const result = FailureModeMatrixHandler.resolveFailure(mode, {
        packId: 'test-pack',
        activeVersion: '1.0.0',
        model: 'primary-model',
        fallbackModel: 'fallback-model',
        toolName: 'bash'
      });
      expect(result.code).toBe(mode);
      expect(result.actionTaken).toBeDefined();
    }
  });

  it('handles PACK_NOT_INSTALLED with alternatives or honest unavailable notice', () => {
    const withAlt = FailureModeMatrixHandler.resolveFailure('PACK_NOT_INSTALLED', {
      packId: 'academic-arxiv',
      alternativePack: 'general-knowledge'
    });
    expect(withAlt.userFacingNotice).toContain("Falling back to 'general-knowledge'");

    const withoutAlt = FailureModeMatrixHandler.resolveFailure('PACK_NOT_INSTALLED', {
      packId: 'academic-arxiv'
    });
    expect(withoutAlt.userFacingNotice).toContain('not installed');
  });

  it('handles DATASET_UPDATE_FAILED by preserving previous READY version', () => {
    const res = FailureModeMatrixHandler.resolveFailure('DATASET_UPDATE_FAILED', {
      packId: 'dev-docs',
      activeVersion: '2026.1',
      error: 'Network timeout'
    });
    expect(res.actionTaken).toBe('PRESERVE_PREVIOUS_READY_VERSION');
    expect(res.operationalAlert).toContain('Keeping version 2026.1 active');
  });

  it('handles HALF_INDEXED_VERSION by refusing to route to non-ready versions', () => {
    const res = FailureModeMatrixHandler.resolveFailure('HALF_INDEXED_VERSION', {
      version: '2026.2',
      status: 'INDEXING',
      readyVersion: '2026.1'
    });
    expect(res.actionTaken).toBe('NEVER_ROUTE_TO_NON_READY_VERSION');
  });

  it('handles VECTOR_SEARCH_FAILED with graceful lexical fallback', () => {
    const res = FailureModeMatrixHandler.resolveFailure('VECTOR_SEARCH_FAILED');
    expect(res.actionTaken).toBe('FALLBACK_TO_LEXICAL_SEARCH');
    expect((res.fallbackData as any).degradedMode).toBe(true);
  });

  it('handles MODEL_UNAVAILABLE by routing to compatible fallback', () => {
    const res = FailureModeMatrixHandler.resolveFailure('MODEL_UNAVAILABLE', {
      model: 'gpt-4o',
      fallbackModel: 'claude-3-5-sonnet'
    });
    expect(res.isGraceful).toBe(true);
    expect(res.userFacingNotice).toContain("fallback 'claude-3-5-sonnet'");
  });

  it('handles PROJECT_UNAVAILABLE by abstaining rather than inventing false code', () => {
    const res = FailureModeMatrixHandler.resolveFailure('PROJECT_UNAVAILABLE');
    expect(res.actionTaken).toBe('ABSTAIN_NO_INVENTED_EVIDENCE');
    expect(res.userFacingNotice).toContain('not connected');
  });

  it('handles MALICIOUS_RETRIEVED_INSTRUCTIONS by enforcing inert boundary', () => {
    const res = FailureModeMatrixHandler.resolveFailure('MALICIOUS_RETRIEVED_INSTRUCTIONS');
    expect(res.actionTaken).toBe('INERT_EVIDENCE_BOUNDARY_ENFORCED');
    expect((res.fallbackData as any).executionSuppressed).toBe(true);
  });
});
