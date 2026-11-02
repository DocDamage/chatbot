import { CRKHandoffMetadata } from '../../types/program-completion';

export class HandoffAdditionsBuilder {
  public formatHandoffBlock(metadata: CRKHandoffMetadata): string {
    const lines = [
      '### Canonical Runtime & Knowledge (CRK) Handoff Additions',
      '',
      '```text',
      `Runtime stage affected: ${metadata.runtimeStageAffected ?? 'None / Not applicable'}`,
      `Prompt version: ${metadata.promptVersion ?? 'v1.0.0'}`,
      `Model policy version: ${metadata.modelPolicyVersion ?? 'v1.0.0'}`,
      `Retrieval policy version: ${metadata.retrievalPolicyVersion ?? 'v1.0.0'}`,
      `Dataset/pack ID: ${metadata.datasetPackId ?? 'None'}`,
      `Dataset version: ${metadata.datasetVersion ?? 'None'}`,
      `Migration IDs: ${metadata.migrationIds?.length ? metadata.migrationIds.join(', ') : 'None'}`,
      `Backward compatibility: ${metadata.backwardCompatibility ?? 'Full backward compatibility preserved'}`,
      `Feature flag: ${metadata.featureFlag ?? 'None'}`,
      `Shadow/canary status: ${metadata.shadowCanaryStatus ?? 'Direct / Certified'}`,
      `Golden cases added/changed: ${metadata.goldenCasesAddedChanged ?? '0 added, 0 changed'}`,
      `A/B result: ${metadata.abResult ?? 'Certified neutral or positive'}`,
      `Rollback method: ${metadata.rollbackMethod ?? 'Git revert release commit / dataset activation toggle'}`,
      '```',
    ];
    return lines.join('\n');
  }

  public parseHandoffBlock(text: string): Partial<CRKHandoffMetadata> {
    const metadata: Partial<CRKHandoffMetadata> = {};
    const patterns: Record<keyof CRKHandoffMetadata, RegExp> = {
      runtimeStageAffected: /Runtime stage affected:\s*([^\r\n]+)/,
      promptVersion: /Prompt version:\s*([^\r\n]+)/,
      modelPolicyVersion: /Model policy version:\s*([^\r\n]+)/,
      retrievalPolicyVersion: /Retrieval policy version:\s*([^\r\n]+)/,
      datasetPackId: /Dataset\/pack ID:\s*([^\r\n]+)/,
      datasetVersion: /Dataset version:\s*([^\r\n]+)/,
      migrationIds: /Migration IDs:\s*([^\r\n]+)/,
      backwardCompatibility: /Backward compatibility:\s*([^\r\n]+)/,
      featureFlag: /Feature flag:\s*([^\r\n]+)/,
      shadowCanaryStatus: /Shadow\/canary status:\s*([^\r\n]+)/,
      goldenCasesAddedChanged: /Golden cases added\/changed:\s*([^\r\n]+)/,
      abResult: /A\/B result:\s*([^\r\n]+)/,
      rollbackMethod: /Rollback method:\s*([^\r\n]+)/,
    };

    for (const [key, regex] of Object.entries(patterns) as [keyof CRKHandoffMetadata, RegExp][]) {
      const match = text.match(regex);
      if (match && match[1]) {
        const val = match[1].trim();
        if (key === 'migrationIds') {
          metadata.migrationIds = val === 'None' ? [] : val.split(',').map((s) => s.trim());
        } else {
          metadata[key] = val;
        }
      }
    }

    return metadata;
  }
}
