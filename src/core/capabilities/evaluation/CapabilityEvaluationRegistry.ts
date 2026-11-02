/**
 * Capability Evaluation Registry (PX21-T01)
 * Formal registry of all capability evaluation suites declaring:
 * - evaluation IDs
 * - fixture / test data ownership
 * - measurable metrics
 * - required score thresholds
 * - unsupported claims & constraints
 * - target runtime environment
 * - human review requirements
 * - regression tolerances
 * - structured evidence outputs
 */

export interface EvaluationSuiteDeclaration {
  id: string;
  capabilityId: string;
  name: string;
  domain: string;
  fixtureOwner: string;
  metricType: 'accuracy' | 'latency' | 'compression_ratio' | 'determinism' | 'isolation';
  requiredThreshold: number; // e.g. 0.98 (98%)
  unsupportedClaims: string[];
  runtimeEnvironment: 'local' | 'hosted' | 'both';
  requiresHumanReview: boolean;
  regressionTolerancePercent: number;
}

export class CapabilityEvaluationRegistry {
  private static instance: CapabilityEvaluationRegistry;
  private evaluations: Map<string, EvaluationSuiteDeclaration> = new Map();

  constructor() {
    this.registerDefaultEvaluations();
  }

  public static getInstance(): CapabilityEvaluationRegistry {
    if (!CapabilityEvaluationRegistry.instance) {
      CapabilityEvaluationRegistry.instance = new CapabilityEvaluationRegistry();
    }
    return CapabilityEvaluationRegistry.instance;
  }

  private registerDefaultEvaluations(): void {
    const defaults: EvaluationSuiteDeclaration[] = [
      {
        id: 'eval-context-reversible',
        capabilityId: 'context_economy',
        name: 'Reversible Compression Fidelity & Citation Retention',
        domain: 'context_repository',
        fixtureOwner: '@context-ops',
        metricType: 'accuracy',
        requiredThreshold: 0.98,
        unsupportedClaims: ['Lossless compression on unanchored open-domain prose'],
        runtimeEnvironment: 'both',
        requiresHumanReview: false,
        regressionTolerancePercent: 2.0
      },
      {
        id: 'eval-memory-branch-lineage',
        capabilityId: 'project_memory',
        name: 'Branch-Aware Memory Supersession & Freshness',
        domain: 'memory_agents',
        fixtureOwner: '@memory-ops',
        metricType: 'accuracy',
        requiredThreshold: 0.95,
        unsupportedClaims: ['Cross-repository automatic memory inheritance'],
        runtimeEnvironment: 'both',
        requiresHumanReview: false,
        regressionTolerancePercent: 5.0
      },
      {
        id: 'eval-local-model-ssrf',
        capabilityId: 'local_model_adapter',
        name: 'Local Endpoint SSRF Denial & Resource Routing',
        domain: 'local_models',
        fixtureOwner: '@sec-ops',
        metricType: 'isolation',
        requiredThreshold: 1.0,
        unsupportedClaims: ['Direct unproxied access from hosted cloud mode'],
        runtimeEnvironment: 'local',
        requiresHumanReview: false,
        regressionTolerancePercent: 0.0
      },
      {
        id: 'eval-godot-scene-rollback',
        capabilityId: 'godot_game_studio',
        name: 'Godot Scene Mutate-Preview-Rollback Roundtrip',
        domain: 'game_assets',
        fixtureOwner: '@game-ops',
        metricType: 'determinism',
        requiredThreshold: 1.0,
        unsupportedClaims: ['Binary scene parsing without Godot CLI bridge'],
        runtimeEnvironment: 'local',
        requiresHumanReview: true,
        regressionTolerancePercent: 0.0
      },
      {
        id: 'eval-media-consent-isolation',
        capabilityId: 'music_studio',
        name: 'Media Source Rights Consent & Worker Isolation',
        domain: 'media_voice',
        fixtureOwner: '@media-ops',
        metricType: 'isolation',
        requiredThreshold: 1.0,
        unsupportedClaims: ['Voice cloning without signed consent record'],
        runtimeEnvironment: 'local',
        requiresHumanReview: true,
        regressionTolerancePercent: 0.0
      },
      {
        id: 'eval-writing-byte-exact',
        capabilityId: 'writing_studio',
        name: 'Writing Studio Byte-Exact Document Round-Trip',
        domain: 'writing_study_web',
        fixtureOwner: '@doc-ops',
        metricType: 'accuracy',
        requiredThreshold: 1.0,
        unsupportedClaims: ['Semantic AI overwrites without tracked change envelope'],
        runtimeEnvironment: 'both',
        requiresHumanReview: false,
        regressionTolerancePercent: 0.0
      },
      {
        id: 'eval-web-studio-sandbox',
        capabilityId: 'web_studio',
        name: 'Web Studio Isolated Preview & AST Diff Undo',
        domain: 'writing_study_web',
        fixtureOwner: '@web-ops',
        metricType: 'isolation',
        requiredThreshold: 0.95,
        unsupportedClaims: ['Direct unsandboxed code execution in preview iframe'],
        runtimeEnvironment: 'both',
        requiresHumanReview: false,
        regressionTolerancePercent: 2.0
      }
    ];

    for (const d of defaults) {
      this.evaluations.set(d.id, d);
    }
  }

  public register(evalDecl: EvaluationSuiteDeclaration): void {
    this.evaluations.set(evalDecl.id, evalDecl);
  }

  public get(id: string): EvaluationSuiteDeclaration | undefined {
    return this.evaluations.get(id);
  }

  public list(): EvaluationSuiteDeclaration[] {
    return Array.from(this.evaluations.values());
  }

  public getByCapability(capabilityId: string): EvaluationSuiteDeclaration[] {
    return Array.from(this.evaluations.values()).filter(e => e.capabilityId === capabilityId);
  }
}
