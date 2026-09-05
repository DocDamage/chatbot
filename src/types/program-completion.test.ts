import {
  ImplementationCommandConfig,
  PackEvidenceAuditResult,
  TaskDoDAuditResult,
  CRKHandoffMetadata,
  ProhibitedShortcutViolation,
  ProgramCompletionCertification,
} from './program-completion';

describe('Program Completion Types', () => {
  it('validates implementation command config', () => {
    const config: ImplementationCommandConfig = {
      id: 'test:chat-runtime',
      description: 'Executes core chat runtime unit and integration tests',
      category: 'unit_integration',
      commandLine: 'jest --testPathPattern=src/core/chat',
      isFakeOrMockProhibited: true,
    };
    expect(config.id).toBe('test:chat-runtime');
    expect(config.isFakeOrMockProhibited).toBe(true);
  });

  it('validates pack evidence audit result', () => {
    const audit: PackEvidenceAuditResult = {
      packId: 'official-docs-pack',
      isDefaultPromoted: true,
      totalRequiredArtifacts: 15,
      presentArtifacts: ['manifest', 'license_review', 'source_version'],
      missingArtifacts: [],
      isFullyEvidenced: true,
    };
    expect(audit.isFullyEvidenced).toBe(true);
    expect(audit.totalRequiredArtifacts).toBe(15);
  });

  it('validates task DoD audit result', () => {
    const taskResult: TaskDoDAuditResult = {
      taskId: 'CRK-SPEC-56',
      isComplete: true,
      failedGates: [],
    };
    expect(taskResult.isComplete).toBe(true);
  });

  it('validates CRK handoff metadata and prohibited shortcut violation', () => {
    const metadata: CRKHandoffMetadata = {
      runtimeStageAffected: 'ContextPlanning',
      promptVersion: 'v2.1',
      modelPolicyVersion: 'v1.0',
    };
    expect(metadata.runtimeStageAffected).toBe('ContextPlanning');

    const violation: ProhibitedShortcutViolation = {
      code: 'FORWARD_ONLY_SHIM',
      description: 'Class only forwards to another orchestrator',
      affectedComponent: 'src/core/chat/ChatRuntime.ts',
      remediation: 'Implement real normalization and stage boundaries',
    };
    expect(violation.code).toBe('FORWARD_ONLY_SHIM');
  });

  it('validates program completion certification structure', () => {
    const certification: ProgramCompletionCertification = {
      programId: 'CANONICAL_CHAT_RUNTIME_KNOWLEDGE_PLATFORM',
      is100PercentComplete: true,
      totalSections: 63,
      certifiedSections: 63,
      activePillars: {
        CANONICAL_CHAT_RUNTIME: true,
        CONVERSATION_STATE: true,
        CONTEXT_PLANNER: true,
        BOT_CONFIG_PROFILES: true,
        MODEL_ROUTING_POLICY: true,
        GOVERNED_KNOWLEDGE_PACKS: true,
        VERSION_AWARE_RETRIEVAL: true,
        GROUNDING_AND_ABSTENTION: true,
        STRUCTURED_CITATIONS: true,
        TRUTHFUL_TOOL_LEDGER: true,
        UNIFIED_FEEDBACK: true,
        REPRODUCIBLE_EVALS_MAINTENANCE: true,
      },
      allPillarsSatisfied: true,
      certifiedAt: new Date().toISOString(),
      certificationAuthority: 'AI Chatbot Hub Governance Board',
    };
    expect(certification.is100PercentComplete).toBe(true);
    expect(certification.allPillarsSatisfied).toBe(true);
    expect(certification.certifiedSections).toBe(63);
  });
});
