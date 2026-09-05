/**
 * Side-Effect Ledger for Mutating Tools (CRK-P18-T02)
 *
 * Implements an auditable ledger recording all mutating tool operations (§3013-3025):
 * - Actor, authorization/approval ID, input hash, exact target
 * - Status ('pending' | 'applied' | 'failed' | 'rolled_back')
 * - Changed resource paths/IDs
 * - Rollback/repair snapshot metadata
 * - Verification status & evidence
 *
 * Strictly adheres to the < 300 lines per file rule (§494).
 */

import {
  SideEffectLedgerEntry,
  sideEffectLedgerEntrySchema,
  ToolVerificationRef,
} from '../../types/tool-truth';

export interface RecordIntentParams {
  sessionId: string;
  toolCallId: string;
  actor: string;
  authorizationId: string;
  inputHash: string;
  exactTarget: string;
  rollbackInfo?: SideEffectLedgerEntry['rollbackInfo'];
}

export class SideEffectLedger {
  private static instance?: SideEffectLedger;
  private readonly entries = new Map<string, SideEffectLedgerEntry>();
  private readonly sessionIndex = new Map<string, Set<string>>();

  public static getInstance(): SideEffectLedger {
    if (!this.instance) {
      this.instance = new SideEffectLedger();
    }
    return this.instance;
  }

  public static resetInstance(): void {
    this.instance = undefined;
  }

  /**
   * Records intention to execute a mutating action before execution commences.
   */
  public recordIntent(params: RecordIntentParams): SideEffectLedgerEntry {
    const ledgerId = `ledg_${params.toolCallId}_${Date.now()}`;
    const now = new Date().toISOString();

    const entry: SideEffectLedgerEntry = {
      ledgerId,
      sessionId: params.sessionId,
      toolCallId: params.toolCallId,
      actor: params.actor,
      authorizationId: params.authorizationId,
      inputHash: params.inputHash,
      exactTarget: params.exactTarget,
      status: 'pending',
      changedResources: [],
      rollbackInfo: params.rollbackInfo,
      verification: { status: 'unverified', evidence: [] },
      createdAt: now,
      updatedAt: now,
    };

    sideEffectLedgerEntrySchema.parse(entry);
    this.entries.set(ledgerId, entry);

    let sessionSet = this.sessionIndex.get(params.sessionId);
    if (!sessionSet) {
      sessionSet = new Set<string>();
      this.sessionIndex.set(params.sessionId, sessionSet);
    }
    sessionSet.add(ledgerId);

    return entry;
  }

  /**
   * Marks a mutating action as successfully applied with its changed resources.
   */
  public recordApplied(
    ledgerId: string,
    changedResources: string[],
    rollbackInfo?: SideEffectLedgerEntry['rollbackInfo']
  ): SideEffectLedgerEntry {
    const entry = this.getRequiredEntry(ledgerId);
    entry.status = 'applied';
    entry.changedResources = changedResources;
    if (rollbackInfo) {
      entry.rollbackInfo = rollbackInfo;
    }
    entry.updatedAt = new Date().toISOString();
    return entry;
  }

  /**
   * Records verification results (verified, unverified, failed) for a mutating action.
   */
  public recordVerification(
    ledgerId: string,
    verification: ToolVerificationRef
  ): SideEffectLedgerEntry {
    const entry = this.getRequiredEntry(ledgerId);
    entry.verification = verification;
    entry.updatedAt = new Date().toISOString();
    return entry;
  }

  /**
   * Marks a mutating action as failed.
   */
  public recordFailure(ledgerId: string): SideEffectLedgerEntry {
    const entry = this.getRequiredEntry(ledgerId);
    entry.status = 'failed';
    entry.updatedAt = new Date().toISOString();
    return entry;
  }

  /**
   * Marks a mutating action as rolled back.
   */
  public recordRollback(ledgerId: string): SideEffectLedgerEntry {
    const entry = this.getRequiredEntry(ledgerId);
    entry.status = 'rolled_back';
    entry.updatedAt = new Date().toISOString();
    return entry;
  }

  /**
   * Retrieves all ledger entries for a given session.
   */
  public getEntriesForSession(sessionId: string): SideEffectLedgerEntry[] {
    const ids = this.sessionIndex.get(sessionId);
    if (!ids) return [];
    const result: SideEffectLedgerEntry[] = [];
    for (const id of ids) {
      const e = this.entries.get(id);
      if (e) result.push({ ...e });
    }
    return result;
  }

  /**
   * Retrieves an individual entry by ledgerId.
   */
  public getEntry(ledgerId: string): SideEffectLedgerEntry | undefined {
    const e = this.entries.get(ledgerId);
    return e ? { ...e } : undefined;
  }

  /**
   * Exports full audit log for a session or entire system.
   */
  public exportAuditLog(sessionId?: string): SideEffectLedgerEntry[] {
    if (sessionId) {
      return this.getEntriesForSession(sessionId);
    }
    return Array.from(this.entries.values()).map((e) => ({ ...e }));
  }

  private getRequiredEntry(ledgerId: string): SideEffectLedgerEntry {
    const entry = this.entries.get(ledgerId);
    if (!entry) {
      throw new Error(`[SideEffectLedger] Entry "${ledgerId}" not found.`);
    }
    return entry;
  }
}
