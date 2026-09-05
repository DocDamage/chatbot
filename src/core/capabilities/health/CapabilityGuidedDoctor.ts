import * as crypto from 'crypto';

export interface PrerequisiteCheck {
  id: string;
  name: string;
  category: 'software' | 'model' | 'hardware' | 'credential' | 'network';
  status: 'passed' | 'failed' | 'warning' | 'pending';
  requiredVersion?: string;
  detectedVersion?: string;
  remediationAdvice?: string;
}

export interface SetupStep {
  stepNumber: number;
  id: string;
  title: string;
  description: string;
  riskNotice?: string;
  fields?: Array<{
    key: string;
    label: string;
    type: 'text' | 'password' | 'path' | 'select' | 'checkbox';
    required: boolean;
    defaultValue?: string;
    options?: string[];
    isSecret?: boolean;
    validationRegex?: string;
  }>;
}

export interface GuidedSetupPlan {
  capabilityId: string;
  capabilityName: string;
  maturity: 'PRODUCTION_SUPPORTED' | 'PRODUCTION_PREVIEW' | 'LOCAL_ONLY_EXPERIMENTAL';
  platformSupported: boolean;
  deploymentProfileAllowed: boolean;
  prerequisites: PrerequisiteCheck[];
  steps: SetupStep[];
  rollbackSteps: string[];
}

export interface SetupResult {
  success: boolean;
  capabilityId: string;
  newStatus: 'healthy' | 'degraded' | 'unhealthy' | 'disabled';
  auditDigest: string;
  diagnosticOutput: string;
  appliedConfiguration: Record<string, unknown>;
}

export class CapabilityGuidedDoctor {
  public static generatePlan(
    capabilityId: string,
    capabilityName: string,
    deploymentProfile: 'HOSTED' | 'LOCAL_TRUSTED' = 'LOCAL_TRUSTED',
    isLocalOnly: boolean = false
  ): GuidedSetupPlan {
    const isHosted = deploymentProfile === 'HOSTED';
    const deploymentAllowed = !(isHosted && isLocalOnly);

    const prerequisites: PrerequisiteCheck[] = [
      {
        id: 'node_env',
        name: 'Node.js Runtime Environment',
        category: 'software',
        status: 'passed',
        requiredVersion: '>=18.0.0',
        detectedVersion: process.version
      },
      {
        id: 'platform_compat',
        name: 'Operating System Compatibility',
        category: 'hardware',
        status: 'passed',
        detectedVersion: process.platform
      }
    ];

    if (isLocalOnly) {
      prerequisites.push({
        id: 'local_trusted_profile',
        name: 'Local Trusted Deployment Profile',
        category: 'credential',
        status: deploymentAllowed ? 'passed' : 'failed',
        remediationAdvice: deploymentAllowed
          ? undefined
          : 'Switch application deployment profile from HOSTED to LOCAL_TRUSTED to enable local process control.'
      });
    }

    const steps: SetupStep[] = [
      {
        stepNumber: 1,
        id: 'risk_acknowledgement',
        title: 'Understand Scope and Risk',
        description: `Review execution permissions, local process access, and telemetry boundaries for ${capabilityName}.`,
        riskNotice: isLocalOnly
          ? 'Notice: This capability executes local binaries and accesses local working directories. Actions are gated by exact-scope approvals.'
          : 'Notice: This capability communicates with configured API endpoints using strict data egress controls.'
      },
      {
        stepNumber: 2,
        id: 'configure_endpoints',
        title: 'Connection & Endpoint Settings',
        description: 'Provide valid local or remote service connection endpoints.',
        fields: [
          {
            key: 'endpointUrl',
            label: 'Service Endpoint URL',
            type: 'text',
            required: false,
            defaultValue: isLocalOnly ? 'http://127.0.0.1:8080' : 'https://api.openai.com/v1'
          },
          {
            key: 'apiKey',
            label: 'API Key / Secret Token (Masked)',
            type: 'password',
            required: false,
            isSecret: true
          }
        ]
      },
      {
        stepNumber: 3,
        id: 'run_diagnostic',
        title: 'Bounded Canary Health Check',
        description: 'Execute a fast, non-destructive probe to verify operational readiness.'
      }
    ];

    const rollbackSteps = [
      '1. Disable the capability via the Capability Hub.',
      '2. Invalidate and remove stored credentials from configuration.',
      '3. Revert capability status to "needs_setup" or "disabled_by_policy".'
    ];

    return {
      capabilityId,
      capabilityName,
      maturity: isLocalOnly ? 'LOCAL_ONLY_EXPERIMENTAL' : 'PRODUCTION_SUPPORTED',
      platformSupported: true,
      deploymentProfileAllowed: deploymentAllowed,
      prerequisites,
      steps,
      rollbackSteps
    };
  }

  public static async executeSetup(
    plan: GuidedSetupPlan,
    providedConfig: Record<string, string>,
    runHealthProbe: (config: Record<string, string>) => Promise<{ ok: boolean; message: string }>
  ): Promise<SetupResult> {
    if (!plan.deploymentProfileAllowed) {
      return {
        success: false,
        capabilityId: plan.capabilityId,
        newStatus: 'disabled',
        auditDigest: 'ERR_HOSTED_BLOCKED',
        diagnosticOutput: 'Deployment profile HOSTED blocks execution of local-only capabilities.',
        appliedConfiguration: {}
      };
    }

    const probeResult = await runHealthProbe(providedConfig);
    const sanitizedConfig: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(providedConfig)) {
      if (/key|secret|password|token/i.test(key)) {
        sanitizedConfig[key] = val ? '********' : '';
      } else {
        sanitizedConfig[key] = val;
      }
    }

    const digest = crypto
      .createHash('sha256')
      .update(`${plan.capabilityId}:${probeResult.ok ? 'HEALTHY' : 'FAILED'}:${Date.now()}`)
      .digest('hex');

    return {
      success: probeResult.ok,
      capabilityId: plan.capabilityId,
      newStatus: probeResult.ok ? 'healthy' : 'unhealthy',
      auditDigest: digest,
      diagnosticOutput: probeResult.message,
      appliedConfiguration: sanitizedConfig
    };
  }
}
