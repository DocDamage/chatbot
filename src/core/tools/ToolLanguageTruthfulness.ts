/**
 * Tool Language Truthfulness Service (CRK-P18-T03)
 *
 * Enforces the strict status-to-allowed-language matrix (§3026-3039):
 * - success + verified   -> "completed and verified"
 * - success + unverified -> "completed; verification not performed"
 * - partial              -> "partially completed"
 * - failed               -> "failed"
 * - blocked              -> "could not run due to policy/permission"
 * - cancelled            -> "cancelled"
 * - not_run              -> "proposed/planned only"
 *
 * Strictly adheres to the < 300 lines per file rule (§494).
 */

import {
  CanonicalToolResult,
  ToolExecutionStatus,
  ToolVerificationStatus,
} from '../../types/tool-truth';

export interface PhrasingPolicy {
  allowed: string;
  prohibitedRegexes: RegExp[];
}

export class ToolLanguageTruthfulness {
  /**
   * Returns canonical allowed wording for a given tool execution and verification state (§3030-3039).
   */
  public static getAllowedWording(
    status: ToolExecutionStatus,
    verificationStatus?: ToolVerificationStatus
  ): string {
    if (status === 'success') {
      return verificationStatus === 'verified'
        ? 'completed and verified'
        : 'completed; verification not performed';
    }
    if (status === 'partial') return 'partially completed';
    if (status === 'failed') return 'failed';
    if (status === 'blocked') return 'could not run due to policy/permission';
    if (status === 'cancelled') return 'cancelled';
    return 'proposed/planned only';
  }

  /**
   * Validates response text against actual tool execution states.
   */
  public static validateResponse(
    response: string,
    toolResults: CanonicalToolResult[]
  ): {
    valid: boolean;
    violations: string[];
    correctedResponse?: string;
  } {
    const violations: string[] = [];
    let corrected = response;

    for (const tool of toolResults) {
      const vStatus = tool.verification?.status;
      const status = tool.status;

      // 1. If tool failed, response cannot claim completion or success
      if (status === 'failed') {
        const successRegex = /\b(successfully (executed|completed|ran|updated)|completed the (task|operation))\b/i;
        if (successRegex.test(corrected)) {
          violations.push(
            `Tool "${tool.toolId}" failed, but response claims successful completion.`
          );
          corrected = corrected.replace(
            successRegex,
            `failed to complete the operation (Tool error: ${tool.error?.safeMessage || 'Execution failed'})`
          );
        }
      }

      // 2. If tool was blocked, response cannot claim it ran
      if (status === 'blocked') {
        const ranRegex = /\b(i (ran|executed|performed) the (action|tool|operation))\b/i;
        if (ranRegex.test(corrected)) {
          violations.push(
            `Tool "${tool.toolId}" was blocked, but response claims it executed.`
          );
          corrected = corrected.replace(
            ranRegex,
            'the action could not run due to policy/permission'
          );
        }
      }

      // 3. If tool was cancelled, response cannot claim completion
      if (status === 'cancelled') {
        const completedRegex = /\b(completed|finished successfully)\b/i;
        if (completedRegex.test(corrected)) {
          violations.push(
            `Tool "${tool.toolId}" was cancelled, but response claims completion.`
          );
          corrected = corrected.replace(completedRegex, 'was cancelled before completion');
        }
      }

      // 4. If tool is partial, response cannot claim full completion
      if (status === 'partial') {
        const fullyRegex = /\b(fully (completed|finished|applied))\b/i;
        if (fullyRegex.test(corrected)) {
          violations.push(
            `Tool "${tool.toolId}" is only partial, but response claims full completion.`
          );
          corrected = corrected.replace(fullyRegex, 'partially completed');
        }
      }

      // 5. If tool succeeded but unverified, response cannot claim "verified" or "tests passed"
      if (status === 'success' && vStatus !== 'verified') {
        const verifiedRegex = /\b(verified that|changes? (have been|are) verified|tests? passed)\b/i;
        if (verifiedRegex.test(corrected)) {
          violations.push(
            `Tool "${tool.toolId}" completed but was not verified, yet response claims verification.`
          );
          corrected = corrected.replace(
            verifiedRegex,
            'completed; verification not performed'
          );
        }
      }

      // 6. If tool was not_run, response cannot claim action was taken
      if (status === 'not_run') {
        const takenRegex = /\b(i (have )?(created|updated|applied|modified|run))\b/i;
        if (takenRegex.test(corrected)) {
          violations.push(
            `Tool "${tool.toolId}" was not run, but response claims action was taken.`
          );
          corrected = corrected.replace(takenRegex, 'proposed/planned only');
        }
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      correctedResponse: corrected !== response ? corrected : undefined,
    };
  }
}
