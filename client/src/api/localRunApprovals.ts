import { throwApiError } from './errors';

export interface LocalRunSummary {
  id: string;
  status: string;
  commandTemplate: string;
  cwd: string;
  riskLevel: string;
  approvedByUser: boolean;
  executableEnabled?: boolean;
  executablePath?: string;
  stdoutPath?: string;
  stderrPath?: string;
  durationMs?: number;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface LocalRunOutputFile {
  fileName: string;
  size: number;
  modifiedTime: string;
  kind: 'stdout' | 'stderr' | 'output';
  downloadUrl: string;
}

export async function listLocalRuns(limit = 25): Promise<{ runs: LocalRunSummary[] }> {
  const response = await fetch(`/api/local-tools/runs?limit=${encodeURIComponent(String(limit))}`);
  if (!response.ok) await throwApiError(response, 'Unable to list local runs');
  return response.json();
}

export async function approveLocalRun(runId: string, approvalNote?: string): Promise<{ run: LocalRunSummary }> {
  const response = await fetch(`/api/local-tools/runs/${encodeURIComponent(runId)}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approvalNote })
  });
  if (!response.ok) await throwApiError(response, 'Unable to approve local run');
  return response.json();
}

export async function startLocalRun(runId: string): Promise<{ run: LocalRunSummary & { stdout?: string; stderr?: string } }> {
  const response = await fetch(`/api/local-tools/runs/${encodeURIComponent(runId)}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!response.ok) await throwApiError(response, 'Unable to start local run');
  return response.json();
}

export async function cancelLocalRun(runId: string): Promise<{ runId: string; cancelRequested: boolean; status: string }> {
  const response = await fetch(`/api/local-tools/runs/${encodeURIComponent(runId)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!response.ok) await throwApiError(response, 'Unable to cancel local run');
  return response.json();
}

export async function listLocalRunFiles(runId: string): Promise<{ runId: string; files: LocalRunOutputFile[] }> {
  const response = await fetch(`/api/local-tools/runs/${encodeURIComponent(runId)}/files`);
  if (!response.ok) await throwApiError(response, 'Unable to list local run output files');
  return response.json();
}

export async function readLocalRunFile(runId: string, fileName: string): Promise<string> {
  const response = await fetch(`/api/local-tools/runs/${encodeURIComponent(runId)}/files/${encodeURIComponent(fileName)}`);
  if (!response.ok) await throwApiError(response, `Unable to read ${fileName}`);
  return response.text();
}

export function localRunFileUrl(runId: string, fileName: string): string {
  return `/api/local-tools/runs/${encodeURIComponent(runId)}/files/${encodeURIComponent(fileName)}`;
}
