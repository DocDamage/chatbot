import { throwApiError } from './errors';
import { LocalRunOutputFile, listLocalRunFiles, localRunFileUrl } from './localRunApprovals';

export type SpriteWorkflow = 'spritesheet_export' | 'frame_slice' | 'palette_extract' | 'manifest_generate';
export type ExternalSpriteBackend = 'aseprite' | 'libresprite' | 'pixelorama';

export interface SpriteBackendStatus {
  slug: 'aseprite' | 'libresprite' | 'pixelorama' | 'internal_sharp' | 'internal_python';
  label: string;
  available: boolean;
  role: 'primary' | 'fallback' | 'internal';
  detail: string;
}

export interface SpriteLabStatus {
  backends: SpriteBackendStatus[];
  selected: SpriteBackendStatus;
}

export interface SpriteWorkflowPlan {
  workflow: SpriteWorkflow;
  selectedBackend: SpriteBackendStatus;
  fallbackChain: SpriteBackendStatus[];
  inputPath: string;
  outputTarget: string;
  notes: string[];
}

export interface PlannedExternalSpriteRun {
  runId: string;
  status: string;
  riskLevel?: string;
  requiresApproval?: boolean;
  commandTemplate?: string;
  resolvedCommand?: string[];
  adapter?: {
    backend: ExternalSpriteBackend;
    workflow: SpriteWorkflow;
    inputPath: string;
    outputTarget: string;
    outputFiles: string[];
    notes: string[];
  };
}

async function postJson<T>(url: string, body: unknown, errorMessage: string): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) await throwApiError(response, errorMessage);
  return response.json();
}

export async function getSpriteLabStatus(): Promise<SpriteLabStatus> {
  const response = await fetch('/api/sprite-lab/status');
  if (!response.ok) await throwApiError(response, 'Unable to load Sprite Lab status');
  return response.json();
}

export async function planSpriteWorkflow(input: {
  workflow: SpriteWorkflow;
  inputPath: string;
  outputTarget?: string;
}): Promise<SpriteWorkflowPlan> {
  return postJson('/api/sprite-lab/plan', input, 'Unable to plan Sprite Lab workflow');
}

export async function sliceSpriteGrid(input: {
  inputPath: string;
  outputDir: string;
  frameWidth: number;
  frameHeight: number;
}): Promise<any> {
  return postJson('/api/sprite-lab/internal/slice-grid', input, 'Unable to slice sprite grid');
}

export async function extractSpritePalette(input: {
  inputPath: string;
  outputPath: string;
  maxColors?: number;
}): Promise<any> {
  return postJson('/api/sprite-lab/internal/palette', input, 'Unable to extract sprite palette');
}

export async function generateSpriteManifest(input: {
  inputPath: string;
  outputPath: string;
  frameWidth?: number;
  frameHeight?: number;
  animationName?: string;
}): Promise<any> {
  return postJson('/api/sprite-lab/internal/manifest', input, 'Unable to generate sprite manifest');
}

export async function planExternalSpriteRun(input: {
  backend: ExternalSpriteBackend;
  workflow: SpriteWorkflow;
  inputPath: string;
  outputTarget?: string;
  options?: Record<string, unknown>;
}): Promise<PlannedExternalSpriteRun> {
  return postJson('/api/sprite-lab/external/plan', input, 'Unable to plan external sprite tool run');
}

export async function runExternalSpriteTool(input: {
  backend: ExternalSpriteBackend;
  workflow: SpriteWorkflow;
  inputPath: string;
  outputTarget?: string;
  approvedByUser: boolean;
  options?: Record<string, unknown>;
}): Promise<any> {
  return postJson('/api/sprite-lab/external/run', input, 'Unable to start external sprite tool run');
}

export async function approveLocalToolRun(runId: string): Promise<any> {
  return postJson(`/api/local-tools/runs/${encodeURIComponent(runId)}/approve`, {
    approvalNote: 'Approved from Sprite Lab'
  }, 'Unable to approve external run');
}

export async function startLocalToolRun(runId: string): Promise<any> {
  return postJson(`/api/local-tools/runs/${encodeURIComponent(runId)}/start`, {}, 'Unable to start external run');
}

export async function listSpriteExternalRunFiles(runId: string): Promise<{ runId: string; files: LocalRunOutputFile[] }> {
  return listLocalRunFiles(runId);
}

export function spriteExternalRunFileUrl(runId: string, fileName: string): string {
  return localRunFileUrl(runId, fileName);
}
