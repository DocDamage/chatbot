import fs from 'fs';
import type { CapabilityItem } from './CapabilityRegistry';
import { reaConfig, REA_VERSION } from '../rea/ReaConfig';

export function buildReaCapability(isLocal: boolean): CapabilityItem {
  let installed = false, enabled = false;
  try { const config = reaConfig(); installed = fs.existsSync(config.entry); enabled = config.enabled; } catch { /* Diagnostics remain unavailable. */ }
  return {
    id: 'rea_reverse_engineering', name: 'REA Reverse Engineering',
    shortDescription: 'Static artifact analysis with retained evidence bundles.',
    detailedDescription: 'Inspects local JavaScript applications, archives, PE imports/resources, managed assemblies, model artifacts and native functions through an isolated REA MCP process per analysis.',
    category: 'coding', section: !isLocal ? 'disabled_by_policy' : installed && enabled ? 'local_only' : 'needs_setup',
    maturity: 'LOCAL_ONLY_EXPERIMENTAL', processingLocation: 'local', provider: 'REA via stdio MCP',
    requiredSoftware: ['REA 6.8.0 (npm run setup:rea)', 'Compatible Node runtime', 'Separate provider for native analysis'],
    authorityAndEgress: { filesystemAuthority: 'Reads approved targets into per-job snapshots; retains local analysis and evidence under data/rea.',
      networkEgress: 'No chatbot upload to a model provider. Native analysis providers may have their own configuration and network access.',
      processAuthority: 'Starts REA and selected static analysis providers. Does not run or attach to targets.', approvalGateRequired: false },
    healthState: !isLocal ? 'disabled' : installed && enabled ? 'degraded' : 'not_configured',
    healthReason: installed && enabled ? 'Package installed and enabled; individual providers are checked when analysis runs.' : 'Run npm run setup:rea and restart the server.',
    version: installed ? REA_VERSION : 'not-installed',
    estimatedCostAndResources: { computeImpact: 'Low (CPU only)', estimatedLatency: 'Seconds to minutes, bounded by the analysis timeout', costProfile: 'Free / Local Compute' },
    dataRetentionPolicy: 'Input snapshots, reports and evidence persist under data/rea until deleted by the local operator.',
    supportStatusAndLimitations: ['Static analysis does not establish runtime behavior or safety.', 'Native decompilation requires an installed compatible provider.', 'Enabled only in local deployments for developer/admin sessions.'],
    actions: [], requiredRole: 'developer', localOnly: true, apiBasePath: '/api/rea',
  };
}
