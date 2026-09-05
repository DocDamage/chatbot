import { z } from 'zod';

export const CliScriptCategorySchema = z.enum([
  'chat',
  'knowledge',
  'eval',
  'check'
]);
export type CliScriptCategory = z.infer<typeof CliScriptCategorySchema>;

export const CanonicalCliCommandNameSchema = z.enum([
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
]);
export type CanonicalCliCommandName = z.infer<typeof CanonicalCliCommandNameSchema>;

export const CliExecutionContextSchema = z.object({
  environment: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  authenticated: z.boolean().default(false),
  operatorRole: z.string().optional(),
  bypassAuthRequested: z.boolean().default(false),
  args: z.array(z.string()).default([])
});
export type CliExecutionContext = z.infer<typeof CliExecutionContextSchema>;

export const CliExecutionResultSchema = z.object({
  command: CanonicalCliCommandNameSchema,
  category: CliScriptCategorySchema,
  success: z.boolean(),
  exitCode: z.number(),
  stdout: z.string(),
  stderr: z.string().optional(),
  securityViolation: z.string().optional(),
  executionTimeMs: z.number()
});
export type CliExecutionResult = z.infer<typeof CliExecutionResultSchema>;

export interface CliCommandHandler {
  name: CanonicalCliCommandName;
  category: CliScriptCategory;
  description: string;
  requiresAuthInProduction: boolean;
  execute(context: CliExecutionContext): Promise<CliExecutionResult>;
}
