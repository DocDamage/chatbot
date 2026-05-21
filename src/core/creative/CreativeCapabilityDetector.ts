type ProviderCapabilityInput = {
  provider: string;
  model: string;
  maxTokens: number;
  qualityScore: number;
  instructionFollowing?: boolean;
  safetyClassification?: boolean;
};

export type CreativeCapabilityReport = {
  degraded: boolean;
  missingCapabilities: string[];
  selectedModel?: string;
  userMessage: string;
};

export class CreativeCapabilityDetector {
  evaluate(providers: ProviderCapabilityInput[]): CreativeCapabilityReport {
    const best = [...providers].sort((a, b) => b.qualityScore - a.qualityScore)[0];
    const missingCapabilities: string[] = [];

    if (!best || best.maxTokens < 8000) missingCapabilities.push('long_context');
    if (!best || best.qualityScore < 0.7 || best.provider === 'template') missingCapabilities.push('creative_quality');
    if (!best?.instructionFollowing && best?.provider === 'template') missingCapabilities.push('instruction_following');
    if (!best?.safetyClassification && best?.provider === 'template') missingCapabilities.push('safety_classification');

    const degraded = missingCapabilities.length > 0;
    return {
      degraded,
      missingCapabilities,
      selectedModel: best?.model,
      userMessage: degraded
        ? 'Creative writing is running in limited fallback mode. Long-form continuity, nuanced voice, and roleplay quality may be reduced until a capable provider is connected.'
        : `Creative writing is using ${best.model} with long-context creative capability.`,
    };
  }
}
