import fs from 'fs';
import path from 'path';
import { CapabilityRegistry } from '../core/capabilities/CapabilityRegistry';
import { routeManifest } from './routeManifest';

const contracts: Record<string, { mount: string; clientSource: string }> = {
  context_economy: { mount: '/api/context-economy', clientSource: 'ExpansionStudiosPanel.tsx' },
  project_memory: { mount: '/api/project-memory', clientSource: 'ProjectIntelligencePanel.tsx' },
  agent_operations: { mount: '/api/agent-operations', clientSource: 'ExpansionStudiosPanel.tsx' },
  game_engine_bridge: { mount: '/api/game-studio', clientSource: 'ExpansionStudiosPanel.tsx' },
  sprite_studio: { mount: '/api/sprite-studio', clientSource: 'ExpansionStudiosPanel.tsx' },
  stem_mix_lab: { mount: '/api/music-studio', clientSource: 'ExpansionStudiosPanel.tsx' },
  desktop_voice_companion: { mount: '/api/desktop-companion', clientSource: 'DesktopCompanionPanel.tsx' },
  media_accessibility: { mount: '/api/media-accessibility', clientSource: 'ExpansionStudiosPanel.tsx' },
  writing_studio: { mount: '/api/writing-studio', clientSource: 'ExpansionStudiosPanel.tsx' },
  study_studio: { mount: '/api/study-studio', clientSource: 'ExpansionStudiosPanel.tsx' },
  web_studio: { mount: '/api/website-workspace', clientSource: 'WebsiteWorkspacePanel.tsx' },
  developer_utility_pack: { mount: '/api/mock-api', clientSource: 'MockApiWorkspacePanel.tsx' }
};

describe('profile expansion vertical-slice exposure contract', () => {
  it.each(Object.entries(contracts))('%s has registry, guarded route, and active client exposure', (capabilityId, contract) => {
    const capability = CapabilityRegistry.getInstance().getCapabilityById(capabilityId, 'local', 'developer');
    expect(capability).toBeDefined();
    expect(capability?.apiBasePath).toBe(contract.mount);
    expect(routeManifest).toEqual(expect.arrayContaining([
      expect.objectContaining({ mount: contract.mount, readiness: true })
    ]));

    const clientPath = path.join(process.cwd(), 'client', 'src', 'components', contract.clientSource);
    const clientSource = fs.readFileSync(clientPath, 'utf8');
    expect(clientSource).toContain(contract.mount);
  });
});
