import {
  ImplementationCommandId,
  ImplementationCommandConfig,
} from '../../types/program-completion';

export class VerificationCommandsOrchestrator {
  public static readonly CANONICAL_COMMANDS: ImplementationCommandConfig[] = [
    {
      id: 'test:chat-runtime',
      description: 'Executes Canonical Chat Runtime and compatibility adapter tests',
      category: 'unit_integration',
      commandLine: 'jest --testPathPattern=src/core/chat --runInBand',
      isFakeOrMockProhibited: true,
    },
    {
      id: 'test:conversation-state',
      description: 'Executes conversation variables and state reducer tests',
      category: 'unit_integration',
      commandLine: 'jest --testPathPattern=src/core/state --runInBand',
      isFakeOrMockProhibited: true,
    },
    {
      id: 'test:context-planner',
      description: 'Executes context routing signals and matrix tests',
      category: 'unit_integration',
      commandLine: 'jest src/core/chat/__tests__/context-planner-matrix.test.ts --runInBand',
      isFakeOrMockProhibited: true,
    },
    {
      id: 'test:knowledge',
      description: 'Executes knowledge pack infrastructure, packs, and policies tests',
      category: 'unit_integration',
      commandLine: 'jest --testPathPattern=src/core/knowledge --runInBand',
      isFakeOrMockProhibited: true,
    },
    {
      id: 'test:knowledge:migrations',
      description: 'Executes database schema migration tests for knowledge datasets',
      category: 'unit_integration',
      commandLine: 'jest src/core/knowledge/__tests__/knowledge-infrastructure-integration.test.ts --runInBand',
      isFakeOrMockProhibited: true,
    },
    {
      id: 'test:retrieval',
      description: 'Executes retrieval policy, conflict resolution, and router tests',
      category: 'unit_integration',
      commandLine: 'jest src/core/knowledge/__tests__/coding-retrieval-policy.test.ts src/core/knowledge/__tests__/general-retrieval-policy.test.ts src/core/knowledge/__tests__/knowledge-router.test.ts --runInBand',
      isFakeOrMockProhibited: true,
    },
    {
      id: 'test:model-policy',
      description: 'Executes model registry, fallback planner, and health checker tests',
      category: 'unit_integration',
      commandLine: 'jest src/core/providers/__tests__/model-registry-policy.test.ts --runInBand',
      isFakeOrMockProhibited: true,
    },
    {
      id: 'test:prompt-assembler',
      description: 'Executes prompt and context assembler tests',
      category: 'unit_integration',
      commandLine: 'jest src/core/prompt/__tests__/prompt-assembler.test.ts --runInBand',
      isFakeOrMockProhibited: true,
    },
    {
      id: 'test:grounding',
      description: 'Executes grounding evaluator, abstention, and wording policy tests',
      category: 'unit_integration',
      commandLine: 'jest src/core/evals/__tests__/grounding-abstention.test.ts --runInBand',
      isFakeOrMockProhibited: true,
    },
    {
      id: 'test:tool-truth',
      description: 'Executes tool truthfulness, side-effect ledger, and failure tests',
      category: 'unit_integration',
      commandLine: 'jest src/core/tools/__tests__/tool-truthfulness-failure.test.ts --runInBand',
      isFakeOrMockProhibited: true,
    },
    {
      id: 'test:feedback',
      description: 'Executes canonical feedback consolidation and triage tests',
      category: 'unit_integration',
      commandLine: 'jest src/core/feedback/__tests__/feedback-consolidation-integration.test.ts --runInBand',
      isFakeOrMockProhibited: true,
    },
    {
      id: 'test:chat-diagnostics',
      description: 'Executes chat diagnostics, run record repository, and route tests',
      category: 'unit_integration',
      commandLine: 'jest src/core/diagnostics/__tests__/chat-diagnostics.test.ts --runInBand',
      isFakeOrMockProhibited: true,
    },
    {
      id: 'eval:chat:smoke',
      description: 'Runs PR smoke tier golden conversation evaluations',
      category: 'eval_regression',
      commandLine: 'jest src/core/evals/__tests__/golden-regression-suite.test.ts --runInBand',
      isFakeOrMockProhibited: true,
    },
    {
      id: 'eval:chat:full',
      description: 'Runs full 500-case golden regression evaluation runner',
      category: 'eval_regression',
      commandLine: 'tsx scripts/canonical-cli.ts chat:runtime:golden',
      isFakeOrMockProhibited: true,
    },
    {
      id: 'eval:retrieval',
      description: 'Runs version conflict and retrieval scoring evaluation benchmarks',
      category: 'eval_regression',
      commandLine: 'jest src/core/knowledge/__tests__/version-conflict-benchmark.test.ts --runInBand',
      isFakeOrMockProhibited: true,
    },
    {
      id: 'eval:datasets',
      description: 'Runs dataset and policy A/B evaluation suite',
      category: 'eval_regression',
      commandLine: 'jest src/core/evals/__tests__/dataset-ab-eval.test.ts --runInBand',
      isFakeOrMockProhibited: true,
    },
  ];

  private commands: Map<ImplementationCommandId, ImplementationCommandConfig> = new Map();

  constructor() {
    for (const cmd of VerificationCommandsOrchestrator.CANONICAL_COMMANDS) {
      this.commands.set(cmd.id, { ...cmd });
    }
  }

  public getCommand(id: ImplementationCommandId): ImplementationCommandConfig | undefined {
    return this.commands.get(id);
  }

  public listCommands(): ImplementationCommandConfig[] {
    return Array.from(this.commands.values());
  }

  public validateNonFakeCommand(id: ImplementationCommandId, commandLine: string): boolean {
    const prohibitedTokens = ['echo "passed"', 'exit 0', 'true', 'echo ok', 'return true'];
    const lower = commandLine.toLowerCase().trim();
    for (const token of prohibitedTokens) {
      if (lower === token || lower.startsWith(token + ' ') || lower.endsWith(' ' + token)) {
        return false;
      }
    }
    return true;
  }

  public auditAllCommands(): { total: number; valid: number; invalid: ImplementationCommandId[] } {
    const invalid: ImplementationCommandId[] = [];
    for (const [id, cmd] of this.commands.entries()) {
      if (!this.validateNonFakeCommand(id, cmd.commandLine)) {
        invalid.push(id);
      }
    }
    return {
      total: this.commands.size,
      valid: this.commands.size - invalid.length,
      invalid,
    };
  }
}
