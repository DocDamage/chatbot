/**
 * Response Quality Gate (CRK Phase 17)
 *
 * Orchestrates response validation across core invariants, grounding, and coding workflows:
 * - CRK-P17-T01: Response validation contract (§2911-2923)
 * - CRK-P17-T02: Core validators (§2925-2940)
 * - CRK-P17-T03: Grounded response validation (§2941-2949)
 * - CRK-P17-T04: Coding response validation (§2950-2963)
 * - CRK-P17-T05: Bounded reason-specific retry policy (§2964-2974)
 *
 * Strictly adheres to the < 300 lines per file rule (§494).
 */

import {
  ResponseValidation,
  ResponseValidationContext,
  ValidationIssue,
  ValidationSeverity,
} from '../../types/response-quality';
import { CoreResponseValidators } from './CoreResponseValidators';
import { GroundedResponseValidator } from './GroundedResponseValidator';
import { CodingResponseValidator } from './CodingResponseValidator';
import { ResponseRetryPolicy, RetryPolicyOptions } from './ResponseRetryPolicy';

export class ResponseQualityGate {
  /**
   * Validates a response through all registered quality gates and evaluates remediation.
   */
  public static validate(
    context: ResponseValidationContext,
    options: RetryPolicyOptions = {}
  ): ResponseValidation {
    const issues: ValidationIssue[] = [
      ...CoreResponseValidators.runAll(context),
      ...GroundedResponseValidator.validate(context),
      ...CodingResponseValidator.validate(context),
    ];

    const hasErrors = issues.some((i) => i.severity === 'error');
    const hasWarnings = issues.some((i) => i.severity === 'warning');

    let severity: ValidationSeverity = 'info';
    if (hasErrors) {
      severity = 'error';
    } else if (hasWarnings) {
      severity = 'warning';
    }

    const codes = Array.from(new Set(issues.map((i) => i.code)));
    const remediation = ResponseRetryPolicy.determineRemediation(issues, options);
    const correctedResponse = ResponseRetryPolicy.generateCorrectedResponse(context, issues);

    return {
      valid: !hasErrors,
      severity,
      codes,
      retryRecommended: remediation.retryRecommended,
      remediationAction: remediation.remediationAction,
      correctedResponse,
      issues,
    };
  }
}
