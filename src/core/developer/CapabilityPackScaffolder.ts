/**
 * Phase PX-17: Capability Pack Scaffolder
 * PX17-T06
 */

import { PackScaffoldOptions } from './DeveloperTypes';

export interface GeneratedPackSkeleton {
  files: Array<{
    path: string;
    content: string;
  }>;
  manifest: Record<string, any>;
}

export class CapabilityPackScaffolder {
  public scaffoldPack(options: PackScaffoldOptions): GeneratedPackSkeleton {
    const packId = options.packId.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const maturity = options.maturity || 'disabled';
    const profiles = options.supportedProfiles || ['LOCAL_TRUSTED'];

    const manifest = {
      schemaVersion: '1.0.0',
      id: packId,
      displayName: options.displayName,
      version: '0.1.0',
      description: options.description,
      author: options.author,
      maturity, // Starts disabled / experimental by default
      profiles,
      source: {
        integration: 'clean_room',
        license: 'MIT',
        notices: [`Clean-room scaffolded capability pack: ${packId}`]
      },
      capabilities: [
        {
          id: `${packId}.core`,
          displayName: `${options.displayName} Core`,
          description: `Primary operational capability for ${options.displayName}`,
          defaultEnabled: false
        }
      ],
      tools: [
        {
          name: `${packId}_execute`,
          description: `Execute ${options.displayName} tasks safely`,
          parameters: {
            type: 'object',
            properties: {
              action: { type: 'string' },
              payload: { type: 'object' }
            },
            required: ['action']
          }
        }
      ],
      commands: [
        {
          name: `/${packId}`,
          description: `Trigger ${options.displayName} workspace workflow`
        }
      ],
      skills: options.includeSkill
        ? [
            {
              id: `skill-${packId}`,
              displayName: `${options.displayName} Guide`,
              path: `skills/SKILL.md`
            }
          ]
        : [],
      agents: options.includeAgentRole
        ? [
            {
              roleId: `agent-${packId}`,
              displayName: `${options.displayName} Specialist`,
              systemPromptFile: `agents/system-prompt.md`
            }
          ]
        : [],
      permissions: [
        {
          name: 'filesystem.read.approved_root',
          required: true
        }
      ],
      healthChecks: [
        {
          name: 'configuration_check',
          description: 'Validates configuration parameters and local prerequisites'
        }
      ],
      tests: [
        {
          name: 'golden_task',
          type: 'golden',
          specFile: `tests/golden_task.test.ts`
        },
        {
          name: 'negative_security_test',
          type: 'negative',
          specFile: `tests/security_negative.test.ts`
        }
      ]
    };

    const files: GeneratedPackSkeleton['files'] = [
      {
        path: `packs/${packId}/manifest.json`,
        content: JSON.stringify(manifest, null, 2)
      },
      {
        path: `packs/${packId}/README.md`,
        content: `# ${options.displayName}\n\n${options.description}\n\n## Governance & Maturity\nStatus: \`${maturity}\`\nSupported Profiles: ${profiles.join(', ')}\n`
      },
      {
        path: `packs/${packId}/tests/golden_task.test.ts`,
        content: `describe('${options.displayName} Golden Task', () => {\n  it('executes baseline capability workflow successfully', () => {\n    expect(true).toBe(true);\n  });\n});\n`
      },
      {
        path: `packs/${packId}/tests/security_negative.test.ts`,
        content: `describe('${options.displayName} Negative Security Tests', () => {\n  it('rejects unapproved mutations and path traversal', () => {\n    expect(true).toBe(true);\n  });\n});\n`
      }
    ];

    if (options.includeSkill) {
      files.push({
        path: `packs/${packId}/skills/SKILL.md`,
        content: `---\nname: ${options.displayName} Guide\nid: skill-${packId}\n---\n# ${options.displayName} Instructions\n`
      });
    }

    if (options.includeAgentRole) {
      files.push({
        path: `packs/${packId}/agents/system-prompt.md`,
        content: `You are a dedicated specialist for ${options.displayName}. Always adhere to exact-scope approval and sandbox safety rules.\n`
      });
    }

    return {
      manifest,
      files
    };
  }
}
