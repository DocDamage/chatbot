import { useEffect, useRef, useState } from 'react';
import { AudioFileContext, listAudioFiles, loadAudioMetadata } from '../api/audio';
import { isStaticPagesBuild } from '../api/runtime';
import './AudioPreviewBrowser.css';

interface AudioPreviewBrowserProps {
  onLoadAudio: (audio: AudioFileContext) => void;
}

function AudioPreviewBrowser({ onLoadAudio }: AudioPreviewBrowserProps) {
  const [files, setFiles] = useState<AudioFileContext[]>([]);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string>();
  const [error, setError] = useState('');
  const [nextOffset, setNextOffset] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const refresh = async (offset = 0) => {
    if (isStaticPagesBuild) {
      setFiles([]);
      setError('Audio preview APIs require the local backend.');
      return;
    }
    searchAbortRef.current?.abort();
    const abortController = new AbortController();
    searchAbortRef.current = abortController;
    setLoading(true);
    try {
      const result = await listAudioFiles('.', query, { limit: 50, offset, signal: abortController.signal });
      setFiles(current => offset > 0 ? [...current, ...result.files] : result.files);
      setNextOffset(result.nextOffset);
      setError('');
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      setError(error.message);
    } finally {
      if (searchAbortRef.current === abortController) {
        searchAbortRef.current = null;
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    refresh();
    return () => searchAbortRef.current?.abort();
  }, []);

  const preview = (path: string) => {
    if (isStaticPagesBuild) return;
    setActive(path);
    if (audioRef.current) {
      audioRef.current.src = `/api/audio/preview?path=${encodeURIComponent(path)}`;
      audioRef.current.play().catch(() => setError('Preview is not supported for this file in the browser.'));
    }
  };

  const load = async (path: string) => {
    if (isStaticPagesBuild) return;
    try {
      onLoadAudio(await loadAudioMetadata(path));
    } catch (error: any) {
      setError(error.message);
    }
  };

  return (
    <section className="audio-preview-browser" aria-label="Audio browser">
      <div className="audio-browser-header">
        <strong>Audio</strong>
        <input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.key === 'Enter' && refresh()} placeholder="Search samples" />
        <button type="button" onClick={() => refresh()} disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
      </div>
      {error && <div className="audio-browser-error">{error}</div>}
      <div className="audio-file-list">
        {files.map(file => (
          <div key={file.path} className={`audio-file-row ${active === file.path ? 'active' : ''}`}>
            <button type="button" onClick={() => preview(file.path)}>{file.name}</button>
            <span>{file.extension.replace('.', '')}</span>
            <button type="button" onClick={() => load(file.path)}>Load</button>
          </div>
        ))}
      </div>
      {nextOffset !== undefined && (
        <button type="button" className="audio-more-button" onClick={() => refresh(nextOffset)} disabled={loading}>
          More audio
        </button>
      )}
      <audio ref={audioRef} controls />
    </section>
  );
}

export default AudioPreviewBrowser;
