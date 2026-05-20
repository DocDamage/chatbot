import { GenericSpecialistAgent } from '../specialists/GenericSpecialistAgent';
import { AuthFlowReviewTool } from '../../tools/security/AuthFlowReviewTool';
import { DependencyAuditTool } from '../../tools/security/DependencyAuditTool';
import { HeadersAuditTool } from '../../tools/security/HeadersAuditTool';
import { PrivacyChecklistTool } from '../../tools/security/PrivacyChecklistTool';
import { SecretsScanTool } from '../../tools/security/SecretsScanTool';
import { SecureCodeScanTool } from '../../tools/security/SecureCodeScanTool';
import { ThreatModelTool } from '../../tools/security/ThreatModelTool';

const profile = {
  id: "security",
  label: "Cybersecurity / Privacy Genius",
  guardrails: [
    "Defensive-only.",
    "No credential theft.",
    "No exploit chaining against real targets.",
    "No malware or evasion."
  ],
  workflows: [
    "Classify secure code, threat model, dependency, privacy, or auth review.",
    "Inspect evidence before findings.",
    "Return defensive risks, severity, and fixes."
  ],
  tools: [
    "ThreatModelTool",
    "SecureCodeScanTool",
    "DependencyAuditTool",
    "SecretsScanTool",
    "AuthFlowReviewTool",
    "PrivacyChecklistTool",
    "HeadersAuditTool"
  ],
  defaultSources: [
    "knowledge-base-public/security/overview.md"
  ]
};

export class SecurityGeniusAgent extends GenericSpecialistAgent {
  private threatModelTool = new ThreatModelTool();
  private secureCodeScanTool = new SecureCodeScanTool();
  private dependencyAuditTool = new DependencyAuditTool();
  private secretsScanTool = new SecretsScanTool();
  private authFlowReviewTool = new AuthFlowReviewTool();
  private privacyChecklistTool = new PrivacyChecklistTool();
  private headersAuditTool = new HeadersAuditTool();

  constructor(documentStore?: any) {
    super(profile, documentStore);
  }

  override async ask(query: string, mode = 'ask') {
    const toolResponse = this.toolFirstResponse(query, mode);
    if (toolResponse) {
      return toolResponse;
    }

    return super.ask(query, mode);
  }

  reviewCode(query: string) {
    return this.ask(query, 'review-code');
  }

  threatModel(query: string) {
    return this.ask(query, 'threat-model');
  }

  privacy(query: string) {
    return this.ask(query, 'privacy');
  }

  dependencies(query: string) {
    return this.ask(query, 'dependencies');
  }

  private toolFirstResponse(query: string, mode: string) {
    const text = query.toLowerCase();
    const results: Array<Record<string, any>> = [];

    if (mode === 'threat-model' || /\b(threat model|attack surface|trust boundary|stride)\b/.test(text)) {
      results.push(this.threatModelTool.run({ query, system: query }));
    }

    if (mode === 'review-code' || /\b(code|review|eval|child_process|sql|jwt|xss|injection)\b/.test(text)) {
      results.push(this.secureCodeScanTool.run({ query, code: query }));
    }

    if (mode === 'privacy' || /\b(privacy|personal data|pii|retention|consent|delete data)\b/.test(text)) {
      results.push(this.privacyChecklistTool.run({ query, feature: query }));
    }

    if (mode === 'dependencies' || /\b(dependency|dependencies|audit|package|npm|vulnerability|cve)\b/.test(text)) {
      results.push(this.dependencyAuditTool.run({ packageManager: text.includes('pnpm') ? 'pnpm' : text.includes('yarn') ? 'yarn' : 'npm' }));
    }

    if (/\b(secret|api key|token|password|credential)\b/.test(text)) {
      results.push(this.secretsScanTool.run({ query, text: query }));
    }

    if (/\b(auth|login|session|cookie|jwt|oauth|csrf|password reset)\b/.test(text)) {
      results.push(this.authFlowReviewTool.run({ query, flow: query }));
    }

    if (/\b(headers|csp|hsts|referrer-policy|permissions-policy)\b/.test(text)) {
      results.push(this.headersAuditTool.run({}));
    }

    if (results.length === 0) {
      return undefined;
    }

    return {
      domain: 'security',
      mode,
      response: [
        `Cybersecurity / Privacy Genius (${mode})`,
        '',
        `Request: ${query}`,
        '',
        'Defensive tool results:',
        ...results.map(result => `- ${result.tool}: ${JSON.stringify(result, null, 2)}`),
        '',
        'Guardrails:',
        ...profile.guardrails.map(rule => `- ${rule}`)
      ].join('\n'),
      sources: ['deterministic security tools'],
      guardrails: profile.guardrails,
      tools: results.map(result => String(result.tool || 'security-tool')),
      model: 'security-tools'
    };
  }
}
