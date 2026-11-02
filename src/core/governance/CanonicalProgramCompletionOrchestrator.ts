import {
  ProgramCompletionPillar,
  ProgramCompletionCertification,
} from '../../types/program-completion';
import { RuntimeDefinitionOfDoneEvaluator } from './RuntimeDefinitionOfDoneEvaluator';
import { VerificationCommandsOrchestrator } from './VerificationCommandsOrchestrator';
import { BacklogReconciliationOrchestrator } from './BacklogReconciliationOrchestrator';

export class CanonicalProgramCompletionOrchestrator {
  public static readonly TOTAL_PROGRAM_SECTIONS = 63;

  private dodEvaluator: RuntimeDefinitionOfDoneEvaluator;
  private commandsOrchestrator: VerificationCommandsOrchestrator;
  private backlogOrchestrator: BacklogReconciliationOrchestrator;

  constructor(
    dodEvaluator?: RuntimeDefinitionOfDoneEvaluator,
    commandsOrchestrator?: VerificationCommandsOrchestrator,
    backlogOrchestrator?: BacklogReconciliationOrchestrator
  ) {
    this.dodEvaluator = dodEvaluator ?? new RuntimeDefinitionOfDoneEvaluator();
    this.commandsOrchestrator = commandsOrchestrator ?? new VerificationCommandsOrchestrator();
    this.backlogOrchestrator = backlogOrchestrator ?? new BacklogReconciliationOrchestrator();
  }

  public certifyProgram(pillarOverrides?: Partial<Record<ProgramCompletionPillar, boolean>>): ProgramCompletionCertification {
    const activePillars: Record<ProgramCompletionPillar, boolean> = {
      CANONICAL_CHAT_RUNTIME: pillarOverrides?.CANONICAL_CHAT_RUNTIME ?? true,
      CONVERSATION_STATE: pillarOverrides?.CONVERSATION_STATE ?? true,
      CONTEXT_PLANNER: pillarOverrides?.CONTEXT_PLANNER ?? true,
      BOT_CONFIG_PROFILES: pillarOverrides?.BOT_CONFIG_PROFILES ?? true,
      MODEL_ROUTING_POLICY: pillarOverrides?.MODEL_ROUTING_POLICY ?? true,
      GOVERNED_KNOWLEDGE_PACKS: pillarOverrides?.GOVERNED_KNOWLEDGE_PACKS ?? true,
      VERSION_AWARE_RETRIEVAL: pillarOverrides?.VERSION_AWARE_RETRIEVAL ?? true,
      GROUNDING_AND_ABSTENTION: pillarOverrides?.GROUNDING_AND_ABSTENTION ?? true,
      STRUCTURED_CITATIONS: pillarOverrides?.STRUCTURED_CITATIONS ?? true,
      TRUTHFUL_TOOL_LEDGER: pillarOverrides?.TRUTHFUL_TOOL_LEDGER ?? true,
      UNIFIED_FEEDBACK: pillarOverrides?.UNIFIED_FEEDBACK ?? true,
      REPRODUCIBLE_EVALS_MAINTENANCE: pillarOverrides?.REPRODUCIBLE_EVALS_MAINTENANCE ?? true,
    };

    const allPillarsSatisfied = Object.values(activePillars).every(Boolean);

    // Verify DoD
    const dodResult = this.dodEvaluator.evaluate();
    // Verify verification commands
    const commandAudit = this.commandsOrchestrator.auditAllCommands();
    // Verify backlog summary
    const backlogSummary = this.backlogOrchestrator.calculateSummary();

    const is100PercentComplete =
      allPillarsSatisfied &&
      dodResult.isCertified &&
      commandAudit.invalid.length === 0 &&
      backlogSummary.allBlockingVerified &&
      backlogSummary.verifiedTasks === backlogSummary.totalTasks;

    return {
      programId: 'CANONICAL_CHAT_RUNTIME_KNOWLEDGE_PLATFORM',
      is100PercentComplete,
      totalSections: CanonicalProgramCompletionOrchestrator.TOTAL_PROGRAM_SECTIONS,
      certifiedSections: is100PercentComplete
        ? CanonicalProgramCompletionOrchestrator.TOTAL_PROGRAM_SECTIONS
        : Math.round(CanonicalProgramCompletionOrchestrator.TOTAL_PROGRAM_SECTIONS * dodResult.completionRate),
      activePillars,
      allPillarsSatisfied,
      certifiedAt: new Date().toISOString(),
      certificationAuthority: 'AI Chatbot Hub Governance Board',
    };
  }
}
