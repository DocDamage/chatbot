import { SecurityGeniusAgent } from './SecurityGeniusAgent';

describe('SecurityGeniusAgent', () => {
  it('runs threat modeling for login flows', async () => {
    const agent = new SecurityGeniusAgent();

    const result = await agent.threatModel('Threat model my login flow.');

    expect(result.model).toBe('security-tools');
    expect(result.response).toContain('ThreatModelTool');
    expect(result.response).toContain('Spoofing');
    expect(result.response).toContain('Defensive-only');
  });

  it('reviews auth flows with session and CSRF checks', async () => {
    const agent = new SecurityGeniusAgent();

    const result = await agent.ask('Review my JWT cookie login and password reset flow.');

    expect(result.response).toContain('AuthFlowReviewTool');
    expect(result.response).toContain('HttpOnly');
    expect(result.response).toContain('CSRF');
  });

  it('detects obvious pasted secret patterns', async () => {
    const agent = new SecurityGeniusAgent();

    const result = await agent.ask('Did I leak a secret? api_key=\"abcdef1234567890\"');

    expect(result.response).toContain('SecretsScanTool');
    expect(result.response).toContain('potential_secret_detected');
    expect(result.response).toContain('Rotate the credential');
  });

  it('flags risky code patterns', async () => {
    const agent = new SecurityGeniusAgent();

    const result = await agent.reviewCode('Review code: eval(userInput); child_process.exec(cmd)');

    expect(result.response).toContain('SecureCodeScanTool');
    expect(result.response).toContain('Dynamic code execution');
    expect(result.response).toContain('Command execution');
  });

  it('returns dependency audit workflow', async () => {
    const agent = new SecurityGeniusAgent();

    const result = await agent.dependencies('audit npm dependencies for vulnerabilities');

    expect(result.response).toContain('DependencyAuditTool');
    expect(result.response).toContain('npm audit --omit=dev');
  });
});
