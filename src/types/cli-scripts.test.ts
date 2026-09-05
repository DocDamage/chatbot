import {
  CliScriptCategorySchema,
  CanonicalCliCommandNameSchema,
  CliExecutionContextSchema,
  CliExecutionResultSchema
} from './cli-scripts';

describe('cli-scripts types', () => {
  it('validates canonical script categories', () => {
    expect(CliScriptCategorySchema.safeParse('chat').success).toBe(true);
    expect(CliScriptCategorySchema.safeParse('knowledge').success).toBe(true);
    expect(CliScriptCategorySchema.safeParse('eval').success).toBe(true);
    expect(CliScriptCategorySchema.safeParse('check').success).toBe(true);
    expect(CliScriptCategorySchema.safeParse('invalid_cat').success).toBe(false);
  });

  it('validates all 16 canonical CLI command names', () => {
    const commands = [
      'chat:runtime:smoke',
      'chat:runtime:golden',
      'chat:runtime:shadow-report',
      'knowledge:list',
      'knowledge:verify-manifests',
      'knowledge:install',
      'knowledge:update',
      'knowledge:verify',
      'knowledge:stats',
      'eval:chat',
      'eval:retrieval',
      'eval:tool-truth',
      'eval:datasets',
      'check:chat-runtime',
      'check:knowledge-licenses',
      'check:knowledge-provenance'
    ];
    for (const cmd of commands) {
      expect(CanonicalCliCommandNameSchema.safeParse(cmd).success).toBe(true);
    }
    expect(CanonicalCliCommandNameSchema.safeParse('random:command').success).toBe(false);
  });

  it('validates execution context and result schemas', () => {
    const context = CliExecutionContextSchema.parse({
      environment: 'production',
      authenticated: true,
      args: ['--pack', 'official_docs']
    });
    expect(context.environment).toBe('production');
    expect(context.authenticated).toBe(true);

    const result = CliExecutionResultSchema.parse({
      command: 'knowledge:verify',
      category: 'knowledge',
      success: true,
      exitCode: 0,
      stdout: 'Verified successfully',
      executionTimeMs: 42
    });
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });
});
