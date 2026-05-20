export class SecureCodeScanTool {
  run(input: Record<string, any> = {}) {
    const code = String(input.code || input.query || '');
    const findings = [];

    if (/\beval\s*\(|new Function\b/.test(code)) {
      findings.push({ severity: 'high', issue: 'Dynamic code execution detected.', fix: 'Remove eval/new Function or strictly sandbox trusted-only code.' });
    }
    if (/exec\s*\(|spawn\s*\([^,\)]*shell\s*:\s*true|child_process/.test(code)) {
      findings.push({ severity: 'high', issue: 'Command execution path needs allowlisting and shell avoidance.', fix: 'Use spawn without shell and a narrow command allowlist.' });
    }
    if (/jwt\.decode|verify\s*:\s*false|alg\s*:\s*['"]none/.test(code)) {
      findings.push({ severity: 'high', issue: 'JWT verification may be bypassed.', fix: 'Use verified signatures, issuer/audience checks, and expiry enforcement.' });
    }
    if (/SELECT .* \$\{|SELECT .* \+/.test(code)) {
      findings.push({ severity: 'high', issue: 'Possible SQL string interpolation.', fix: 'Use parameterized queries.' });
    }
    if (/console\.log\(.*(password|token|secret|api[_-]?key)/i.test(code)) {
      findings.push({ severity: 'medium', issue: 'Potential secret logging.', fix: 'Redact secrets before logging.' });
    }

    return {
      domain: 'security',
      tool: 'SecureCodeScanTool',
      findings,
      status: findings.length ? 'review_required' : 'no obvious deterministic issues found',
      checklist: [
        'Validate input at route boundaries.',
        'Authorize per resource, not just per route.',
        'Use parameterized database calls.',
        'Avoid raw shell execution.',
        'Redact secrets in logs and errors.'
      ]
    };
  }
}
