/**
 * Validation Pass - Quality gates before responses are shown
 */

import { logger } from '../observability/logger';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class SafetyValidator {
  validate(content: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic safety checks
    const blockedPatterns = [
      /violence/i,
      /harmful/i,
      /illegal instructions/i
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(content)) {
        warnings.push(`Content matched safety pattern: ${pattern}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export class ToneValidator {
  validate(content: string, expectedTone?: 'professional' | 'casual' | 'friendly'): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic tone validation
    if (expectedTone === 'professional') {
      const casualWords = ['lol', 'omg', 'wtf'];
      if (casualWords.some(word => content.toLowerCase().includes(word))) {
        warnings.push('Content may be too casual for professional tone');
      }
    }

    return {
      valid: true,
      errors,
      warnings
    };
  }
}

export class SchemaValidator {
  validate(content: string, expectedSchema?: 'json' | 'markdown' | 'plain'): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (expectedSchema === 'json') {
      try {
        JSON.parse(content);
      } catch (e) {
        errors.push('Invalid JSON format');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export class ValidationPipeline {
  private safetyValidator = new SafetyValidator();
  private toneValidator = new ToneValidator();
  private schemaValidator = new SchemaValidator();

  validate(content: string, tone?: 'professional' | 'casual' | 'friendly'): ValidationResult {
    const results = [
      this.safetyValidator.validate(content),
      this.toneValidator.validate(content, tone),
      this.schemaValidator.validate(content)
    ];

    const allErrors = results.flatMap(r => r.errors);
    const allWarnings = results.flatMap(r => r.warnings);

    const result: ValidationResult = {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings
    };

    if (!result.valid) {
      logger.warn('Validation failed', { errors: result.errors });
    }

    return result;
  }
}

