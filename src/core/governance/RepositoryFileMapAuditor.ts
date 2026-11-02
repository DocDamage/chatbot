/**
 * Section 41: Proposed Repository File Map Auditor
 * Audits source file paths, line limits, and architectural boundary rules.
 */
import {
  CanonicalModuleCategory,
  CANONICAL_MODULE_RULES,
  FileViolation,
  FileMapAuditReport,
} from '../../types/file-map';

export interface FileToCheck {
  filePath: string;
  lineCount: number;
  importedModules?: string[];
}

export class RepositoryFileMapAuditor {
  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  detectCategory(filePath: string): CanonicalModuleCategory | null {
    const normalized = this.normalizePath(filePath);
    for (const [cat, rule] of Object.entries(CANONICAL_MODULE_RULES)) {
      if (normalized.startsWith(rule.baseDirectory)) {
        return cat as CanonicalModuleCategory;
      }
    }
    return null;
  }

  auditFile(file: FileToCheck): FileViolation[] {
    const violations: FileViolation[] = [];
    const normalized = this.normalizePath(file.filePath);
    const category = this.detectCategory(normalized);

    if (!category) {
      violations.push({
        filePath: file.filePath,
        ruleViolated: 'CANONICAL_MAP_UNMAPPED_PATH',
        severity: 'warning',
        details: `File '${file.filePath}' does not belong to any canonical module directory`,
      });
      return violations;
    }

    const rule = CANONICAL_MODULE_RULES[category];

    // Check line limits
    if (file.lineCount > rule.maxFileLines) {
      violations.push({
        filePath: file.filePath,
        ruleViolated: 'MAX_FILE_LINES_EXCEEDED',
        severity: 'error',
        details: `File has ${file.lineCount} lines, exceeding the ${rule.maxFileLines}-line limit for ${category}`,
      });
    }

    // Check forbidden imports
    if (file.importedModules && rule.forbiddenImports.length > 0) {
      for (const imp of file.importedModules) {
        for (const forbidden of rule.forbiddenImports) {
          if (imp.includes(forbidden)) {
            violations.push({
              filePath: file.filePath,
              ruleViolated: 'FORBIDDEN_IMPORT_BOUNDARY',
              severity: 'error',
              details: `File imports forbidden module '${imp}' matching prohibited pattern '${forbidden}'`,
            });
          }
        }
      }
    }

    return violations;
  }

  auditRepositoryFiles(files: FileToCheck[]): FileMapAuditReport {
    const violations: FileViolation[] = [];
    let validFilesCount = 0;

    for (const file of files) {
      const fileViolations = this.auditFile(file);
      if (fileViolations.length === 0) {
        validFilesCount++;
      } else {
        violations.push(...fileViolations);
      }
    }

    const hasErrors = violations.some((v) => v.severity === 'error');

    return {
      timestamp: new Date().toISOString(),
      totalFilesChecked: files.length,
      validFilesCount,
      violations,
      compliant: !hasErrors,
    };
  }
}
