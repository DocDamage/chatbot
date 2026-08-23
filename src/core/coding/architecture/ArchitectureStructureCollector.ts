import path from 'path';
import { IndexedSymbol } from '../index/ParserProvider';
import { ArchitectureGraphCollector } from './ArchitectureGraphCollector';
import { ArchitectureNode, ScannedArchitectureFile } from './ArchitectureTypes';
import {
  detectProjectRoots,
  modulePathForFile,
  projectRootForFile,
  roleForFile
} from './ArchitectureDetectors';
import { stableId } from './ArchitectureIdentity';

export interface ArchitectureStructureResult {
  repositoryId: string;
  fileIds: Map<string, string>;
  symbolIds: Map<IndexedSymbol, string>;
  parentIds: Map<string, string>;
}

export class ArchitectureStructureCollector {
  collect(
    files: ScannedArchitectureFile[],
    graph: ArchitectureGraphCollector,
    repositoryName: string
  ): ArchitectureStructureResult {
    const repositoryId = graph.addNode(node(
      'repository', stableId('repository', '.'), repositoryName, 1, {},
      [{ file: '.', confidence: 1, detail: 'approved repository root' }], '.'
    ));
    const fileIds = new Map<string, string>();
    const symbolIds = new Map<IndexedSymbol, string>();
    this.addFiles(files, graph, repositoryId, fileIds, symbolIds);
    const parentIds = this.addHierarchy(files, graph, repositoryId, fileIds);
    return { repositoryId, fileIds, symbolIds, parentIds };
  }

  private addFiles(
    files: ScannedArchitectureFile[],
    graph: ArchitectureGraphCollector,
    repositoryId: string,
    fileIds: Map<string, string>,
    symbolIds: Map<IndexedSymbol, string>
  ): void {
    for (const file of files) {
      const fileId = stableId('file', file.path);
      fileIds.set(file.path, fileId);
      graph.addNode(node('file', fileId, path.posix.basename(file.path), file.parsed ? 0.98 : 0.75, {
        bytes: file.size,
        digest: file.digest,
        generated: file.generated,
        binary: file.binary,
        parsed: file.parsed,
        role: roleForFile(file.path)
      }, [{
        file: file.path,
        confidence: file.parsed ? 0.98 : 0.75,
        detail: file.content ? 'bounded static source read' : 'repository metadata only'
      }], file.path, file.language));
      if (!file.content) graph.addEdge('contains', repositoryId, fileId, 0.8, [
        { file: file.path, confidence: 0.8, detail: 'repository file' }
      ]);
      this.addSymbols(file, graph, fileId, symbolIds);
    }
  }

  private addSymbols(
    file: ScannedArchitectureFile,
    graph: ArchitectureGraphCollector,
    fileId: string,
    symbolIds: Map<IndexedSymbol, string>
  ): void {
    for (const symbol of file.symbols) {
      const symbolId = stableId(
        'symbol', symbol.file, symbol.kind, symbol.name,
        String(symbol.line), String(symbol.column || 0)
      );
      symbolIds.set(symbol, symbolId);
      graph.addNode(node('symbol', symbolId, symbol.name, symbol.confidence, {
        symbolKind: symbol.kind,
        parser: symbol.parser,
        line: symbol.line,
        ...(symbol.signature ? { signature: symbol.signature } : {})
      }, [{
        file: symbol.file,
        line: symbol.line,
        column: symbol.column,
        parser: symbol.parser,
        confidence: symbol.confidence,
        detail: `${symbol.kind} declaration`
      }], symbol.file, file.language));
      graph.addEdge('contains', fileId, symbolId, symbol.confidence, [{
        file: symbol.file,
        line: symbol.line,
        parser: symbol.parser,
        confidence: symbol.confidence,
        detail: 'file declares symbol'
      }]);
    }
  }

  private addHierarchy(
    files: ScannedArchitectureFile[],
    graph: ArchitectureGraphCollector,
    repositoryId: string,
    fileIds: Map<string, string>
  ): Map<string, string> {
    const roots = detectProjectRoots(files.map(file => file.path));
    const rootIds = new Map(roots.map(root => [root, graph.addNode(node(
      'project_root', stableId('project_root', root), root, 0.96, {},
      [{ file: root, confidence: 0.96, detail: 'project manifest marker' }], root
    ))]));
    rootIds.forEach((id, root) => graph.addEdge('contains', repositoryId, id, 0.96, [
      { file: root, confidence: 0.96, detail: 'repository project root' }
    ]));
    const moduleIds = new Map<string, string>();
    const parentIds = new Map<string, string>();
    for (const file of files.filter(value => Boolean(value.content))) {
      const root = projectRootForFile(file.path, roots);
      const rootId = rootIds.get(root) || repositoryId;
      const modulePath = modulePathForFile(file.path, root);
      let parentId = rootId;
      if (modulePath) {
        const moduleId = moduleIds.get(modulePath) || graph.addNode(node(
          'module', stableId('module', modulePath), modulePath, 0.82, {},
          [{ file: file.path, confidence: 0.82, detail: 'bounded source-directory grouping' }],
          modulePath
        ));
        moduleIds.set(modulePath, moduleId);
        graph.addEdge('contains', rootId, moduleId, 0.82, [
          { file: file.path, confidence: 0.82, detail: 'project module' }
        ]);
        parentId = moduleId;
      }
      parentIds.set(file.path, parentId);
      graph.addEdge('contains', parentId, fileIds.get(file.path)!, 0.9, [
        { file: file.path, confidence: 0.9, detail: 'structural containment' }
      ]);
    }
    return parentIds;
  }
}

function node(
  kind: ArchitectureNode['kind'], id: string, label: string, confidence: number,
  attributes: ArchitectureNode['attributes'], evidence: ArchitectureNode['evidence'],
  nodePath?: string, language?: string
): ArchitectureNode {
  return {
    id, kind, label, confidence, attributes, evidence,
    ...(nodePath ? { path: nodePath } : {}),
    ...(language ? { language } : {})
  };
}
