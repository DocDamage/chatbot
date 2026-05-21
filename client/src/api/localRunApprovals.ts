import { throwApiError } from './errors';

export interface LocalRunSummary {
  id: string;
  status: string;
  commandTemplate: string;
  cwd: string;
  riskLevel: string;
  approvedByUser: boolean;
  stdoutPath?: string;
  stderrPath?: string;
  durationMs?: number;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
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
