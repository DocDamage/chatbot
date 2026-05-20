export class SecretsScanTool {
  run(input: Record<string, any> = {}) {
    const text = String(input.text || input.query || '');
    const patterns = [
      { name: 'OpenAI-style key', regex: /sk-[A-Za-z0-9_-]{20,}/ },
      { name: 'Google API key', regex: /AIza[0-9A-Za-z_-]{20,}/ },
      { name: 'Generic secret assignment', regex: /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}/i },
      { name: 'Private key block', regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ }
    ];
    const matches = patterns.filter(pattern => pattern.regex.test(text)).map(pattern => pattern.name);

    return {
      domain: 'security',
      tool: 'SecretsScanTool',
      matches,
      status: matches.length ? 'potential_secret_detected' : 'no obvious secret patterns found',
      remediation: matches.length ? [
        'Remove the secret from code/history.',
        'Rotate the credential immediately.',
        'Move secrets into environment or secret manager storage.',
        'Add pre-commit and CI secret scanning.'
      ] : [
        'Keep scanning staged diffs and logs.',
        'Do not paste real secrets into prompts or tickets.'
      ]
    };
  }
}
