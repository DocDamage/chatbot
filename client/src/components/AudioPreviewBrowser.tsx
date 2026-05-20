import { useEffect, useRef, useState } from 'react';
import { AudioFileContext, listAudioFiles, loadAudioMetadata } from '../api/audio';
import './AudioPreviewBrowser.css';

interface AudioPreviewBrowserProps {
  onLoadAudio: (audio: AudioFileContext) => void;
}

function AudioPreviewBrowser({ onLoadAudio }: AudioPreviewBrowserProps) {
  const [files, setFiles] = useState<AudioFileContext[]>([]);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string>();
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  const refresh = async () => {
    try {
      setFiles(await listAudioFiles('.', query));
      setError('');
    } catch (error: any) {
      setError(error.message);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const preview = (path: string) => {
    setActive(path);
    if (audioRef.current) {
      audioRef.current.src = `/api/audio/preview?path=${encodeURIComponent(path)}`;
      audioRef.current.play().catch(() => setError('Preview is not supported for this file in the browser.'));
    }
  };

  const load = async (path: string) => {
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
      <audio ref={audioRef} controls />
    </section>
  );
}

export default AudioPreviewBrowser;
