/**
 * Section 36: Testing Strategy Schemas and Contracts
 */
import { z } from 'zod';

export const TestTierSchema = z.enum([
  'UNIT',
  'INTEGRATION',
  'DATABASE',
  'BROWSER_E2E',
  'SECURITY',
  'EVAL',
]);
export type TestTier = z.infer<typeof TestTierSchema>;

export const RequiredUnitServiceSchema = z.enum([
  'request_normalizer',
  'variable_reducer',
  'context_planner',
  'pack_router',
  'authority_scorer',
  'freshness_scorer',
  'version_scorer',
  'quality_scorer',
  'composite_retrieval_scoring',
  'prompt_budget_truncation',
  'model_policy',
  'fallback_planner',
  'grounding_decision',
  'tool_result_language_mapping',
  'feedback_schema',
  'dataset_manifest_validation',
  'dataset_job_state_machine',
]);
export type RequiredUnitService = z.infer<typeof RequiredUnitServiceSchema>;

export const SecurityTestVectorSchema = z.enum([
  'prompt_injection',
  'cross_user_rag_isolation',
  'route_ownership',
  'malicious_dataset_metadata',
  'path_traversal_local_import',
  'ssrf_remote_config',
  'oversized_dataset_record',
  'html_script_rendering_sanitization',
  'source_url_validation',
]);
export type SecurityTestVector = z.infer<typeof SecurityTestVectorSchema>;

export const TestSuiteResultSchema = z.object({
  suiteId: z.string(),
  name: z.string(),
  tier: TestTierSchema,
  totalTests: z.number().nonnegative(),
  passedTests: z.number().nonnegative(),
  failedTests: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
  coveredServices: z.array(RequiredUnitServiceSchema).optional(),
  coveredSecurityVectors: z.array(SecurityTestVectorSchema).optional(),
});
export type TestSuiteResult = z.infer<typeof TestSuiteResultSchema>;

export const TestComplianceSummarySchema = z.object({
  certified: z.boolean(),
  totalTiersChecked: z.number().nonnegative(),
  totalSuites: z.number().nonnegative(),
  totalTestsPassed: z.number().nonnegative(),
  missingUnitServices: z.array(RequiredUnitServiceSchema),
  missingSecurityVectors: z.array(SecurityTestVectorSchema),
  tierResults: z.record(TestTierSchema, z.object({
    suitesCount: z.number().nonnegative(),
    testsPassed: z.number().nonnegative(),
    allPassed: z.boolean(),
  })),
});
export type TestComplianceSummary = z.infer<typeof TestComplianceSummarySchema>;
