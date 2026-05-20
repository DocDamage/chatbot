export class AuthFlowReviewTool {
  run(input: Record<string, any> = {}) {
    const flow = String(input.flow || input.query || 'login flow');
    return {
      domain: 'security',
      tool: 'AuthFlowReviewTool',
      flow,
      checks: [
        'Password or OAuth callbacks are rate-limited and monitored.',
        'Session cookies use HttpOnly, Secure, SameSite, and short-enough expiry.',
        'JWTs are verified with issuer, audience, expiry, and algorithm restrictions.',
        'Password reset tokens are single-use, short-lived, and do not reveal account existence.',
        'Admin routes re-check roles server-side on every request.',
        'Logout invalidates refresh/session state where applicable.',
        'CSRF protection exists for cookie-authenticated state changes.'
      ],
      likelyFailureModes: [
        'Trusting client-side role flags.',
        'Using one global JWT secret across environments without rotation.',
        'Returning different errors for valid vs invalid accounts.',
        'Letting normal users trigger admin tool actions.'
      ]
    };
  }
}
