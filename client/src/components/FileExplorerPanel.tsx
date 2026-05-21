import { useEffect, useRef, useState } from 'react';
import { fetchFileTree, LoadedFileContext, readFile, searchFiles } from '../api/files';
import { isStaticPagesBuild } from '../api/runtime';
import FilePreviewPane from './FilePreviewPane';
import './FileExplorerPanel.css';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface FileExplorerPanelProps {
  onLoadFile?: (file: LoadedFileContext) => void;
  mode?: 'browse' | 'select';
  accept?: string[];
  onSelect?: (file: FileNode) => void;
}

const textPreviewExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.css', '.html', '.yml', '.yaml']);
const imagePreviewExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const audioPreviewExtensions = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a']);

function FileExplorerPanel({ onLoadFile, mode = 'browse', accept, onSelect }: FileExplorerPanelProps) {
  const [tree, setTree] = useState<FileNode | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ path: string; match: string }>>([]);
  const [nextOffset, setNextOffset] = useState<number | undefined>();
  const [preview, setPreview] = useState<LoadedFileContext | undefined>();
  const [mediaPreview, setMediaPreview] = useState<{ type: 'image' | 'audio'; path: string } | undefined>();
  const [error, setError] = useState('');
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isStaticPagesBuild) {
      setError('Workspace file APIs require the local backend.');
      return;
    }
    fetchFileTree('.', 3).then(setTree).catch(error => setError(error.message));
  }, []);

  const openPreview = async (filePath: string) => {
    if (isStaticPagesBuild) return;
    const fileNode: FileNode = {
      name: filePath.split('/').pop() || filePath,
      path: filePath,
      type: 'file'
    };
    if (mode === 'select' && isAccepted(filePath)) {
      onSelect?.(fileNode);
    }

    const ext = extension(filePath);
    setPreview(undefined);
    setMediaPreview(undefined);

    if (imagePreviewExtensions.has(ext)) {
      setMediaPreview({ type: 'image', path: filePath });
      setError('');
      return;
    }
    if (audioPreviewExtensions.has(ext)) {
      setMediaPreview({ type: 'audio', path: filePath });
      setError('');
      return;
    }
    if (!textPreviewExtensions.has(ext)) {
      setError(`Preview is not available for ${ext || 'this file type'}.`);
      return;
    }

    try {
      setPreview(await readFile(filePath));
      setError('');
    } catch (error: any) {
      setError(error.message);
    }
  };

  useEffect(() => {
    if (isStaticPagesBuild) return;
    const handle = window.setTimeout(() => {
      if (query.trim()) void runSearch(0);
      else {
        searchAbortRef.current?.abort();
        setResults([]);
        setNextOffset(undefined);
      }
    }, 250);

    return () => window.clearTimeout(handle);
  }, [query]);

  const runSearch = async (offset = 0) => {
    if (isStaticPagesBuild) return;
    if (!query.trim()) {
      setResults([]);
      setNextOffset(undefined);
      return;
    }
    try {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      const data = await searchFiles(query, 'both', { limit: 50, offset, signal: controller.signal });
      setResults(prev => offset > 0 ? [...prev, ...(data.results || [])] : data.results || []);
      setNextOffset(data.nextOffset);
      setError('');
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      setError(error.message);
    }
  };

  const canSelect = (filePath: string) => mode === 'select' && isAccepted(filePath);

  return (
    <aside className="file-explorer-panel" aria-label="Workspace files">
      <div className="file-explorer-header">
        <strong>Files</strong>
        <input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.key === 'Enter' && runSearch(0)} placeholder="Search files" />
      </div>
      {error && <div className="file-explorer-error">{error}</div>}
      <div className="file-explorer-body">
        {results.length > 0 ? (
          <div className="file-results">
            {results.map(result => (
              <button key={result.path} type="button" onClick={() => openPreview(result.path)}>
                <span>{result.path}</span>
                <small>{canSelect(result.path) ? 'selectable' : result.match}</small>
              </button>
            ))}
            {nextOffset !== undefined && (
              <button type="button" onClick={() => runSearch(nextOffset)}>
                More results
              </button>
            )}
          </div>
        ) : (
          <div className="file-tree">{tree && <TreeNode node={tree} onOpenFile={openPreview} selectablePath={canSelect} />}</div>
        )}
      </div>
      <FilePreviewPane file={preview} onLoad={onLoadFile || (() => undefined)} />
      {mediaPreview?.type === 'image' && (
        <div className="file-preview-pane">
          <div className="file-preview-header"><strong>{mediaPreview.path}</strong><span>image preview</span></div>
          <img className="file-preview-image" src={`/api/files/preview/image?path=${encodeURIComponent(mediaPreview.path)}`} alt={mediaPreview.path} />
        </div>
      )}
      {mediaPreview?.type === 'audio' && (
        <div className="file-preview-pane">
          <div className="file-preview-header"><strong>{mediaPreview.path}</strong><span>audio preview</span></div>
          <audio controls src={`/api/files/preview/audio?path=${encodeURIComponent(mediaPreview.path)}`} />
        </div>
      )}
    </aside>
  );

  function isAccepted(filePath: string): boolean {
    if (!accept?.length) return true;
    return accept.map(value => value.toLowerCase()).includes(extension(filePath));
  }
}

function TreeNode({ node, onOpenFile, selectablePath }: { node: FileNode; onOpenFile: (path: string) => void; selectablePath: (path: string) => boolean }) {
  if (node.type === 'file') {
    return (
      <button className={`file-node file-node-file ${selectablePath(node.path) ? 'file-node-selectable' : ''}`} type="button" onClick={() => onOpenFile(node.path)}>
        {node.name}
      </button>
    );
  }

  return (
    <details className="file-node-group" open={node.path === '.'}>
      <summary>{node.name}</summary>
      <div>
        {node.children?.map(child => <TreeNode key={child.path} node={child} onOpenFile={onOpenFile} selectablePath={selectablePath} />)}
      </div>
    </details>
  );
}

function extension(filePath: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  const name = filePath.slice(lastSlash + 1);
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

export default FileExplorerPanel;
