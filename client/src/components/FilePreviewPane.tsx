import { LoadedFileContext } from '../api/files';

interface FilePreviewPaneProps {
  file?: LoadedFileContext;
  onLoad: (file: LoadedFileContext) => void;
}

function FilePreviewPane({ file, onLoad }: FilePreviewPaneProps) {
  if (!file) {
    return <div className="file-preview-empty">Select a file to preview it.</div>;
  }

  return (
    <section className="file-preview-pane" aria-label="File preview">
      <div className="file-preview-header">
        <div>
          <strong>{file.path}</strong>
          <span>{file.language} · {file.startLine}-{file.endLine}</span>
        </div>
        <button type="button" onClick={() => onLoad(file)}>Load</button>
      </div>
      <pre>{file.content}</pre>
    </section>
  );
}

export default FilePreviewPane;
