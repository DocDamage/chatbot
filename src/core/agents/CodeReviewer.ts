export interface CodeReviewFinding {
  severity: 'low' | 'medium' | 'high' | 'critical';
  file?: string;
  issue: string;
  suggestedFix: string;
}

export interface CodeReviewResult {
  findings: CodeReviewFinding[];
  summary: string;
}

export class CodeReviewer {
  review(diff: string, focus: string[] = []): CodeReviewResult {
    const findings: CodeReviewFinding[] = [];
    const lower = diff.toLowerCase();

    if (lower.includes('child_process.exec') || lower.includes('exec(')) {
      findings.push({
        severity: 'high',
        issue: 'Patch uses shell-style command execution, which is risky for a coding agent.',
        suggestedFix: 'Use spawn with shell disabled and an allowlist for repository commands.'
      });
    }

    if (lower.includes("'bash'") || lower.includes('"bash"')) {
      findings.push({
        severity: 'high',
        issue: 'Bash execution appears to be enabled.',
        suggestedFix: 'Disable Bash by default and gate it behind explicit admin/developer mode.'
      });
    }

    if (focus.includes('tests') && !lower.includes('.test.') && !lower.includes('__tests__')) {
      findings.push({
        severity: 'medium',
        issue: 'The diff does not appear to include tests for the changed behavior.',
        suggestedFix: 'Add focused tests or document why existing coverage is sufficient.'
      });
    }

    return {
      findings,
      summary: findings.length === 0 ? 'No blocking findings found.' : `${findings.length} finding(s) found.`
    };
  }
}
