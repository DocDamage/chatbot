import { throwApiError } from './errors';

export interface LocalExecutableSummary {
  toolId?: string;
  toolSlug?: string;
  toolName: string;
  executableName: string;
  executablePath: string;
  detected: boolean;
  detectionMethod: 'path' | 'known_path' | 'manual';
  enabled: boolean;
  trustLevel: string;
  approvalPolicy: string;
}

export interface PlannedLocalRun {
  runId: string;
  status: 'planned';
  toolSlug?: string;
  executablePath?: string;
  commandTemplate: string;
  resolvedCommand: string[];
  cwd: string;
  riskLevel: string;
  requiresApproval: boolean;
}

export async function detectLocalTools(): Promise<{ detections: LocalExecutableSummary[] }> {
  const response = await fetch('/api/local-tools/detect');
  if (!response.ok) await throwApiError(response, 'Unable to detect local tools');
  return response.json();
}

export async function listLocalExecutables(): Promise<{ executables: LocalExecutableSummary[] }> {
  const response = await fetch('/api/local-tools/executables');
  if (!response.ok) await throwApiError(response, 'Unable to list local executables');
  return response.json();
}

export async function registerLocalExecutable(input: {
  name: string;
  executablePath: string;
  toolSlug?: string;
  enabled?: boolean;
  trustLevel?: string;
  approvalPolicy?: string;
}): Promise<{ executable: LocalExecutableSummary }> {
  const response = await fetch('/api/local-tools/executables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!response.ok) await throwApiError(response, 'Unable to register local executable');
  return response.json();
}

export async function planLocalRun(input: {
  toolSlug?: string;
  executablePath?: string;
  args?: string[];
  cwd?: string;
  riskLevel?: string;
  approvedByUser?: boolean;
}): Promise<PlannedLocalRun> {
  const response = await fetch('/api/local-tools/run/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!response.ok) await throwApiError(response, 'Unable to plan local run');
  return response.json();
}
