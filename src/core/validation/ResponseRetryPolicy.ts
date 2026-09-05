/**
 * Bounded Response Retry Policy (CRK-P17-T05)
 *
 * Implements reason-specific remediation rules (§2964-2974):
 * - Malformed structured output -> retry_model (retry may help, bounded)
 * - Tool did not run -> remediate_tool (model retry cannot fabricate real tool evidence)
 * - Insufficient RAG evidence -> broaden_retrieval (not generic regenerate)
 * - Contradiction / safety -> abstain / policy-specific mitigation
 *
 * Strictly adheres to the < 300 lines per file rule (§494).
 */

import {
  RemediationAction,
  ValidationIssue,
  ResponseValidationContext,
} from '../../types/response-quality';

export interface RetryPolicyOptions {
  maxModelRetries?: number;
  currentAttempt?: number;
}

export class ResponseRetryPolicy {
  public static readonly DEFAULT_MAX_RETRIES = 2;

  /**
   * Determines the exact remediation action based on validation issues.
   */
  public static determineRemediation(
    issues: ValidationIssue[],
    options: RetryPolicyOptions = {}
  ): {
    retryRecommended: boolean;
    remediationAction: RemediationAction;
    correctedResponse?: string;
  } {
    const errorIssues = issues.filter((i) => i.severity === 'error');
    if (errorIssues.length === 0) {
      return {
        retryRecommended: false,
        remediationAction: 'none',
      };
    }

    const currentAttempt = options.currentAttempt ?? 0;
    const maxRetries = options.maxModelRetries ?? this.DEFAULT_MAX_RETRIES;
    const codes = new Set(errorIssues.map((i) => i.code));

    // 1. Tool-related claims cannot be resolved by regenerating text (§2971)
    if (
      codes.has('UNSUPPORTED_TOOL_CLAIM') ||
      codes.has('UNSUPPORTED_PATCH_CLAIM') ||
      codes.has('OVERCLAIMED_VERIFICATION')
    ) {
      return {
        retryRecommended: false,
        remediationAction: 'remediate_tool',
      };
    }

    // 2. Insufficient RAG evidence requires broadening retrieval, not blind model retry (§2972)
    if (codes.has('INSUFFICIENT_EVIDENCE')) {
      return {
        retryRecommended: false,
        remediationAction: 'broaden_retrieval',
      };
    }

    // 3. Contradiction or severe safety issue -> abstain (§2973)
    if (codes.has('CONTRADICTORY_EVIDENCE') || codes.has('POLICY_VIOLATION')) {
      return {
        retryRecommended: false,
        remediationAction: 'abstain',
      };
    }

    // 4. Malformed syntax / JSON / code block formatting -> model retry may help (§2970)
    if (
      codes.has('MALFORMED_CODE_BLOCK') ||
      codes.has('INVALID_JSON_FORMAT') ||
      codes.has('EMPTY_RESPONSE')
    ) {
      const canRetry = currentAttempt < maxRetries;
      return {
        retryRecommended: canRetry,
        remediationAction: canRetry ? 'retry_model' : 'abstain',
      };
    }

    return {
      retryRecommended: false,
      remediationAction: 'none',
    };
  }

  /**
   * Generates a safe fallback or corrected response when claims overreach evidence.
   */
  public static generateCorrectedResponse(
    context: ResponseValidationContext,
    issues: ValidationIssue[]
  ): string | undefined {
    let corrected = context.response;
    const codes = new Set(issues.map((i) => i.code));

    if (codes.has('UNSUPPORTED_TOOL_CLAIM') || codes.has('UNSUPPORTED_PATCH_CLAIM')) {
      corrected = corrected
        .replace(/\bi have (edited|modified|updated|rewritten|deleted|created) the file\b/gi, 'Here is the proposed change for the file')
        .replace(/\bthe file has been (edited|modified|updated|created|saved)\b/gi, 'The file can be updated with these changes')
        .replace(/\bi applied the (change|changes|patch|diff)\b/gi, 'Here are the recommended changes');
    }

    if (codes.has('OVERCLAIMED_VERIFICATION') || codes.has('UNSUPPORTED_TEST_CLAIM')) {
      corrected = corrected
        .replace(/\bi have verified\b/gi, 'Note: automated verification checks were not run for this modification')
        .replace(/\bchanges? (are|is|have been) verified\b/gi, 'changes have not been verified yet')
        .replace(/\ball tests? (have )?passed\b/gi, 'tests should be run to verify this change');
    }

    return corrected !== context.response ? corrected : undefined;
  }
}
