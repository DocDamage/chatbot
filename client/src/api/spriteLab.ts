import { throwApiError } from './errors';

export type SpriteWorkflow = 'spritesheet_export' | 'frame_slice' | 'palette_extract' | 'manifest_generate';

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
  const response = await fetch('/api/sprite-lab/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!response.ok) await throwApiError(response, 'Unable to plan Sprite Lab workflow');
  return response.json();
}
