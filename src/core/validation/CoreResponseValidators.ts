/**
 * Core Response Validators (CRK-P17-T02)
 *
 * Validates fundamental assistant response invariants (§2925-2940):
 * - Non-empty response
 * - Format/schema compliance (markdown code fence closure, valid JSON when requested)
 * - Citation reference integrity (all cited sources resolve to retrieved chunks)
 * - Truthfulness of tool execution claims (cannot claim file modifications without tool execution)
 * - Truthfulness of test execution claims (cannot claim tests passed without test execution)
 * - Model & fallback metadata truthfulness
 *
 * Strictly adheres to the < 300 lines per file rule (§494).
 */

import { ResponseValidationContext, ValidationIssue } from '../../types/response-quality';

export class CoreResponseValidators {
  /**
   * Validates that the response content is non-empty and not just whitespace (§2929).
   */
  public static validateNonEmpty(context: ResponseValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const text = context.response?.trim() ?? '';
    if (text.length === 0) {
      issues.push({
        code: 'EMPTY_RESPONSE',
        message: 'Assistant response is empty or contains only whitespace.',
        severity: 'error',
        field: 'response',
        suggestedFix: 'Generate a non-empty response.',
      });
    }
    return issues;
  }

  /**
   * Validates markdown code fences and JSON schema if expectedFormat is specified (§2930, §2938).
   */
  public static validateFormatAndStructure(context: ResponseValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const text = context.response || '';

    // Check code fence balance
    const fenceMatches = text.match(/```/g) || [];
    if (fenceMatches.length % 2 !== 0) {
      issues.push({
        code: 'MALFORMED_CODE_BLOCK',
        message: 'Response contains an unclosed markdown code fence (```).',
        severity: 'error',
        field: 'response',
        suggestedFix: 'Close all open code fences with ```.',
      });
    }

    // If expectedFormat is json, verify valid JSON
    if (context.expectedFormat === 'json') {
      try {
        const jsonCandidate = text.includes('```json')
          ? text.split('```json')[1].split('```')[0].trim()
          : text.trim();
        JSON.parse(jsonCandidate);
      } catch {
        issues.push({
          code: 'INVALID_JSON_FORMAT',
          message: 'Expected valid JSON output but parsing failed.',
          severity: 'error',
          field: 'response',
          suggestedFix: 'Ensure valid JSON syntax.',
        });
      }
    }

    return issues;
  }

  /**
   * Validates that citation references resolve against retrieved context chunks (§2932).
   */
  public static validateCitationResolution(context: ResponseValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const availableChunkIds = new Set(context.retrievedChunks?.map((c) => c.chunkId) || []);

    if (context.citations && context.citations.length > 0) {
      for (const cit of context.citations) {
        if (!availableChunkIds.has(cit.chunkId)) {
          issues.push({
            code: 'UNRESOLVED_CITATION',
            message: `Citation references chunk "${cit.chunkId}" which was not in retrieved context.`,
            severity: 'warning',
            field: 'citations',
            suggestedFix: 'Only cite sources present in retrieved context.',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Validates that tool modification claims ("I updated the file", "I created", etc.)
   * are supported by actual successful tool execution results (§2933, §2935).
   */
  public static validateToolClaims(context: ResponseValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const text = context.response || '';

    // Patterns asserting actual file modifications or actions performed
    const fileChangeClaims = [
      /\b(i (have )?(edited|modified|updated|rewritten|deleted|created) the file)\b/i,
      /\b(the file has been (edited|modified|updated|created|saved))\b/i,
      /\b(i applied the (change|changes|patch|diff))\b/i,
      /\b(i made the (change|changes) to)\b/i,
    ];

    const hasFileChangeClaim = fileChangeClaims.some((re) => re.test(text));

    if (hasFileChangeClaim) {
      const toolResults = context.toolResults || [];
      const successfulMutations = toolResults.filter(
        (t) =>
          t.status === 'success' &&
          (t.toolName.includes('write') ||
            t.toolName.includes('edit') ||
            t.toolName.includes('replace') ||
            t.toolName.includes('patch') ||
            t.toolName.includes('file'))
      );

      if (successfulMutations.length === 0) {
        issues.push({
          code: 'UNSUPPORTED_TOOL_CLAIM',
          message:
            'Response claims file changes were performed, but no successful mutating tool execution exists.',
          severity: 'error',
          field: 'response',
          suggestedFix:
            'Do not claim files were modified unless a file mutation tool succeeded.',
        });
      }
    }

    return issues;
  }

  /**
   * Validates that claims of passing tests or verification are supported (§2936).
   */
  public static validateTestVerificationClaims(
    context: ResponseValidationContext
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const text = context.response || '';

    const testPassClaims = [
      /\b(all tests? (have )?passed)\b/i,
      /\b(the tests? passed successfully)\b/i,
      /\b(i ran the tests and they passed)\b/i,
      /\b(verified that the tests? pass)\b/i,
    ];

    const hasTestPassClaim = testPassClaims.some((re) => re.test(text));

    if (hasTestPassClaim) {
      const toolResults = context.toolResults || [];
      const successfulTestRuns = toolResults.filter(
        (t) =>
          t.status === 'success' &&
          (t.toolName.includes('test') ||
            t.toolName.includes('jest') ||
            t.toolName.includes('vitest') ||
            t.toolName.includes('check'))
      );

      if (successfulTestRuns.length === 0) {
        issues.push({
          code: 'UNSUPPORTED_TEST_CLAIM',
          message:
            'Response asserts tests passed, but no successful test execution tool was run.',
          severity: 'error',
          field: 'response',
          suggestedFix:
            'State that tests have not been executed or must be run manually.',
        });
      }
    }

    return issues;
  }

  /**
   * Validates that model metadata reported is truthful (§2934).
   */
  public static validateMetadataTruthfulness(
    context: ResponseValidationContext
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (context.model) {
      if (!context.model.provider || !context.model.model) {
        issues.push({
          code: 'INVALID_METADATA',
          message: 'Model execution metadata is missing provider or model name.',
          severity: 'warning',
          field: 'model',
        });
      }
    }
    return issues;
  }

  /**
   * Runs all core validators and aggregates issues (§2927).
   */
  public static runAll(context: ResponseValidationContext): ValidationIssue[] {
    return [
      ...this.validateNonEmpty(context),
      ...this.validateFormatAndStructure(context),
      ...this.validateCitationResolution(context),
      ...this.validateToolClaims(context),
      ...this.validateTestVerificationClaims(context),
      ...this.validateMetadataTruthfulness(context),
    ];
  }
}
