import { LoadedFileContext } from '../api/files';
import { AudioFileContext } from '../api/audio';

interface LoadedFilesBarProps {
  files: LoadedFileContext[];
  audio: AudioFileContext[];
  onRemoveFile: (path: string) => void;
  onRemoveAudio: (path: string) => void;
}

function LoadedFilesBar({ files, audio, onRemoveFile, onRemoveAudio }: LoadedFilesBarProps) {
  if (files.length === 0 && audio.length === 0) return null;

  return (
    <div className="loaded-files-bar" aria-label="Loaded chat context">
      {files.map(file => (
        <button key={file.path} type="button" onClick={() => onRemoveFile(file.path)}>
          {file.path}:{file.startLine}-{file.endLine}
        </button>
      ))}
      {audio.map(file => (
        <button key={file.path} type="button" onClick={() => onRemoveAudio(file.path)}>
          {file.name}
        </button>
      ))}
    </div>
  );
}

export default LoadedFilesBar;
