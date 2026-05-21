import { z } from 'zod';
import type { CreativeCapabilityReport } from './CreativeCapabilityDetector';
import type { CreativeQualityReview } from './CreativeQualityReviewer';

export const creativeRatings = ['General', 'Teen', 'Mature', 'Adult Fiction'] as const;
export const creativeOperations = [
  'draft_scene',
  'continue_scene',
  'revise_passage',
  'outline_novel',
  'build_character',
  'build_world',
  'roleplay_turn',
  'summarize_continuity',
  'export_draft',
] as const;

export const creativeRoleplayActions = [
  'ooc',
  'summary',
  'scene',
  'cast',
  'boundary',
  'rewind',
  'branch',
  'fade',
  'end',
  'regenerate',
  'continue',
  'help',
] as const;

export const creativeConfigSchema = z.object({
  pov: z.enum(['first', 'second', 'third_limited', 'third_omniscient']).optional(),
  tense: z.enum(['past', 'present']).optional(),
  tone: z.string().min(1).max(120).optional(),
  narratorStyle: z.string().min(1).max(120).optional(),
  length: z.enum(['flash', 'short', 'medium', 'long']).optional(),
  proseDensity: z.number().int().min(1).max(10).optional(),
  dialogueDensity: z.number().int().min(1).max(10).optional(),
  pacing: z.enum(['slow_burn', 'balanced', 'fast']).optional(),
  violenceLevel: z.number().int().min(0).max(10).optional(),
  romanceLevel: z.number().int().min(0).max(10).optional(),
}).strict();

export const roleplayBoundaryStateSchema = z.object({
  hardLimits: z.array(z.string().min(1).max(200)).max(50).default([]),
  preferredTone: z.string().min(1).max(120).optional(),
  preferredRating: z.enum(creativeRatings).optional(),
  fadeToBlack: z.boolean().default(true),
  disallowedThemes: z.array(z.string().min(1).max(200)).max(50).default([]),
  allowedMatureThemes: z.array(z.string().min(1).max(200)).max(50).default([]),
}).strict();

export const storyBibleContextSchema = z.object({
  characters: z.array(z.string().min(1).max(200)).max(100).default([]),
  locations: z.array(z.string().min(1).max(200)).max(100).default([]),
  factions: z.array(z.string().min(1).max(200)).max(100).default([]),
  loreRules: z.array(z.string().min(1).max(500)).max(100).default([]),
  timelineEvents: z.array(z.string().min(1).max(500)).max(100).default([]),
  chapters: z.array(z.string().min(1).max(500)).max(100).default([]),
  scenes: z.array(z.string().min(1).max(500)).max(100).default([]),
  styleGuide: z.array(z.string().min(1).max(500)).max(100).default([]),
  ratingRules: z.array(z.string().min(1).max(500)).max(100).default([]),
  continuityNotes: z.array(z.string().min(1).max(500)).max(100).default([]),
}).partial().strict();

export const roleplaySessionStateSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  sessionId: z.string().min(1).max(200).optional(),
  playerCharacter: z.string().min(1).max(200).optional(),
  assistantCharacter: z.string().min(1).max(200).optional(),
  narratorMode: z.enum(['limited', 'cinematic', 'first_person', 'dialogue_only']).optional(),
  sceneLocation: z.string().min(1).max(200).optional(),
  activeCast: z.array(z.string().min(1).max(200)).max(50).default([]),
  goals: z.array(z.string().min(1).max(300)).max(30).default([]),
  inventory: z.array(z.string().min(1).max(200)).max(50).default([]),
  boundaries: roleplayBoundaryStateSchema.optional(),
  paused: z.boolean().optional(),
  turnHistory: z.array(z.object({
    id: z.string().min(1).max(200).optional(),
    speaker: z.string().min(1).max(200),
    text: z.string().min(1).max(5000),
    mode: z.enum(['ic', 'ooc', 'narration']).optional(),
  }).strict()).max(500).default([]),
}).partial().strict();

export const creativeProjectWorkflowSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  workflowStage: z.enum([
    'premise',
    'logline',
    'outline',
    'beat_sheet',
    'chapter_outline',
    'scene_list',
    'draft_chapter',
    'continuity_review',
    'revision_pass',
    'final_export',
  ]).optional(),
  currentChapter: z.string().min(1).max(200).optional(),
  currentScene: z.string().min(1).max(200).optional(),
  draftVersions: z.array(z.string().min(1).max(500)).max(100).default([]),
  exportFormats: z.array(z.enum(['markdown', 'text', 'json'])).max(3).default([]),
}).partial().strict();

export const creativeBranchStateSchema = z.object({
  branchId: z.string().min(1).max(200).optional(),
  parentTurnId: z.string().min(1).max(200).optional(),
  alternateTakes: z.array(z.string().min(1).max(1000)).max(20).default([]),
  restoreBranchId: z.string().min(1).max(200).optional(),
}).partial().strict();

export const creativePrivacyControlsSchema = z.object({
  localOnly: z.boolean().default(false),
  analyticsEnabled: z.boolean().default(true),
  retentionDays: z.number().int().min(1).max(3650).optional(),
  redactLogs: z.boolean().default(false),
}).strict();

export const creativePromptPackRefSchema = z.object({
  packId: z.string().min(1).max(200),
  promptId: z.string().min(1).max(200).optional(),
  instructions: z.array(z.string().min(1).max(500)).max(20).default([]),
}).strict();

export const creativeProviderCapabilitySchema = z.object({
  provider: z.string().min(1).max(100),
  model: z.string().min(1).max(200),
  maxTokens: z.number().int().min(1).max(1000000),
  qualityScore: z.number().min(0).max(1),
  instructionFollowing: z.boolean().optional(),
  safetyClassification: z.boolean().optional(),
}).strict();

export const creativeRequestSchema = z.object({
  operation: z.enum(creativeOperations).optional(),
  prompt: z.string().min(1).max(20000),
  genre: z.string().min(1).max(100).optional(),
  format: z.string().min(1).max(100).optional(),
  presetId: z.string().min(1).max(200).optional(),
  presetInstructions: z.array(z.string().min(1).max(500)).max(20).default([]),
  qualityPass: z.boolean().default(false),
  rating: z.enum(creativeRatings).default('Teen'),
  matureMode: z.boolean().default(false),
  projectId: z.string().min(1).max(200).optional(),
  storyBibleId: z.string().min(1).max(200).optional(),
  characterIds: z.array(z.string().min(1).max(200)).max(100).optional(),
  sceneId: z.string().min(1).max(200).optional(),
  revisionOperation: z.enum([
    'expand',
    'condense',
    'make_darker',
    'make_funnier',
    'increase_tension',
    'improve_dialogue',
    'show_dont_tell',
    'line_edit',
    'copy_edit',
    'continuity_fix',
    'rating_adjustment',
  ]).optional(),
  roleplayAction: z.enum(creativeRoleplayActions).optional(),
  config: creativeConfigSchema.optional(),
  boundaries: roleplayBoundaryStateSchema.optional(),
  storyBible: storyBibleContextSchema.optional(),
  roleplay: roleplaySessionStateSchema.optional(),
  project: creativeProjectWorkflowSchema.optional(),
  branch: creativeBranchStateSchema.optional(),
  privacy: creativePrivacyControlsSchema.optional(),
  promptPack: creativePromptPackRefSchema.optional(),
  providerCapability: creativeProviderCapabilitySchema.optional(),
}).strict();

export type CreativeRating = typeof creativeRatings[number];
export type CreativeOperation = typeof creativeOperations[number];
export type CreativeRoleplayAction = typeof creativeRoleplayActions[number];
export type CreativeConfig = z.infer<typeof creativeConfigSchema>;
export type RoleplayBoundaryState = z.infer<typeof roleplayBoundaryStateSchema>;
export type StoryBibleContext = z.infer<typeof storyBibleContextSchema>;
export type RoleplaySessionState = z.infer<typeof roleplaySessionStateSchema>;
export type CreativeProjectWorkflow = z.infer<typeof creativeProjectWorkflowSchema>;
export type CreativeBranchState = z.infer<typeof creativeBranchStateSchema>;
export type CreativePrivacyControls = z.infer<typeof creativePrivacyControlsSchema>;
export type CreativePromptPackRef = z.infer<typeof creativePromptPackRefSchema>;
export type CreativeProviderCapability = z.infer<typeof creativeProviderCapabilitySchema>;
export type CreativeRequest = z.infer<typeof creativeRequestSchema>;
export type CreativeRequestInput = z.input<typeof creativeRequestSchema>;

export interface CreativeAgentResult {
  domain: 'creative_writing';
  mode: CreativeOperation;
  response: string;
  sources: string[];
  model: string;
  safety: {
    rating: CreativeRating;
    matureMode: boolean;
    boundaryPolicy: string;
  };
  actions?: string[];
  blocked?: boolean;
  qualityReview?: CreativeQualityReview;
  command?: {
    roleplayAction?: CreativeRoleplayAction;
    revisionOperation?: string;
  };
  safeAlternatives?: string[];
  export?: {
    format: 'markdown' | 'text' | 'json';
    content: string;
  };
  degradedMode?: CreativeCapabilityReport;
}
