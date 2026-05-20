import { randomUUID } from 'crypto';
import { Database } from '../database/Database';

export type MemoryVisibility = 'private' | 'shared';
export type MemoryStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface PrivateMemory {
  id: string;
  userId: string;
  content: string;
  tags: string[];
  confidence: number;
  importance: number;
  visibility: MemoryVisibility;
  status: MemoryStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export class PrivateMemoryStore {
  constructor(private readonly database?: Database) {}

  async remember(input: {
    userId?: string;
    content: string;
    tags?: string[];
    confidence?: number;
    importance?: number;
    visibility?: MemoryVisibility;
    requiresApproval?: boolean;
    expiresAt?: string;
  }): Promise<PrivateMemory> {
    if (!this.database) {
      throw new Error('Database is required for private memory');
    }

    const now = new Date().toISOString();
    const memory: PrivateMemory = {
      id: randomUUID(),
      userId: input.userId || 'local',
      content: input.content,
      tags: input.tags || [],
      confidence: this.clamp(input.confidence ?? 0.72),
      importance: this.clamp(input.importance ?? 0.5),
      visibility: input.visibility || 'private',
      status: input.requiresApproval ? 'pending' : 'approved',
      createdAt: now,
      updatedAt: now,
      expiresAt: input.expiresAt
    };

    const params = [
      memory.id,
      memory.userId,
      memory.content,
      JSON.stringify(memory.tags),
      memory.confidence,
      memory.importance,
      memory.visibility,
      memory.status,
      memory.expiresAt || null
    ];

    if (this.database.getType() === 'postgresql') {
      await this.database.query(
        `INSERT INTO private_memories (id, user_id, content, tags, confidence, importance, visibility, status, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        params
      );
    } else {
      await this.database.query(
        `INSERT INTO private_memories (id, user_id, content, tags, confidence, importance, visibility, status, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params
      );
    }

    return memory;
  }

  async recall(query: string, options: { userId?: string; limit?: number; includePending?: boolean } = {}): Promise<PrivateMemory[]> {
    if (!this.database) {
      throw new Error('Database is required for private memory');
    }

    const userId = options.userId || 'local';
    const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const result = this.database.getType() === 'postgresql'
      ? await this.database.query(
          `SELECT * FROM private_memories
           WHERE user_id = $1 AND ($2 = true OR status = 'approved')
           ORDER BY importance DESC, confidence DESC, updated_at DESC
           LIMIT $3`,
          [userId, options.includePending === true, Math.max(options.limit || 10, 1)]
        )
      : await this.database.query(
          `SELECT * FROM private_memories
           WHERE user_id = ? AND (? = 1 OR status = 'approved')
           ORDER BY importance DESC, confidence DESC, updated_at DESC
           LIMIT ?`,
          [userId, options.includePending === true ? 1 : 0, Math.max(options.limit || 10, 1)]
        );

    return result.rows
      .map(row => this.rowToMemory(row))
      .map(memory => ({
        memory,
        score: tokens.length === 0 ? 1 : tokens.filter(token => `${memory.content} ${memory.tags.join(' ')}`.toLowerCase().includes(token)).length
      }))
      .filter(result => tokens.length === 0 || result.score > 0)
      .sort((a, b) => b.score - a.score || b.memory.importance - a.memory.importance)
      .map(result => result.memory);
  }

  async approve(id: string, status: Extract<MemoryStatus, 'approved' | 'rejected'>): Promise<void> {
    if (!this.database) {
      throw new Error('Database is required for private memory');
    }
    if (this.database.getType() === 'postgresql') {
      await this.database.query('UPDATE private_memories SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, id]);
    } else {
      await this.database.query('UPDATE private_memories SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
    }
  }

  async get(id: string): Promise<PrivateMemory | undefined> {
    if (!this.database) {
      throw new Error('Database is required for private memory');
    }
    const result = this.database.getType() === 'postgresql'
      ? await this.database.query('SELECT * FROM private_memories WHERE id = $1', [id])
      : await this.database.query('SELECT * FROM private_memories WHERE id = ?', [id]);
    return result.rows[0] ? this.rowToMemory(result.rows[0]) : undefined;
  }

  async stats(userId: string = 'local'): Promise<{ total: number; approved: number; pending: number }> {
    if (!this.database) {
      return { total: 0, approved: 0, pending: 0 };
    }
    const result = this.database.getType() === 'postgresql'
      ? await this.database.query(
          `SELECT COUNT(*) AS total,
                  SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
                  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
           FROM private_memories WHERE user_id = $1`,
          [userId]
        )
      : await this.database.query(
          `SELECT COUNT(*) AS total,
                  SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
                  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
           FROM private_memories WHERE user_id = ?`,
          [userId]
        );
    return {
      total: Number(result.rows[0]?.total || 0),
      approved: Number(result.rows[0]?.approved || 0),
      pending: Number(result.rows[0]?.pending || 0)
    };
  }

  private rowToMemory(row: any): PrivateMemory {
    return {
      id: row.id,
      userId: row.user_id,
      content: row.content,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags || '[]') : row.tags || [],
      confidence: Number(row.confidence || 0),
      importance: Number(row.importance || 0),
      visibility: row.visibility,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at || undefined
    };
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
