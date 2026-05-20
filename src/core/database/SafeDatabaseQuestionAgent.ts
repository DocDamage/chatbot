import { Database } from './Database';

export interface SafeDatabaseQuestionResult {
  mode: 'known_question' | 'safe_sql';
  sql?: string;
  answer: string;
  rows: any[];
  warnings: string[];
}

export interface SafeSchemaSummary {
  tables: Array<{ name: string; purpose: string }>;
}

export class SafeDatabaseQuestionAgent {
  private readonly allowedTables = new Set([
    'knowledge_sources',
    'document_chunks',
    'chunk_embeddings',
    'source_citations',
    'ingestion_runs',
    'knowledge_graph_nodes',
    'knowledge_graph_edges',
    'governance_evidence_reports'
  ]);

  constructor(private readonly database?: Database) {}

  async ask(question: string): Promise<SafeDatabaseQuestionResult> {
    if (!this.database) {
      throw new Error('Database is not initialized');
    }

    const text = question.toLowerCase();
    if (/\b(how many|count|total)\b/.test(text) && /\b(chunks|documents|sources|embeddings|memories)\b/.test(text)) {
      return this.answerCounts(text);
    }

    if (/\b(search|find|look up)\b/.test(text) && /\b(knowledge|chunks|documents|database)\b/.test(text)) {
      const query = question.replace(/\b(search|find|look up|knowledge|chunks|documents|database|for|in|the)\b/gi, ' ').trim();
      return this.searchKnowledge(query || question);
    }

    return {
      mode: 'known_question',
      answer: 'I can safely answer database questions about knowledge counts, memory counts, and knowledge chunk search. Ask something like "how many chunks are in the database?" or "search knowledge for FL Studio mixer".',
      rows: [],
      warnings: ['No safe deterministic database intent matched.']
    };
  }

  async queryReadOnly(sql: string, params: any[] = []): Promise<SafeDatabaseQuestionResult> {
    if (!this.database) {
      throw new Error('Database is not initialized');
    }
    const validation = this.validateReadOnlySql(sql);
    if (!validation.valid) {
      return {
        mode: 'safe_sql',
        sql,
        answer: 'Blocked unsafe SQL. Only a single read-only SELECT statement is allowed.',
        rows: [],
        warnings: validation.warnings
      };
    }

    const limitedSql = /\blimit\b/i.test(sql) ? sql : `${sql.trim().replace(/;$/, '')} LIMIT 100`;
    const result = await this.database.query(limitedSql, params);
    return {
      mode: 'safe_sql',
      sql: limitedSql,
      answer: `Returned ${result.rows.length} row${result.rows.length === 1 ? '' : 's'}.`,
      rows: result.rows,
      warnings: []
    };
  }

  schemaSummary(): SafeSchemaSummary {
    return {
      tables: Array.from(this.allowedTables).sort().map(name => ({
        name,
        purpose: this.tablePurpose(name)
      }))
    };
  }

  validateReadOnlySql(sql: string): { valid: boolean; warnings: string[] } {
    const trimmed = sql.trim();
    const warnings: string[] = [];
    if (!/^select\b/i.test(trimmed)) warnings.push('SQL must start with SELECT.');
    if (trimmed.split(';').filter(part => part.trim()).length > 1) warnings.push('Multiple SQL statements are not allowed.');
    if (/\b(insert|update|delete|drop|alter|create|truncate|attach|detach|pragma|copy|grant|revoke|vacuum)\b/i.test(trimmed)) {
      warnings.push('Mutation, DDL, admin, and bulk commands are blocked.');
    }
    if (/--|\/\*/.test(trimmed)) warnings.push('SQL comments are blocked.');
    for (const table of this.extractReferencedTables(trimmed)) {
      if (!this.allowedTables.has(table)) {
        warnings.push(`Table is not allowlisted for safe SQL: ${table}.`);
      }
    }
    return { valid: warnings.length === 0, warnings };
  }

  private extractReferencedTables(sql: string): string[] {
    const tables = new Set<string>();
    const tableRegex = /\b(?:from|join)\s+["`]?([a-zA-Z_][a-zA-Z0-9_]*)["`]?/gi;
    let match: RegExpExecArray | null;
    while ((match = tableRegex.exec(sql)) !== null) {
      tables.add(match[1]);
    }
    return Array.from(tables);
  }

  private tablePurpose(table: string): string {
    const purposes: Record<string, string> = {
      knowledge_sources: 'Registered knowledge source files, URLs, and imports.',
      document_chunks: 'Searchable RAG chunks and chunk metadata.',
      chunk_embeddings: 'Persisted embeddings for document chunks.',
      source_citations: 'Citation records connected to chunks and sources.',
      ingestion_runs: 'Knowledge ingestion job history.',
      knowledge_graph_nodes: 'Persisted knowledge graph nodes.',
      knowledge_graph_edges: 'Persisted relationships between graph nodes.',
      governance_evidence_reports: 'Answer evidence and golden-task verification reports.'
    };
    return purposes[table] || 'Allowlisted knowledge system table.';
  }

  private async answerCounts(text: string): Promise<SafeDatabaseQuestionResult> {
    const tables = [
      ['sources', 'knowledge_sources'],
      ['chunks', 'document_chunks'],
      ['documents', 'document_chunks'],
      ['embeddings', 'chunk_embeddings'],
      ['memories', 'private_memories']
    ].filter(([label]) => text.includes(label));

    const selected = tables.length > 0 ? tables : [['chunks', 'document_chunks']];
    const rows: Array<{ label: string; count: number }> = [];
    for (const [label, table] of selected) {
      try {
        const result = await this.database!.query(`SELECT COUNT(*) AS count FROM ${table}`);
        rows.push({ label, count: Number(result.rows[0]?.count || 0) });
      } catch {
        rows.push({ label, count: 0 });
      }
    }

    return {
      mode: 'known_question',
      answer: rows.map(row => `${row.label}: ${row.count}`).join('\n'),
      rows,
      warnings: []
    };
  }

  private async searchKnowledge(query: string): Promise<SafeDatabaseQuestionResult> {
    const like = `%${query.replace(/[%_]/g, '')}%`;
    const result = this.database!.getType() === 'postgresql'
      ? await this.database!.query(
          `SELECT id, content, metadata FROM document_chunks WHERE content ILIKE $1 LIMIT 10`,
          [like]
        )
      : await this.database!.query(
          `SELECT id, content, metadata FROM document_chunks WHERE content LIKE ? LIMIT 10`,
          [like]
        );

    return {
      mode: 'known_question',
      answer: result.rows.length
        ? `Found ${result.rows.length} matching knowledge chunk${result.rows.length === 1 ? '' : 's'}.`
        : 'No matching knowledge chunks found.',
      rows: result.rows,
      warnings: []
    };
  }
}
