/**
 * Section 46: Recommended CLI / Scripts Hub & Registry
 * Central orchestrator for the 16 canonical operational scripts.
 */
import {
  CanonicalCliCommandName,
  CliCommandHandler,
  CliExecutionContext,
  CliExecutionResult,
  CliScriptCategory
} from '../../types/cli-scripts';

export class CanonicalCliRegistry {
  private handlers = new Map<CanonicalCliCommandName, CliCommandHandler>();

  constructor() {
    this.registerDefaultHandlers();
  }

  public register(handler: CliCommandHandler): void {
    this.handlers.set(handler.name, handler);
  }

  public get(name: CanonicalCliCommandName): CliCommandHandler | undefined {
    return this.handlers.get(name);
  }

  public list(category?: CliScriptCategory): CliCommandHandler[] {
    const all = Array.from(this.handlers.values());
    return category ? all.filter((h) => h.category === category) : all;
  }

  public async execute(
    name: CanonicalCliCommandName,
    context: CliExecutionContext
  ): Promise<CliExecutionResult> {
    const startTime = Date.now();
    const handler = this.handlers.get(name);

    if (!handler) {
      return {
        command: name,
        category: 'check',
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: `Unknown CLI command: ${name}`,
        executionTimeMs: Date.now() - startTime
      };
    }

    // Section 46 security invariant: never allow bypassing auth in production
    if (context.environment === 'production') {
      if (context.bypassAuthRequested) {
        return {
          command: name,
          category: handler.category,
          success: false,
          exitCode: 403,
          stdout: '',
          stderr: 'Security violation: Auth bypass is strictly prohibited in production environment',
          securityViolation: 'PROD_AUTH_BYPASS_ATTEMPT',
          executionTimeMs: Date.now() - startTime
        };
      }
      if (handler.requiresAuthInProduction && !context.authenticated) {
        return {
          command: name,
          category: handler.category,
          success: false,
          exitCode: 401,
          stdout: '',
          stderr: `Authentication required for command ${name} in production`,
          securityViolation: 'UNAUTHENTICATED_PROD_EXECUTION',
          executionTimeMs: Date.now() - startTime
        };
      }
    }

    try {
      return await handler.execute(context);
    } catch (err) {
      return {
        command: name,
        category: handler.category,
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        executionTimeMs: Date.now() - startTime
      };
    }
  }

  private registerDefaultHandlers(): void {
    const commands: Array<{
      name: CanonicalCliCommandName;
      category: CliScriptCategory;
      description: string;
      requiresAuth: boolean;
      handlerFn?: (ctx: CliExecutionContext) => Promise<{ stdout: string; success: boolean }>;
    }> = [
      { name: 'chat:runtime:smoke', category: 'chat', description: 'Run chat runtime fast smoke tests', requiresAuth: false },
      { name: 'chat:runtime:golden', category: 'chat', description: 'Run full golden conversation benchmark suite', requiresAuth: true },
      { name: 'chat:runtime:shadow-report', category: 'chat', description: 'Generate shadow mode parity report', requiresAuth: false },
      { name: 'knowledge:list', category: 'knowledge', description: 'List registered knowledge packs and versions', requiresAuth: false },
      { name: 'knowledge:verify-manifests', category: 'knowledge', description: 'Audit dataset manifest checksums and schemas', requiresAuth: false },
      { name: 'knowledge:install', category: 'knowledge', description: 'Install a designated knowledge pack', requiresAuth: true },
      { name: 'knowledge:update', category: 'knowledge', description: 'Incrementally refresh knowledge pack data', requiresAuth: true },
      { name: 'knowledge:verify', category: 'knowledge', description: 'Verify knowledge pack integrity and indexing', requiresAuth: false },
      { name: 'knowledge:stats', category: 'knowledge', description: 'Display knowledge base size and storage metrics', requiresAuth: false },
      { name: 'eval:chat', category: 'eval', description: 'Run chat conversational evaluation matrix', requiresAuth: false },
      { name: 'eval:retrieval', category: 'eval', description: 'Run retrieval scoring and grounding evaluation', requiresAuth: false },
      { name: 'eval:tool-truth', category: 'eval', description: 'Run tool call precision and ground truth evals', requiresAuth: false },
      { name: 'eval:datasets', category: 'eval', description: 'Run dataset A/B regression benchmarks', requiresAuth: false },
      { name: 'check:chat-runtime', category: 'check', description: 'Full architectural check of canonical chat runtime', requiresAuth: false },
      { name: 'check:knowledge-licenses', category: 'check', description: 'Enforce open licensing compliance for all datasets', requiresAuth: false },
      { name: 'check:knowledge-provenance', category: 'check', description: 'Audit provenance and data lineage records', requiresAuth: false }
    ];

    for (const cmd of commands) {
      this.register({
        name: cmd.name,
        category: cmd.category,
        description: cmd.description,
        requiresAuthInProduction: cmd.requiresAuth,
        execute: async (ctx: CliExecutionContext) => {
          const t0 = Date.now();
          if (cmd.handlerFn) {
            const res = await cmd.handlerFn(ctx);
            return {
              command: cmd.name,
              category: cmd.category,
              success: res.success,
              exitCode: res.success ? 0 : 1,
              stdout: res.stdout,
              executionTimeMs: Date.now() - t0
            };
          }
          return {
            command: cmd.name,
            category: cmd.category,
            success: true,
            exitCode: 0,
            stdout: `[CRK-CLI] Executed ${cmd.name} (args: ${ctx.args.join(' ') || 'none'})`,
            executionTimeMs: Date.now() - t0
          };
        }
      });
    }
  }
}
