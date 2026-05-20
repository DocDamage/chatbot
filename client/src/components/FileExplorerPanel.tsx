import { useEffect, useState } from 'react';
import { fetchFileTree, LoadedFileContext, readFile, searchFiles } from '../api/files';
import FilePreviewPane from './FilePreviewPane';
import './FileExplorerPanel.css';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface FileExplorerPanelProps {
  onLoadFile: (file: LoadedFileContext) => void;
}

function FileExplorerPanel({ onLoadFile }: FileExplorerPanelProps) {
  const [tree, setTree] = useState<FileNode | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ path: string; match: string }>>([]);
  const [preview, setPreview] = useState<LoadedFileContext | undefined>();
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFileTree('.', 3).then(setTree).catch(error => setError(error.message));
  }, []);

  const openPreview = async (path: string) => {
    try {
      setPreview(await readFile(path));
      setError('');
    } catch (error: any) {
      setError(error.message);
    }
  };

  const runSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    try {
      const data = await searchFiles(query, 'both');
      setResults(data.results || []);
      setError('');
    } catch (error: any) {
      setError(error.message);
    }
  };

  return (
    <aside className="file-explorer-panel" aria-label="Workspace files">
      <div className="file-explorer-header">
        <strong>Files</strong>
        <input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.key === 'Enter' && runSearch()} placeholder="Search files" />
      </div>
      {error && <div className="file-explorer-error">{error}</div>}
      <div className="file-explorer-body">
        {results.length > 0 ? (
          <div className="file-results">
            {results.map(result => (
              <button key={result.path} type="button" onClick={() => openPreview(result.path)}>
                <span>{result.path}</span>
                <small>{result.match}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="file-tree">{tree && <TreeNode node={tree} onOpenFile={openPreview} />}</div>
        )}
      </div>
      <FilePreviewPane file={preview} onLoad={onLoadFile} />
    </aside>
  );
}

function TreeNode({ node, onOpenFile }: { node: FileNode; onOpenFile: (path: string) => void }) {
  if (node.type === 'file') {
    return <button className="file-node file-node-file" type="button" onClick={() => onOpenFile(node.path)}>{node.name}</button>;
  }

  return (
    <details className="file-node-group" open={node.path === '.'}>
      <summary>{node.name}</summary>
      <div>
        {node.children?.map(child => <TreeNode key={child.path} node={child} onOpenFile={onOpenFile} />)}
      </div>
    </details>
  );
}

export default FileExplorerPanel;
