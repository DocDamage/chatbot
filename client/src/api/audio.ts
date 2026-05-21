import { throwApiError } from './errors';

export interface AudioFileContext {
  path: string;
  name: string;
  extension: string;
  size: number;
  modifiedTime: string;
  format?: string;
  duration?: number;
  ffmpegAvailable?: boolean;
  notice?: string;
}

export interface AudioFileListResponse {
  files: AudioFileContext[];
  nextOffset?: number;
  totalIndexed: number;
  scannedFiles: number;
  truncated: boolean;
  cached: boolean;
}

export async function listAudioFiles(
  root = '.',
  q = '',
  options: { limit?: number; offset?: number; signal?: AbortSignal } = {}
): Promise<AudioFileListResponse> {
  const params = new URLSearchParams({
    root,
    q,
    limit: String(options.limit || 50)
  });
  if (options.offset) params.set('offset', String(options.offset));
  const response = await fetch(`/api/audio/files?${params.toString()}`, { signal: options.signal });
  if (!response.ok) await throwApiError(response, 'Unable to load audio files');
  return response.json();
}

export async function loadAudioMetadata(path: string): Promise<AudioFileContext> {
  const response = await fetch(`/api/audio/metadata?path=${encodeURIComponent(path)}`);
  if (!response.ok) await throwApiError(response, 'Unable to load audio metadata');
  return response.json();
}
