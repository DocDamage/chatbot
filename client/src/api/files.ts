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
  if (!response.ok) throw new Error('Unable to load file tree');
  return response.json();
}

export async function searchFiles(q: string, kind: 'name' | 'content' | 'both' = 'both') {
  const response = await fetch(`/api/files/search?q=${encodeURIComponent(q)}&kind=${kind}`);
  if (!response.ok) throw new Error('Unable to search files');
  return response.json();
}

export async function readFile(path: string, startLine?: number, endLine?: number): Promise<LoadedFileContext> {
  const params = new URLSearchParams({ path });
  if (startLine) params.set('startLine', String(startLine));
  if (endLine) params.set('endLine', String(endLine));
  const response = await fetch(`/api/files/read?${params.toString()}`);
  if (!response.ok) throw new Error('Unable to read file');
  return response.json();
}
