import { throwApiError } from './errors';

export interface CodeSearchResult {
  path: string;
}

export interface StructuredCodeOperation {
  operation: 'create' | 'modify' | 'delete';
  path: string;
  content?: string;
  expectedContent?: string;
  expectedHash?: string;
  reason: string;
  authorized: boolean;
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

export async function getCodeRepository(mode: string) {
  const response = await fetch('/api/code/repository', { headers: { 'x-work-mode': mode } });
  if (!response.ok) await throwApiError(response, 'Unable to inspect repository');
  return response.json();
}

export async function retrieveCodeEvidence(query: string, mode: string) {
  const response = await fetch('/api/code/retrieve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-work-mode': mode },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) await throwApiError(response, 'Unable to retrieve code evidence');
  return response.json();
}

export async function createStructuredCodePatch(message: string, mode: string) {
  const response = await fetch('/api/code/patch/structured', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-work-mode': mode },
    body: JSON.stringify({ message, mode }),
  });
  if (!response.ok) await throwApiError(response, 'Unable to create structured patch');
  return response.json();
}

export async function applyStructuredCodePatch(operations: StructuredCodeOperation[], mode: string) {
  const response = await fetch('/api/code/patch/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-work-mode': mode },
    body: JSON.stringify({ operations: operations.map(operation => ({ ...operation, authorized: true })), mode, approved: true }),
  });
  if (!response.ok) await throwApiError(response, 'Unable to apply structured patch');
  return response.json();
}

export async function verifyNativeCode(mode: string, run = true) {
  const response = await fetch('/api/code/verify/native', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-work-mode': mode },
    body: JSON.stringify({ mode, run }),
  });
  if (!response.ok) await throwApiError(response, 'Unable to run native verification');
  return response.json();
}
