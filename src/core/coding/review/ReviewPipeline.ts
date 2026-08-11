import { Diagnostic } from '../types';

export interface ReviewFinding { severity: 'low' | 'medium' | 'high' | 'critical'; category: string; file?: string; line?: number; issue: string; consequence: string; correction: string; }
export interface ReviewReport { findings: ReviewFinding[]; stages: string[]; summary: string; }

export class ReviewPipeline {
  review(input: { diff: string; task?: string; diagnostics?: Diagnostic[]; focus?: string[] }): ReviewReport {
    const findings: ReviewFinding[] = [];
    const diff = input.diff;
    const lower = diff.toLowerCase();
    if (/child_process\.(?:exec|execfile)|\beval\s*\(/i.test(diff)) findings.push({ severity: 'high', category: 'security', issue: 'The patch introduces shell-style or dynamic code execution.', consequence: 'Untrusted input may execute outside the intended repository command policy.', correction: 'Use an argv-based allowlisted command capability or remove dynamic execution.' });
    if (/innerhtml\s*=|dangerouslysetinnerhtml/i.test(diff)) findings.push({ severity: 'high', category: 'security', issue: 'The patch writes unsanitized HTML.', consequence: 'User-controlled content may become an XSS vector.', correction: 'Render escaped text or sanitize with the project-approved policy.' });
    if (/password\s*=|api[_-]?key\s*=|secret\s*=/i.test(diff) && !/process\.env/i.test(diff)) findings.push({ severity: 'critical', category: 'secrets', issue: 'The patch appears to introduce a hard-coded secret.', consequence: 'Credentials may be committed and exposed.', correction: 'Use the configured secret store or environment contract.' });
    if (input.diagnostics?.some(diagnostic => diagnostic.severity === 'error')) findings.push({ severity: 'high', category: 'verification', issue: 'Verification diagnostics contain errors.', consequence: 'The proposed change is not verified.', correction: 'Address the reported diagnostics and rerun the affected project checks.' });
    if (input.focus?.includes('tests') && !/test|spec|__tests__/i.test(diff)) findings.push({ severity: 'medium', category: 'tests', issue: 'The requested test-focused change has no visible test artifact.', consequence: 'Regression coverage may be missing.', correction: 'Add a behavior-focused regression test or explain existing coverage.' });
    if (/settimeout\([^,]+,\s*0\)|promise\.all\(/i.test(lower) && /shared|mutable|state/i.test(lower)) findings.push({ severity: 'medium', category: 'concurrency', issue: 'Concurrent work touches shared state without an evident ordering or isolation strategy.', consequence: 'Intermittent races or lost updates may occur.', correction: 'Define ownership, synchronization, or deterministic sequencing and test the failure boundary.' });
    return { findings, stages: ['requirements', 'correctness', 'regression', 'security', 'concurrency', 'resources', 'performance', 'compatibility', 'tests', 'language'], summary: findings.length ? `${findings.length} finding(s) require attention.` : 'Review completed with no detected findings; project verification is still required.' };
  }
}
