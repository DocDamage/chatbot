/**
 * Chat Run Repository (CRK-P23-T01, T02, T03)
 *
 * Persists and retrieves structured ChatRunRecords, stage timings, and failure diagnostics.
 * Enforces strict sanitization to ensure no private tokens, user passwords, or internal thoughts leak.
 */

import { ChatRunRecord, chatRunRecordSchema } from '../../types/chat-diagnostics';

export class ChatRunRepository {
  private readonly records = new Map<string, ChatRunRecord>();
  private readonly sessionIndex = new Map<string, Set<string>>();

  public save(record: ChatRunRecord): ChatRunRecord {
    const sanitized = this.sanitize(record);
    const validated = chatRunRecordSchema.parse(sanitized);

    this.records.set(validated.requestId, validated);

    if (!this.sessionIndex.has(validated.sessionId)) {
      this.sessionIndex.set(validated.sessionId, new Set());
    }
    this.sessionIndex.get(validated.sessionId)?.add(validated.requestId);

    return validated;
  }

  public getByRequestId(requestId: string): ChatRunRecord | null {
    const rec = this.records.get(requestId);
    return rec ? this.sanitize(rec) : null;
  }

  public getBySessionId(sessionId: string): ChatRunRecord[] {
    const ids = this.sessionIndex.get(sessionId);
    if (!ids) return [];
    const results: ChatRunRecord[] = [];
    for (const id of ids) {
      const rec = this.records.get(id);
      if (rec) results.push(this.sanitize(rec));
    }
    return results;
  }

  public deleteBySessionId(sessionId: string): number {
    const ids = this.sessionIndex.get(sessionId);
    if (!ids) return 0;
    let count = 0;
    for (const id of ids) {
      if (this.records.delete(id)) count++;
    }
    this.sessionIndex.delete(sessionId);
    return count;
  }

  private sanitize(record: ChatRunRecord): ChatRunRecord {
    // Clone and strip sensitive keys
    const cloned = JSON.parse(JSON.stringify(record)) as ChatRunRecord;

    const sanitizeObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(sanitizeObject);
      const res: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (/secret|token|password|auth|authorization|api_key|reasoning|chain_of_thought/i.test(k)) {
          continue;
        }
        res[k] = sanitizeObject(v);
      }
      return res;
    };

    cloned.contextPlanSummary = sanitizeObject(cloned.contextPlanSummary) || {};
    return cloned;
  }
}
