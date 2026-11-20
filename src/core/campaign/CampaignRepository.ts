import { randomUUID } from 'crypto';
import { Database } from '../database/Database';
import { Campaign, campaignSchema } from './CampaignTypes';
import { AppError, NotFoundError } from '../../utils/errors';

export class CampaignRepository {
  private ready?: Promise<unknown>;
  constructor(private database: Database) {}
  private initialize() {
    return this.ready ||= this.database.batchQuery([
      { sql: 'CREATE TABLE IF NOT EXISTS tabletop_campaigns (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, version INTEGER NOT NULL, state TEXT NOT NULL, updated_at TEXT NOT NULL, action_id TEXT NOT NULL)' },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_tabletop_owner ON tabletop_campaigns(owner_id, updated_at)' },
      { sql: 'CREATE TABLE IF NOT EXISTS tabletop_events (id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES tabletop_campaigns(id) ON DELETE CASCADE, version INTEGER NOT NULL, kind TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL)' },
    ]);
  }
  async list(ownerId: string) {
    await this.initialize();
    const rows = await this.database.query('SELECT state FROM tabletop_campaigns WHERE owner_id=? ORDER BY updated_at DESC LIMIT 100', [ownerId]);
    return rows.rows.map(r => { const s = campaignSchema.parse(JSON.parse(r.state)); return { id: s.id, name: s.name, edition: s.edition, version: s.version, updatedAt: s.updatedAt }; });
  }
  async get(id: string, ownerId: string): Promise<Campaign> {
    await this.initialize();
    const row = await this.database.query('SELECT state FROM tabletop_campaigns WHERE id=? AND owner_id=?', [id, ownerId]);
    if (!row.rows.length) throw new NotFoundError('Campaign');
    return campaignSchema.parse(JSON.parse(row.rows[0].state));
  }
  async create(state: Campaign): Promise<Campaign> {
    await this.initialize();
    const valid = campaignSchema.parse(state);
    if (Buffer.byteLength(JSON.stringify(valid)) > 2 * 1024 * 1024) throw new AppError('Campaign exceeds the 2 MB save limit. Import a smaller selection.', 400);
    await this.database.query('INSERT INTO tabletop_campaigns(id,owner_id,version,state,updated_at,action_id) VALUES(?,?,?,?,?,?)', [valid.id, valid.ownerId, valid.version, JSON.stringify(valid), valid.updatedAt, randomUUID()]);
    return valid;
  }
  async save(state: Campaign, expectedVersion: number, kind: string, detail: string): Promise<Campaign> {
    await this.initialize();
    const next = campaignSchema.parse({ ...state, version: expectedVersion + 1, updatedAt: new Date().toISOString() });
    const encoded = JSON.stringify(next);
    if (Buffer.byteLength(encoded) > 2 * 1024 * 1024) throw new AppError('Campaign save exceeds 2 MB. Export an archive before adding more material.', 400);
    const actionId = randomUUID();
    const changes = await this.database.batchQuery([
      { sql: 'UPDATE tabletop_campaigns SET state=?,version=?,updated_at=?,action_id=? WHERE id=? AND owner_id=? AND version=?', params: [encoded, next.version, next.updatedAt, actionId, next.id, next.ownerId, expectedVersion] },
      { sql: 'INSERT INTO tabletop_events(id,campaign_id,version,kind,detail,created_at) SELECT ?,id,version,?,?,updated_at FROM tabletop_campaigns WHERE id=? AND owner_id=? AND version=? AND action_id=?', params: [actionId, kind, detail, next.id, next.ownerId, next.version, actionId] },
    ]);
    if (changes[0].rowCount !== 1) throw new AppError('The campaign changed during this turn. Reload and try again.', 409, 'CAMPAIGN_CONFLICT');
    return next;
  }
}
