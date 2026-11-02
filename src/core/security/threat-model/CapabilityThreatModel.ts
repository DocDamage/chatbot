export interface ThreatBoundaryEntry {
  boundaryId: string;
  boundaryName: string;
  threatDescription: string;
  potentialAttacker: 'remote_attacker' | 'malicious_document' | 'compromised_model' | 'untrusted_pack' | 'local_insider';
  targetedAsset: string;
  preconditions: string[];
  enforcedControls: string[];
  testReference: string;
  residualRisk: 'NONE' | 'LOW' | 'ACCEPTABLE_BOUNDED';
  owner: string;
}

export class CapabilityThreatModel {
  public static readonly THREAT_CATALOG: ThreatBoundaryEntry[] = [
    {
      boundaryId: 'TB-01',
      boundaryName: 'Pack Installation & Update',
      threatDescription: 'Untrusted pack requests excessive permissions or dynamic execution scripts.',
      potentialAttacker: 'untrusted_pack',
      targetedAsset: 'Server host runtime & configuration',
      preconditions: ['User attempts to install external third-party pack'],
      enforcedControls: [
        'Default-deny permissions',
        'Signed manifest and SHA-256 hash checks',
        'Quarantine state on initial installation',
        'Admin authorization required'
      ],
      testReference: 'PackSupplyChainGuard.test.ts',
      residualRisk: 'LOW',
      owner: 'Security Core Team'
    },
    {
      boundaryId: 'TB-02',
      boundaryName: 'External Adapters & Local Model Endpoints',
      threatDescription: 'Local model endpoint redirects requests to cloud metadata (169.254.169.254) or intranet.',
      potentialAttacker: 'remote_attacker',
      targetedAsset: 'Cloud credentials & private network infrastructure',
      preconditions: ['Model adapter configured with arbitrary URL'],
      enforcedControls: [
        'SSRF IP blocking on cloud metadata (169.254.169.254)',
        'Private loopback allowed only in LOCAL_TRUSTED profile',
        'DNS resolution pin & revalidation'
      ],
      testReference: 'WebSecurityBoundaryGuard.test.ts',
      residualRisk: 'LOW',
      owner: 'Network Security Team'
    },
    {
      boundaryId: 'TB-03',
      boundaryName: 'Project Memory & Context Store',
      threatDescription: 'Indirect prompt injection in retrieved document attempts policy change or secret exfiltration.',
      potentialAttacker: 'malicious_document',
      targetedAsset: 'LLM instruction context & user secrets',
      preconditions: ['Retrieval augmented generation over untrusted document'],
      enforcedControls: [
        'Context sanitization tags',
        'Instruction escape stripping',
        'Immutable security policies detached from prompt variables'
      ],
      testReference: 'MemoryInjectionDefense.test.ts',
      residualRisk: 'LOW',
      owner: 'AI Safety Team'
    },
    {
      boundaryId: 'TB-04',
      boundaryName: 'Worker Process & Engine Control',
      threatDescription: 'Media or game engine worker attempts arbitrary command execution or path escape.',
      potentialAttacker: 'compromised_model',
      targetedAsset: 'Host filesystem and shell execution runtime',
      preconditions: ['Capability triggers external binary execution'],
      enforcedControls: [
        'Allowlisted binary paths only',
        'Strict argument validation without shell interpolation',
        'Confinement to project working directory',
        'Child process tree termination on timeout'
      ],
      testReference: 'WorkerProcessIsolationGuard.test.ts',
      residualRisk: 'LOW',
      owner: 'Runtime Sandbox Team'
    },
    {
      boundaryId: 'TB-05',
      boundaryName: 'Desktop Permissions & Capture',
      threatDescription: 'Microphone, screen, or clipboard data captured without user awareness or consent.',
      potentialAttacker: 'local_insider',
      targetedAsset: 'User sensory inputs & clipboard credentials',
      preconditions: ['Desktop companion enabled'],
      enforcedControls: [
        'Independent micro-permissions for mic/screen/clipboard',
        'Visual active state indicator',
        'Clipboard secret pattern detection and warning',
        'Zero background persistence'
      ],
      testReference: 'DesktopPermissionGuard.test.ts',
      residualRisk: 'LOW',
      owner: 'Client Security Team'
    },
    {
      boundaryId: 'TB-06',
      boundaryName: 'Cross-Capability Artifact Handoff',
      threatDescription: 'Malicious artifact output from one capability attempts path traversal in another.',
      potentialAttacker: 'compromised_model',
      targetedAsset: 'Storage subsystem and adjacent capability workspaces',
      preconditions: ['Artifact produced by one tool is sent to another'],
      enforcedControls: [
        'Tenant/project ownership revalidation',
        'MIME type signature verification',
        'Path traversal blocking',
        'Fresh exact-scope approval required for destructive ingestion'
      ],
      testReference: 'ArtifactHandoffGuard.test.ts',
      residualRisk: 'NONE',
      owner: 'Platform Security Team'
    },
    {
      boundaryId: 'TB-07',
      boundaryName: 'Diagnostics & Support Bundles',
      threatDescription: 'Support bundle export includes private keys, credentials, or PII.',
      potentialAttacker: 'remote_attacker',
      targetedAsset: 'User credentials and private data',
      preconditions: ['User generates support diagnostic bundle'],
      enforcedControls: [
        'Automated regex token scrubber',
        'Path & email redaction',
        'Strict allowlist of diagnostic summary metrics'
      ],
      testReference: 'SupportBundleService.test.ts',
      residualRisk: 'NONE',
      owner: 'Compliance Team'
    }
  ];

  public static getThreat(boundaryId: string): ThreatBoundaryEntry | undefined {
    return this.THREAT_CATALOG.find(t => t.boundaryId === boundaryId);
  }

  public static getAllThreats(): ThreatBoundaryEntry[] {
    return [...this.THREAT_CATALOG];
  }
}
