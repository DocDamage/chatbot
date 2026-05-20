import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { RAGDocumentStore } from '../rag/RAGDocumentStore';
import { EntityLinkingService, LinkedEntity } from '../entity/EntityLinkingService';
import { CodeIndexer } from '../agents/CodeIndexer';
import { Database } from '../database/Database';

export type KnowledgeGraphNodeType = 'file' | 'chunk' | 'symbol' | 'entity' | 'source';
export type KnowledgeGraphEdgeType = 'contains' | 'mentions' | 'imports' | 'defines' | 'from_source' | 'related_to';

export interface KnowledgeGraphNode {
  id: string;
  type: KnowledgeGraphNodeType;
  label: string;
  metadata: Record<string, any>;
}

export interface KnowledgeGraphEdge {
  id: string;
  from: string;
  to: string;
  type: KnowledgeGraphEdgeType;
  weight: number;
  metadata: Record<string, any>;
}

export interface KnowledgeGraphIndex {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  centrality: Array<{ nodeId: string; label: string; type: KnowledgeGraphNodeType; degree: number }>;
  stats: {
    nodes: number;
    edges: number;
    files: number;
    chunks: number;
    entities: number;
  };
}

export class KnowledgeGraphIndexer {
  private readonly entityLinker = new EntityLinkingService();
  private readonly ignoredDirectories = new Set([
    '.git',
    '.next',
    '.vite',
    'cache',
    'coverage',
    'data',
    'dist',
    'node_modules',
    'logs',
    'tmp'
  ]);

  constructor(
    private readonly options: {
      workspaceRoot?: string;
      ragDocumentStore?: RAGDocumentStore;
      database?: Database;
      maxFiles?: number;
    } = {}
  ) {}

  async build(options: { includeRepo?: boolean; includeRag?: boolean; query?: string; maxFiles?: number; maxChunks?: number } = {}): Promise<KnowledgeGraphIndex> {
    const nodes = new Map<string, KnowledgeGraphNode>();
    const edges = new Map<string, KnowledgeGraphEdge>();

    if (options.includeRepo !== false) {
      this.indexRepo(nodes, edges, options.maxFiles);
    }

    if (options.includeRag !== false && this.options.ragDocumentStore) {
      await this.indexRag(nodes, edges, options.query, options.maxChunks);
    }

    const nodeList = Array.from(nodes.values());
    const edgeList = Array.from(edges.values());
    const centrality = this.centrality(nodeList, edgeList);
    return {
      nodes: nodeList,
      edges: edgeList,
      centrality,
      stats: {
        nodes: nodeList.length,
        edges: edgeList.length,
        files: nodeList.filter(node => node.type === 'file').length,
        chunks: nodeList.filter(node => node.type === 'chunk').length,
        entities: nodeList.filter(node => node.type === 'entity').length
      }
    };
  }

  async persist(index: KnowledgeGraphIndex): Promise<{ nodes: number; edges: number }> {
    if (!this.options.database) {
      return { nodes: 0, edges: 0 };
    }

    for (const node of index.nodes) {
      if (this.options.database.getType() === 'postgresql') {
        await this.options.database.query(
          `INSERT INTO knowledge_graph_nodes (id, node_type, label, metadata, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT (id) DO UPDATE SET
             node_type = EXCLUDED.node_type,
             label = EXCLUDED.label,
             metadata = EXCLUDED.metadata,
             updated_at = CURRENT_TIMESTAMP`,
          [node.id, node.type, node.label, JSON.stringify(node.metadata)]
        );
      } else {
        await this.options.database.query(
          `INSERT OR REPLACE INTO knowledge_graph_nodes (id, node_type, label, metadata, updated_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [node.id, node.type, node.label, JSON.stringify(node.metadata)]
        );
      }
    }

    for (const edge of index.edges) {
      if (this.options.database.getType() === 'postgresql') {
        await this.options.database.query(
          `INSERT INTO knowledge_graph_edges (id, from_node_id, to_node_id, edge_type, weight, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             from_node_id = EXCLUDED.from_node_id,
             to_node_id = EXCLUDED.to_node_id,
             edge_type = EXCLUDED.edge_type,
             weight = EXCLUDED.weight,
             metadata = EXCLUDED.metadata`,
          [edge.id, edge.from, edge.to, edge.type, edge.weight, JSON.stringify(edge.metadata)]
        );
      } else {
        await this.options.database.query(
          `INSERT OR REPLACE INTO knowledge_graph_edges (id, from_node_id, to_node_id, edge_type, weight, metadata)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [edge.id, edge.from, edge.to, edge.type, edge.weight, JSON.stringify(edge.metadata)]
        );
      }
    }

    return { nodes: index.nodes.length, edges: index.edges.length };
  }

  private centrality(nodes: KnowledgeGraphNode[], edges: KnowledgeGraphEdge[]): KnowledgeGraphIndex['centrality'] {
    const degree = new Map<string, number>();
    for (const edge of edges) {
      degree.set(edge.from, (degree.get(edge.from) || 0) + 1);
      degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
    }
    const nodesById = new Map(nodes.map(node => [node.id, node]));
    return Array.from(degree.entries())
      .map(([nodeId, value]) => {
        const node = nodesById.get(nodeId);
        return node ? { nodeId, label: node.label, type: node.type, degree: value } : undefined;
      })
      .filter((entry): entry is NonNullable<typeof entry> => !!entry)
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 25);
  }

  async stats(): Promise<{ nodes: number; edges: number }> {
    if (!this.options.database) {
      return { nodes: 0, edges: 0 };
    }
    const [nodes, edges] = await Promise.all([
      this.options.database.query('SELECT COUNT(*) AS count FROM knowledge_graph_nodes'),
      this.options.database.query('SELECT COUNT(*) AS count FROM knowledge_graph_edges')
    ]);
    return {
      nodes: Number(nodes.rows[0]?.count || 0),
      edges: Number(edges.rows[0]?.count || 0)
    };
  }

  private indexRepo(nodes: Map<string, KnowledgeGraphNode>, edges: Map<string, KnowledgeGraphEdge>, maxFiles?: number): void {
    const root = this.options.workspaceRoot || process.cwd();
    const files = this.walk(root)
      .filter(file => /\.(ts|tsx|js|jsx|md|json)$/.test(file))
      .filter(file => !file.includes(`${path.sep}node_modules${path.sep}`) && !file.includes(`${path.sep}dist${path.sep}`))
      .filter(file => this.isReasonableFile(file))
      .slice(0, maxFiles || this.options.maxFiles || 250);
    const codeIndexer = new CodeIndexer(root);

    for (const file of files) {
      const relative = path.relative(root, file).replace(/\\/g, '/');
      const fileNode = this.node('file', relative, relative, { path: relative });
      nodes.set(fileNode.id, fileNode);

      if (/\.(ts|tsx|js|jsx)$/.test(file)) {
        for (const symbol of codeIndexer.getFileSymbols(relative)) {
          const symbolNode = this.node('symbol', `${symbol.kind}:${symbol.name}:${relative}:${symbol.line}`, symbol.name, symbol);
          nodes.set(symbolNode.id, symbolNode);
          this.addEdge(edges, fileNode.id, symbolNode.id, symbol.kind === 'import' ? 'imports' : 'defines', 1, { line: symbol.line });
        }
      }

      if (/\.(md|json)$/.test(file)) {
        const content = this.safeRead(file, 8000);
        this.linkEntities(content, fileNode.id, nodes, edges);
      }
    }
  }

  private async indexRag(
    nodes: Map<string, KnowledgeGraphNode>,
    edges: Map<string, KnowledgeGraphEdge>,
    query?: string,
    maxChunks?: number
  ): Promise<void> {
    if (!this.options.ragDocumentStore) return;
    const chunks = query
      ? (await this.options.ragDocumentStore.searchKeyword(query, 50)).map(result => result.chunk)
      : await this.options.ragDocumentStore.loadChunks();

    for (const chunk of chunks.slice(0, maxChunks || 500)) {
      const source = chunk.metadata.source || 'unknown';
      const sourceNode = this.node('source', source, source, { source });
      const chunkNode = this.node('chunk', chunk.id, chunk.metadata.title || chunk.id, {
        source,
        title: chunk.metadata.title,
        chunkId: chunk.id
      });
      nodes.set(sourceNode.id, sourceNode);
      nodes.set(chunkNode.id, chunkNode);
      this.addEdge(edges, sourceNode.id, chunkNode.id, 'contains', 1, {});
      this.linkEntities(chunk.content, chunkNode.id, nodes, edges);
    }
  }

  private linkEntities(
    content: string,
    ownerNodeId: string,
    nodes: Map<string, KnowledgeGraphNode>,
    edges: Map<string, KnowledgeGraphEdge>
  ): void {
    const linked = this.entityLinker.link(content);
    for (const entity of linked.entities.slice(0, 40)) {
      const entityNode = this.entityNode(entity);
      nodes.set(entityNode.id, entityNode);
      this.addEdge(edges, ownerNodeId, entityNode.id, 'mentions', entity.confidence, {
        label: entity.label,
        type: entity.type
      });
    }
  }

  private entityNode(entity: LinkedEntity): KnowledgeGraphNode {
    return {
      id: entity.id,
      type: 'entity',
      label: entity.label,
      metadata: {
        normalized: entity.normalized,
        entityType: entity.type,
        confidence: entity.confidence,
        aliases: entity.aliases
      }
    };
  }

  private walk(root: string): string[] {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        if (this.ignoredDirectories.has(entry.name)) continue;
        files.push(...this.walk(entryPath));
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
    return files;
  }

  private isReasonableFile(filePath: string): boolean {
    try {
      const stats = fs.statSync(filePath);
      return stats.size <= 512 * 1024;
    } catch {
      return false;
    }
  }

  private safeRead(filePath: string, maxChars: number): string {
    try {
      return fs.readFileSync(filePath, 'utf8').slice(0, maxChars);
    } catch {
      return '';
    }
  }

  private node(type: KnowledgeGraphNodeType, key: string, label: string, metadata: Record<string, any>): KnowledgeGraphNode {
    return {
      id: `${type}_${this.hash(key)}`,
      type,
      label,
      metadata
    };
  }

  private addEdge(
    edges: Map<string, KnowledgeGraphEdge>,
    from: string,
    to: string,
    type: KnowledgeGraphEdgeType,
    weight: number,
    metadata: Record<string, any>
  ): void {
    const id = `${type}_${this.hash(`${from}:${to}:${type}`)}`;
    edges.set(id, { id, from, to, type, weight, metadata });
  }

  private hash(value: string): string {
    return createHash('sha1').update(value).digest('hex').slice(0, 16);
  }
}
