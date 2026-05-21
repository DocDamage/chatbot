import { throwApiError } from './errors';

export interface CodeSearchResult {
  path: string;
}

export async function askCodeAgent(message: string, runVerification = false) {
  const response = await fetch('/api/code/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, runVerification }),
  });
  if (!response.ok) await throwApiError(response, 'Unable to ask code agent');
  return response.json();
}

export async function planCodeWork(message: string) {
  const response = await fetch('/api/code/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) await throwApiError(response, 'Unable to plan code work');
  return response.json();
}

export async function searchCodeFiles(q: string, signal?: AbortSignal): Promise<CodeSearchResult[]> {
  const params = new URLSearchParams({ q });
  const response = await fetch(`/api/code/files/search?${params.toString()}`, { signal });
  if (!response.ok) await throwApiError(response, 'Unable to search code files');
  const data = await response.json();
  return data.results || [];
}

export async function getCodeSymbols(file: string) {
  const params = new URLSearchParams({ file });
  const response = await fetch(`/api/code/symbols?${params.toString()}`);
  if (!response.ok) await throwApiError(response, 'Unable to load code symbols');
  const data = await response.json();
  return data.symbols || [];
}

export async function createCodePatch(message: string, mode: string) {
  const response = await fetch('/api/code/patch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, mode }),
  });
  if (!response.ok) await throwApiError(response, 'Unable to create patch');
  return response.json();
}

export async function reviewCodeDiff(diff: string, focus: string[] = []) {
  const response = await fetch('/api/code/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ diff, focus }),
  });
  if (!response.ok) await throwApiError(response, 'Unable to review code');
  return response.json();
}

export async function verifyCode(commands: string[], mode: string) {
  const response = await fetch('/api/code/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands, mode }),
  });
  if (!response.ok) await throwApiError(response, 'Unable to verify code');
  return response.json();
}
