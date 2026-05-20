export class HeadersAuditTool {
  run(input: Record<string, any> = {}) {
    const headers = input.headers || {};
    const lowerHeaders = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
    const required = [
      'content-security-policy',
      'x-content-type-options',
      'referrer-policy',
      'permissions-policy',
      'strict-transport-security'
    ];
    const missing = required.filter(header => !lowerHeaders[header]);

    return {
      domain: 'security',
      tool: 'HeadersAuditTool',
      missing,
      recommendations: [
        'Use a strict Content-Security-Policy tailored to actual script/style/image needs.',
        'Set X-Content-Type-Options: nosniff.',
        'Set Referrer-Policy: strict-origin-when-cross-origin or stricter.',
        'Limit browser capabilities with Permissions-Policy.',
        'Enable HSTS in production over HTTPS.'
      ],
      status: missing.length ? 'headers_need_review' : 'required baseline headers present'
    };
  }
}
