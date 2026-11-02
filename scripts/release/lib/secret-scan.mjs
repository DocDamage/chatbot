import { createHash } from 'node:crypto';

const SECRET_PATTERNS = [
  { id: 'private-key', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { id: 'aws-access-key', regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { id: 'github-token', regex: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/g },
  { id: 'openai-key', regex: /\bsk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { id: 'anthropic-key', regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { id: 'google-api-key', regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'slack-token', regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
];

const PLACEHOLDER_MARKERS = [
  'example',
  'placeholder',
  'replace-me',
  'replace_me',
  'your-key',
  'your_key',
  'test-token',
];

function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

export function scanText(text, source, allowlist = new Set()) {
  if (text.includes('\0')) return [];
  const findings = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    for (const pattern of SECRET_PATTERNS) {
      pattern.regex.lastIndex = 0;
      for (const match of line.matchAll(pattern.regex)) {
        const value = match[0];
        const digest = fingerprint(value);
        if (allowlist.has(digest)) continue;
        if (PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker))) continue;
        findings.push({
          rule: pattern.id,
          source,
          line: index + 1,
          fingerprint: digest,
        });
      }
    }
  });

  return findings;
}

export function formatFinding(finding) {
  return `${finding.rule}: ${finding.source}:${finding.line} (sha256:${finding.fingerprint})`;
}
