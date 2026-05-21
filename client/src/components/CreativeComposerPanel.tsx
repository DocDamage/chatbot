export type CreativeComposerState = {
  genre: string;
  format: string;
  presetId?: string;
  presetInstructions?: string[];
  rating: 'General' | 'Teen' | 'Mature' | 'Adult Fiction';
  matureMode: boolean;
  pov: 'first' | 'second' | 'third_limited' | 'third_omniscient';
  tense: 'past' | 'present';
  tone: string;
  length: 'flash' | 'short' | 'medium' | 'long';
  proseDensity: number;
  dialogueDensity: number;
  fadeToBlack: boolean;
  qualityPass: boolean;
  hardLimits: string;
  allowedMatureThemes: string;
  storyBibleNotes: string;
  projectTitle: string;
  workflowStage:
    | 'premise'
    | 'logline'
    | 'outline'
    | 'beat_sheet'
    | 'chapter_outline'
    | 'scene_list'
    | 'draft_chapter'
    | 'continuity_review'
    | 'revision_pass'
    | 'final_export';
  branchId: string;
  privacyLocalOnly: boolean;
  analyticsEnabled: boolean;
  retentionDays: number;
  promptPackId: string;
  promptPackInstructions: string;
};

export type CreativeChatMode = 'creative_writing' | 'roleplay';

export const defaultCreativeComposerState: CreativeComposerState = {
  genre: 'custom',
  format: 'scene',
  rating: 'Teen',
  matureMode: false,
  pov: 'third_limited',
  tense: 'past',
  tone: 'balanced',
  length: 'medium',
  proseDensity: 5,
  dialogueDensity: 5,
  fadeToBlack: true,
  qualityPass: false,
  hardLimits: '',
  allowedMatureThemes: '',
  storyBibleNotes: '',
  projectTitle: '',
  workflowStage: 'draft_chapter',
  branchId: '',
  privacyLocalOnly: false,
  analyticsEnabled: true,
  retentionDays: 30,
  promptPackId: '',
  promptPackInstructions: '',
};

interface CreativeComposerPanelProps {
  mode: CreativeChatMode;
  value: CreativeComposerState;
  onChange: (next: CreativeComposerState) => void;
  onActionCommand?: (command: string) => void;
}

const genres = [
  ['custom', 'Custom'],
  ['epic_fantasy', 'Epic Fantasy'],
  ['dark_horror', 'Dark Horror'],
  ['space_opera', 'Space Opera'],
  ['western', 'Western'],
  ['romance', 'Romance'],
  ['mystery', 'Mystery'],
  ['cyberpunk', 'Cyberpunk'],
  ['historical_fiction', 'Historical Fiction'],
];

const formats = [
  ['scene', 'Scene'],
  ['chapter_draft', 'Chapter Draft'],
  ['short_story', 'Short Story'],
  ['screenplay', 'Screenplay'],
  ['lore_entry', 'Lore Entry'],
  ['dialogue_only_scene', 'Dialogue Only'],
  ['roleplay', 'Roleplay'],
];

const genrePresets: Record<string, Partial<CreativeComposerState> & { instructions: string[] }> = {
  epic_fantasy: {
    tone: 'mythic, textured, character-driven',
    proseDensity: 7,
    dialogueDensity: 4,
    instructions: ['Use secondary-world stakes, invented cultures, and concrete lore constraints.'],
  },
  dark_horror: {
    rating: 'Mature',
    tone: 'eerie, restrained, dread-forward',
    proseDensity: 8,
    dialogueDensity: 3,
    instructions: ['Build dread through sensory detail, implication, and escalating uncertainty.'],
  },
  space_opera: {
    rating: 'Teen',
    tone: 'cinematic, adventurous, emotionally direct',
    proseDensity: 6,
    dialogueDensity: 6,
    instructions: ['Use large-scale speculative stakes, vivid technology, and faction pressure.'],
  },
  western: {
    tone: 'spare, dusty, morally tense',
    proseDensity: 5,
    dialogueDensity: 6,
    instructions: ['Center frontier pressure, reputation, land, debt, and hard choices.'],
  },
  romance: {
    tone: 'intimate, emotionally specific, consent-forward',
    proseDensity: 6,
    dialogueDensity: 7,
    instructions: ['Track attraction, boundaries, miscommunication, and emotional escalation.'],
  },
  mystery: {
    tone: 'curious, tense, clue-forward',
    proseDensity: 5,
    dialogueDensity: 6,
    instructions: ['Plant clues, red herrings, suspects, and a fair-play question.'],
  },
  cyberpunk: {
    tone: 'neon, cynical, kinetic',
    proseDensity: 6,
    dialogueDensity: 6,
    instructions: ['Tie body, city, surveillance, labor, and technology into the conflict.'],
  },
  historical_fiction: {
    tone: 'grounded, period-aware, humane',
    proseDensity: 6,
    dialogueDensity: 5,
    instructions: ['Keep period detail concrete without turning the scene into exposition.'],
  },
};

const formatPresets: Record<string, Partial<CreativeComposerState> & { instructions: string[] }> = {
  scene: {
    length: 'medium',
    instructions: ['Open with a scene goal, introduce friction, and end on a changed state.'],
  },
  chapter_draft: {
    length: 'long',
    instructions: ['Structure a chapter arc with a clean opening beat, escalation, reversal, and chapter hook.'],
  },
  short_story: {
    length: 'long',
    instructions: ['Use a compressed complete arc with one dominant turn and resonant final image.'],
  },
  screenplay: {
    dialogueDensity: 8,
    instructions: ['Prioritize visual action, scene headings, lean description, and speakable dialogue.'],
  },
  lore_entry: {
    proseDensity: 7,
    dialogueDensity: 1,
    instructions: ['Return canon-ready lore with origins, rules, contradictions, and story hooks.'],
  },
  dialogue_only_scene: {
    dialogueDensity: 10,
    proseDensity: 1,
    instructions: ['Use dialogue only while preserving subtext, voice contrast, and turn-taking.'],
  },
  roleplay: {
    instructions: ['Keep turn state explicit and preserve player agency.'],
  },
};

function CreativeComposerPanel({ mode, value, onChange, onActionCommand }: CreativeComposerPanelProps) {
  const update = <K extends keyof CreativeComposerState>(key: K, nextValue: CreativeComposerState[K]) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <section className="creative-composer-panel" aria-label="Creative composer">
      <div className="creative-composer-row">
        <label>
          Genre
          <select value={value.genre} onChange={event => onChange(applyCreativePreset({ ...value, genre: event.target.value }))}>
            {genres.map(([genreValue, label]) => <option key={genreValue} value={genreValue}>{label}</option>)}
          </select>
        </label>
        <label>
          Format
          <select value={mode === 'roleplay' ? 'roleplay' : value.format} onChange={event => onChange(applyCreativePreset({ ...value, format: event.target.value }))} disabled={mode === 'roleplay'}>
            {formats.map(([formatValue, label]) => <option key={formatValue} value={formatValue}>{label}</option>)}
          </select>
        </label>
        <label>
          Rating
          <select value={value.rating} onChange={event => update('rating', event.target.value as CreativeComposerState['rating'])}>
            <option value="General">General</option>
            <option value="Teen">Teen</option>
            <option value="Mature">Mature</option>
            <option value="Adult Fiction">Adult Fiction</option>
          </select>
        </label>
        <label className="creative-toggle">
          <input
            type="checkbox"
            checked={value.matureMode}
            onChange={event => update('matureMode', event.target.checked)}
          />
          Mature mode
        </label>
      </div>
      <div className="creative-composer-row">
        <label>
          Point of view
          <select value={value.pov} onChange={event => update('pov', event.target.value as CreativeComposerState['pov'])}>
            <option value="first">First</option>
            <option value="second">Second</option>
            <option value="third_limited">Third Limited</option>
            <option value="third_omniscient">Third Omniscient</option>
          </select>
        </label>
        <label>
          Tense
          <select value={value.tense} onChange={event => update('tense', event.target.value as CreativeComposerState['tense'])}>
            <option value="past">Past</option>
            <option value="present">Present</option>
          </select>
        </label>
        <label>
          Tone
          <input value={value.tone} onChange={event => update('tone', event.target.value)} />
        </label>
        <label>
          Length
          <select value={value.length} onChange={event => update('length', event.target.value as CreativeComposerState['length'])}>
            <option value="flash">Flash</option>
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>
        </label>
      </div>
      <div className="creative-composer-row">
        <label>
          Prose
          <input type="range" min="1" max="10" value={value.proseDensity} onChange={event => update('proseDensity', Number(event.target.value))} />
        </label>
        <label>
          Dialogue
          <input type="range" min="1" max="10" value={value.dialogueDensity} onChange={event => update('dialogueDensity', Number(event.target.value))} />
        </label>
        <label className="creative-toggle">
          <input
            type="checkbox"
            checked={value.fadeToBlack}
            onChange={event => update('fadeToBlack', event.target.checked)}
          />
          Fade to black
        </label>
        <label className="creative-toggle">
          <input
            type="checkbox"
            checked={value.qualityPass}
            onChange={event => update('qualityPass', event.target.checked)}
          />
          Quality pass
        </label>
      </div>
      <div className="creative-composer-row creative-composer-boundaries">
        <label>
          Hard limits
          <input value={value.hardLimits} onChange={event => update('hardLimits', event.target.value)} />
        </label>
        <label>
          Allowed mature themes
          <input value={value.allowedMatureThemes} onChange={event => update('allowedMatureThemes', event.target.value)} />
        </label>
      </div>
      <div className="creative-composer-row creative-composer-boundaries">
        <label>
          Story bible notes
          <input value={value.storyBibleNotes} onChange={event => update('storyBibleNotes', event.target.value)} />
        </label>
        <label>
          Project title
          <input value={value.projectTitle} onChange={event => update('projectTitle', event.target.value)} />
        </label>
        <label>
          Workflow
          <select value={value.workflowStage} onChange={event => update('workflowStage', event.target.value as CreativeComposerState['workflowStage'])}>
            <option value="premise">Premise</option>
            <option value="logline">Logline</option>
            <option value="outline">Outline</option>
            <option value="beat_sheet">Beat Sheet</option>
            <option value="chapter_outline">Chapter Outline</option>
            <option value="scene_list">Scene List</option>
            <option value="draft_chapter">Draft Chapter</option>
            <option value="continuity_review">Continuity Review</option>
            <option value="revision_pass">Revision Pass</option>
            <option value="final_export">Final Export</option>
          </select>
        </label>
      </div>
      <div className="creative-composer-row creative-composer-boundaries">
        <label>
          Branch ID
          <input value={value.branchId} onChange={event => update('branchId', event.target.value)} />
        </label>
        <label>
          Prompt pack
          <input value={value.promptPackId} onChange={event => update('promptPackId', event.target.value)} />
        </label>
        <label>
          Pack instructions
          <input value={value.promptPackInstructions} onChange={event => update('promptPackInstructions', event.target.value)} />
        </label>
      </div>
      <div className="creative-composer-row">
        <label className="creative-toggle">
          <input
            type="checkbox"
            checked={value.privacyLocalOnly}
            onChange={event => update('privacyLocalOnly', event.target.checked)}
          />
          Local/private
        </label>
        <label className="creative-toggle">
          <input
            type="checkbox"
            checked={value.analyticsEnabled}
            onChange={event => update('analyticsEnabled', event.target.checked)}
          />
          Analytics
        </label>
        <label>
          Retention
          <input type="number" min="1" max="3650" value={value.retentionDays} onChange={event => update('retentionDays', Number(event.target.value))} />
        </label>
      </div>
      {mode === 'roleplay' && onActionCommand && (
        <div className="creative-action-row" aria-label="Roleplay actions">
          <button type="button" onClick={() => onActionCommand('/continue')}>Continue</button>
          <button type="button" onClick={() => onActionCommand('/ooc')}>OOC</button>
          <button type="button" onClick={() => onActionCommand('/summary')}>Summarize</button>
          <button type="button" onClick={() => onActionCommand('/branch')}>Branch</button>
          <button type="button" onClick={() => onActionCommand('/rewind')}>Rewind</button>
          <button type="button" onClick={() => onActionCommand('/fade')}>Fade</button>
          <button type="button" onClick={() => onActionCommand('/end')}>End Scene</button>
        </div>
      )}
    </section>
  );
}

export function buildCreativeRequestPayload(input: string, mode: CreativeChatMode, state: CreativeComposerState) {
  const hardLimits = splitList(state.hardLimits);
  const allowedMatureThemes = splitList(state.allowedMatureThemes);
  const continuityNotes = splitList(state.storyBibleNotes);
  const promptPackInstructions = splitList(state.promptPackInstructions);

  return {
    operation: mode === 'roleplay' ? 'roleplay_turn' : undefined,
    genre: state.genre,
    format: mode === 'roleplay' ? 'roleplay' : state.format,
    presetId: state.presetId,
    presetInstructions: state.presetInstructions || [],
    rating: state.rating,
    matureMode: state.matureMode,
    qualityPass: state.qualityPass,
    config: {
      pov: state.pov,
      tense: state.tense,
      tone: state.tone,
      length: state.length,
      proseDensity: state.proseDensity,
      dialogueDensity: state.dialogueDensity,
      pacing: input.length > 1200 ? 'slow_burn' : 'balanced',
    },
    boundaries: {
      hardLimits,
      fadeToBlack: state.fadeToBlack,
      disallowedThemes: [
        'minor sexual content',
        'real-person sexual content',
        'non-consensual sexual content',
      ],
      allowedMatureThemes,
    },
    storyBible: continuityNotes.length > 0
      ? { continuityNotes }
      : undefined,
    project: state.projectTitle
      ? {
          title: state.projectTitle,
          workflowStage: state.workflowStage,
          exportFormats: ['markdown', 'json'],
        }
      : undefined,
    branch: state.branchId
      ? { branchId: state.branchId }
      : undefined,
    privacy: {
      localOnly: state.privacyLocalOnly,
      analyticsEnabled: state.analyticsEnabled,
      retentionDays: state.retentionDays,
      redactLogs: state.privacyLocalOnly,
    },
    promptPack: state.promptPackId
      ? {
          packId: state.promptPackId,
          instructions: promptPackInstructions,
        }
      : undefined,
  };
}

export function applyCreativePreset(state: CreativeComposerState): CreativeComposerState {
  const effectiveFormat = state.format;
  const genrePreset = genrePresets[state.genre];
  const formatPreset = formatPresets[effectiveFormat];
  const presetInstructions = [
    ...(genrePreset?.instructions || []),
    ...(formatPreset?.instructions || []),
  ];

  return {
    ...state,
    ...withoutInstructions(genrePreset),
    ...withoutInstructions(formatPreset),
    presetId: `${state.genre}:${effectiveFormat}`,
    presetInstructions,
  };
}

function withoutInstructions(preset: (Partial<CreativeComposerState> & { instructions: string[] }) | undefined): Partial<CreativeComposerState> {
  if (!preset) return {};
  const { instructions: _instructions, ...rest } = preset;
  return rest;
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export default CreativeComposerPanel;
