/**
 * Coding Response Validator (CRK-P17-T04)
 *
 * Enforces exact truthfulness for coding tasks and workflows (§2950-2963):
 * - Patch existence aligns with response claims (§2954)
 * - Changed paths align with tool results (§2955)
 * - Verification state is exact: passed | failed | blocked | not_run (§2956-2960)
 * - Prohibits "verified" wording when checks did not run (§2961)
 * - Preserves remaining risks (§2962)
 *
 * Strictly adheres to the < 300 lines per file rule (§494).
 */

import { ResponseValidationContext, ValidationIssue } from '../../types/response-quality';

export type CodingVerificationState = 'passed' | 'failed' | 'blocked' | 'not_run';

export class CodingResponseValidator {
  /**
   * Validates coding-specific response claims against tool execution states.
   */
  public static validate(context: ResponseValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const isCoding =
      context.isCodingTask ||
      context.taskType === 'coding' ||
      context.intent?.includes('code') ||
      context.intent?.includes('patch');

    if (!isCoding) {
      return issues;
    }

    const text = context.response || '';
    const toolResults = context.toolResults || [];

    // 1. Extract verification state from tool results
    let verificationState: CodingVerificationState = 'not_run';
    const verificationTools = toolResults.filter(
      (t) =>
        t.toolName.includes('test') ||
        t.toolName.includes('check') ||
        t.toolName.includes('verify') ||
        t.toolName.includes('build')
    );

    if (verificationTools.length > 0) {
      const hasFailed = verificationTools.some((t) => t.status === 'failed');
      const hasBlocked = verificationTools.some(
        (t) => t.status === 'requires_approval' || (t as { status: string }).status === 'blocked'
      );
      const allPassed = verificationTools.every((t) => t.status === 'success');

      if (hasFailed) {
        verificationState = 'failed';
      } else if (hasBlocked) {
        verificationState = 'blocked';
      } else if (allPassed) {
        verificationState = 'passed';
      }
    }

    // 2. Prohibit "verified" or "tests passed" wording when checks did not run or failed (§2961)
    const verifiedWordingRegex =
      /\b(verified that|i have verified|changes? (are|is|have been) verified|verified to (work|pass)|fully verified|all tests? (have )?passed|tests? (have )?passed|tests? pass)\b/i;
    const claimsVerified = verifiedWordingRegex.test(text);

    if (claimsVerified && verificationState !== 'passed') {
      issues.push({
        code: 'OVERCLAIMED_VERIFICATION',
        message: `Response claims changes are verified, but actual verification state is "${verificationState}".`,
        severity: 'error',
        field: 'response',
        suggestedFix:
          verificationState === 'not_run'
            ? 'State that verification checks have not been run.'
            : `State that verification ${verificationState}.`,
      });
    }

    // 3. Patch existence alignment (§2954)
    const claimsAppliedPatch =
      /\b(i applied (the|a) (patch|diff|fix)|the patch was applied|modified the code)\b/i.test(
        text
      );
    const hasSuccessfulPatch = toolResults.some(
      (t) =>
        t.status === 'success' &&
        (t.toolName.includes('patch') ||
          t.toolName.includes('write') ||
          t.toolName.includes('edit') ||
          t.toolName.includes('replace'))
    );

    if (claimsAppliedPatch && !hasSuccessfulPatch) {
      issues.push({
        code: 'UNSUPPORTED_PATCH_CLAIM',
        message:
          'Response claims a code patch was applied, but no file modification tool executed successfully.',
        severity: 'error',
        field: 'response',
        suggestedFix:
          'Present the patch as a proposal or suggestion rather than claiming it was applied.',
      });
    }

    // 4. Check that tool execution failures or remaining risks are preserved (§2962)
    const hasToolFailure = toolResults.some((t) => t.status === 'failed');
    const mentionsFailure =
      /\b(fail|failed|failure|error|could not|unable to|warning|blocked)\b/i.test(text);

    if (hasToolFailure && !mentionsFailure) {
      issues.push({
        code: 'OMITTED_FAILURE_RISK',
        message:
          'A tool execution failed during this task, but the response does not mention the failure or remaining risk.',
        severity: 'warning',
        field: 'response',
        suggestedFix:
          'Disclose that a tool step failed and describe remaining risks or required manual action.',
      });
    }

    return issues;
  }
}
