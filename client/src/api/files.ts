import { throwApiError } from './errors';

export interface LoadedFileContext {
  path: string;
  content: string;
  language: string;
  size: number;
  startLine: number;
  endLine: number;
  checksum: string;
  modifiedTime: string;
}

export async function fetchFileTree(root = '.', maxDepth = 3) {
  const response = await fetch(`/api/files/tree?root=${encodeURIComponent(root)}&maxDepth=${maxDepth}`);
  if (!response.ok) await throwApiError(response, 'Unable to load file tree');
  return response.json();
}

export async function searchFiles(
  q: string,
  kind: 'name' | 'content' | 'both' = 'both',
  options: { limit?: number; offset?: number; signal?: AbortSignal } = {}
) {
  const params = new URLSearchParams({ q, kind, limit: String(options.limit || 50) });
  if (options.offset) params.set('offset', String(options.offset));
  const response = await fetch(`/api/files/search?${params.toString()}`, { signal: options.signal });
  if (!response.ok) await throwApiError(response, 'Unable to search files');
  return response.json();
}

export async function readFile(path: string, startLine?: number, endLine?: number): Promise<LoadedFileContext> {
  const params = new URLSearchParams({ path });
  if (startLine) params.set('startLine', String(startLine));
  if (endLine) params.set('endLine', String(endLine));
  const response = await fetch(`/api/files/read?${params.toString()}`);
  if (!response.ok) await throwApiError(response, 'Unable to read file');
  return response.json();
}
