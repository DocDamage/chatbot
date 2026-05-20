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

export async function listAudioFiles(root = '.', q = ''): Promise<AudioFileContext[]> {
  const response = await fetch(`/api/audio/files?root=${encodeURIComponent(root)}&q=${encodeURIComponent(q)}`);
  if (!response.ok) throw new Error('Unable to load audio files');
  const data = await response.json();
  return data.files || [];
}

export async function loadAudioMetadata(path: string): Promise<AudioFileContext> {
  const response = await fetch(`/api/audio/metadata?path=${encodeURIComponent(path)}`);
  if (!response.ok) throw new Error('Unable to load audio metadata');
  return response.json();
}
