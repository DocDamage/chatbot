export type GamingPlaybookKind =
  | 'engine_selection'
  | 'asset_pipeline'
  | 'design_review'
  | 'modding_safety'
  | 'prompt_pack';

export interface GamingPlaybookInput {
  kind: GamingPlaybookKind;
  goal: string;
  engine?: string;
  genre?: string;
  targetPlatform?: string;
  constraints?: string[];
}

export interface GamingPlaybookResult {
  kind: GamingPlaybookKind;
  title: string;
  assumptions: string[];
  recommendations: string[];
  checklist: string[];
  risks: string[];
  followUpQuestions: string[];
}

export class GamingPlaybookService {
  create(input: GamingPlaybookInput): GamingPlaybookResult {
    const goal = String(input.goal || '').trim();
    if (!goal) throw new Error('goal is required');

    switch (input.kind) {
      case 'engine_selection':
        return this.engineSelection(input, goal);
      case 'asset_pipeline':
        return this.assetPipeline(input, goal);
      case 'design_review':
        return this.designReview(input, goal);
      case 'modding_safety':
        return this.moddingSafety(input, goal);
      case 'prompt_pack':
        return this.promptPack(input, goal);
      default:
        return this.designReview(input, goal);
    }
  }

  private engineSelection(input: GamingPlaybookInput, goal: string): GamingPlaybookResult {
    return {
      kind: 'engine_selection',
      title: 'Engine selection playbook',
      assumptions: [
        `Goal: ${goal}`,
        `Genre: ${input.genre || 'unspecified'}`,
        `Target platform: ${input.targetPlatform || 'PC-first unless specified'}`
      ],
      recommendations: [
        'Use MonoGame when you want custom engine control, deterministic 2D/retro rendering, and code-first pipelines.',
        'Use Godot when editor speed, scene tooling, and fast 2D iteration matter more than owning every engine layer.',
        'Use Unity when third-party assets, marketplace integrations, and broad platform support outweigh project weight.',
        'Use Unreal when high-end 3D rendering, cinematic tooling, or Blueprint-heavy prototyping is central.',
        'Use RPG Maker MZ/MV when the game is event-heavy, JRPG-focused, and plugin compatibility is a release constraint.'
      ],
      checklist: [
        'Define camera style, input complexity, save/load needs, target platforms, and asset source constraints.',
        'Prototype one movement loop, one combat loop, one UI screen, and one save/load cycle before committing.',
        'Verify export packaging early instead of waiting for content lock.',
        'Write an engine-decision record with tradeoffs and rejected alternatives.'
      ],
      risks: [
        'Choosing based on hype instead of the asset pipeline creates rework.',
        'Plugin-heavy stacks can become fragile if version updates are not pinned.',
        'Custom engines require stronger testing and tooling discipline.'
      ],
      followUpQuestions: [
        'Is this mostly 2D, 2.5D, or 3D?',
        'Do you need mod/plugin compatibility?',
        'Is the bottleneck code, assets, animation, or packaging?'
      ]
    };
  }

  private assetPipeline(input: GamingPlaybookInput, goal: string): GamingPlaybookResult {
    return {
      kind: 'asset_pipeline',
      title: 'Asset pipeline playbook',
      assumptions: [
        `Goal: ${goal}`,
        `Engine/tool context: ${input.engine || 'unspecified'}`
      ],
      recommendations: [
        'Create an asset manifest with source path, license, intended use, dimensions, animation tags, and import status.',
        'Normalize sprite sheets into consistent frame metadata before runtime use.',
        'Separate raw assets, processed assets, generated previews, and runtime-ready bundles.',
        'Keep destructive edits out of the source asset directory.',
        'Add automated validation for missing frames, duplicate names, oversized textures, and unsupported audio formats.'
      ],
      checklist: [
        'Scan source folders and emit an asset index.',
        'Generate previews/thumbnails for sprite and audio assets.',
        'Validate naming conventions and animation tags.',
        'Run import tests in a temporary scene before replacing production content.',
        'Track every conversion step in a manifest for rollback.'
      ],
      risks: [
        'Irregular atlases need metadata-assisted slicing; grid-only slicing will fail.',
        'Mixed licenses can block release if provenance is not tracked.',
        'Large uncompressed audio can break packaging size and startup time.'
      ],
      followUpQuestions: [
        'Are the assets grid sheets, packed atlases, or irregular sheets?',
        'Do you need 4-direction or 8-direction animation coverage?',
        'Should generated assets remain editable or become runtime-only outputs?'
      ]
    };
  }

  private designReview(input: GamingPlaybookInput, goal: string): GamingPlaybookResult {
    return {
      kind: 'design_review',
      title: 'Game design review playbook',
      assumptions: [
        `Goal: ${goal}`,
        `Genre: ${input.genre || 'unspecified'}`
      ],
      recommendations: [
        'Review the core loop first: player goal, action, feedback, reward, escalation, and failure recovery.',
        'Remove duplicate systems unless each one creates a distinct player decision.',
        'Define the minimum playable slice before expanding content volume.',
        'Tie progression rewards to verbs the player uses constantly.',
        'Separate fantasy, mechanics, economy, UI, and technical implementation notes.'
      ],
      checklist: [
        'Name the primary verb and secondary verbs.',
        'List one-minute, ten-minute, and one-hour player goals.',
        'Define fail states and recovery loops.',
        'Map every reward to a behavior it reinforces.',
        'Identify systems to merge, defer, or delete.'
      ],
      risks: [
        'Too many systems before a fun movement/combat loop creates dead weight.',
        'Progression can hide weak moment-to-moment play temporarily but will not fix it.',
        'Unclear UI language makes complex systems feel broken.'
      ],
      followUpQuestions: [
        'What is the player doing every 10 seconds?',
        'What changes after 10 minutes?',
        'Which system would you cut first if scope gets tight?'
      ]
    };
  }

  private moddingSafety(input: GamingPlaybookInput, goal: string): GamingPlaybookResult {
    return {
      kind: 'modding_safety',
      title: 'Safe modding guidance playbook',
      assumptions: [
        `Goal: ${goal}`,
        'Guidance is limited to lawful personal modding, plugin development, accessibility, configuration, and owned-project tooling.'
      ],
      recommendations: [
        'Prefer official modding APIs, config files, save exports, plugin hooks, and documented scripting layers.',
        'Keep backups of saves, project files, and original binaries before changing anything.',
        'Avoid bypassing payment, anti-cheat, licensing, account restrictions, or online competitive protections.',
        'Keep personal prototypes offline unless the game explicitly supports mods online.',
        'Document every file touched and make changes reversible.'
      ],
      checklist: [
        'Confirm you own or have permission to modify the target files.',
        'Identify the official extension mechanism first.',
        'Work on a copy, not the original install/project.',
        'Add version notes so updates do not silently break the mod.',
        'Package mods separately from original copyrighted assets where possible.'
      ],
      risks: [
        'Online games can ban accounts for client modification even when changes seem harmless.',
        'Binary patching is brittle and can cross legal or platform-policy lines.',
        'Redistributing modified proprietary assets can create rights issues.'
      ],
      followUpQuestions: [
        'Is this your own project, a single-player owned game, or an online game?',
        'Does the game have official mod/plugin support?',
        'Are you changing data, scripts, saves, or binaries?'
      ]
    };
  }

  private promptPack(input: GamingPlaybookInput, goal: string): GamingPlaybookResult {
    return {
      kind: 'prompt_pack',
      title: 'Gaming agent prompt pack',
      assumptions: [
        `Goal: ${goal}`,
        `Engine/tool context: ${input.engine || 'unspecified'}`
      ],
      recommendations: [
        'Use separate prompts for design, implementation, debugging, asset pipeline, and release audit.',
        'Force the coding agent to inspect the repo before proposing edits.',
        'Require exact file paths, verification commands, and rollback notes.',
        'Require scope control: prototype, milestone, production, or release-candidate.'
      ],
      checklist: [
        'Prompt 1: inspect the current architecture and identify existing systems.',
        'Prompt 2: write an implementation plan only; no code.',
        'Prompt 3: implement one vertical slice with tests.',
        'Prompt 4: run build/typecheck/lint/tests and patch failures.',
        'Prompt 5: update release tracker and handoff docs.'
      ],
      risks: [
        'Broad prompts cause agents to duplicate systems instead of extending existing code.',
        'Skipping verification turns generated code into untrusted scaffolding.',
        'Prompts that mix planning and coding create mode confusion.'
      ],
      followUpQuestions: [
        'Which agent will run the prompt?',
        'Should the output be code, markdown plan, tests, or audit findings?',
        'What files or folders are in scope?'
      ]
    };
  }
}
