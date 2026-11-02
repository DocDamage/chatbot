/**
 * Memory Management & Human Governance Service (PX-05 / PX05-T08)
 *
 * Provides human controls over memory lifecycle:
 * - Proposal approval and rejection
 * - Locking / Pinning (protection)
 * - Editing content with revision timestamps
 * - Quarantining and restoring memories
 * - Explicit supersession chaining
 */

import { ProjectMemoryStore } from './ProjectMemoryStore';
import { ProjectMemoryRecord } from './ProjectMemorySchema';

export class MemoryManagementService {
  constructor(private readonly store: ProjectMemoryStore) {}

  public approveProposal(memoryId: string, approver: { userId: string; isAdmin?: boolean }): ProjectMemoryRecord {
    const memory = this.store.get(memoryId, approver);
    if (!memory) {
      throw new Error(`Memory record '${memoryId}' not found or access denied`);
    }

    memory.approvalState = 'approved';
    memory.updatedAt = new Date().toISOString();
    return this.store.save(memory);
  }

  public rejectProposal(memoryId: string, approver: { userId: string; isAdmin?: boolean }): ProjectMemoryRecord {
    const memory = this.store.get(memoryId, approver);
    if (!memory) {
      throw new Error(`Memory record '${memoryId}' not found or access denied`);
    }

    memory.approvalState = 'rejected';
    memory.updatedAt = new Date().toISOString();
    return this.store.save(memory);
  }

  public setProtected(memoryId: string, isProtected: boolean, requester: { userId: string; isAdmin?: boolean }): ProjectMemoryRecord {
    const memory = this.store.get(memoryId, requester);
    if (!memory) {
      throw new Error(`Memory record '${memoryId}' not found or access denied`);
    }

    memory.isProtected = isProtected;
    memory.updatedAt = new Date().toISOString();
    return this.store.save(memory);
  }

  public editMemory(memoryId: string, updates: { title?: string; content?: string; tags?: string[] }, requester: { userId: string; isAdmin?: boolean }): ProjectMemoryRecord {
    const memory = this.store.get(memoryId, requester);
    if (!memory) {
      throw new Error(`Memory record '${memoryId}' not found or access denied`);
    }

    if (updates.title !== undefined) memory.title = updates.title;
    if (updates.content !== undefined) memory.content = updates.content;
    if (updates.tags !== undefined) memory.tags = updates.tags;

    memory.updatedAt = new Date().toISOString();
    return this.store.save(memory);
  }

  public quarantineMemory(memoryId: string, requester: { userId: string; isAdmin?: boolean }): ProjectMemoryRecord {
    const memory = this.store.get(memoryId, requester);
    if (!memory) {
      throw new Error(`Memory record '${memoryId}' not found or access denied`);
    }

    memory.freshnessState = 'quarantined';
    memory.updatedAt = new Date().toISOString();
    return this.store.save(memory);
  }

  public restoreMemory(memoryId: string, requester: { userId: string; isAdmin?: boolean }): ProjectMemoryRecord {
    const memory = this.store.get(memoryId, requester);
    if (!memory) {
      throw new Error(`Memory record '${memoryId}' not found or access denied`);
    }

    memory.freshnessState = 'current';
    memory.updatedAt = new Date().toISOString();
    return this.store.save(memory);
  }

  public supersedeMemory(oldMemoryId: string, newMemoryId: string, requester: { userId: string; isAdmin?: boolean }): { oldRecord: ProjectMemoryRecord; newRecord: ProjectMemoryRecord } {
    const oldMem = this.store.get(oldMemoryId, requester);
    const newMem = this.store.get(newMemoryId, requester);

    if (!oldMem || !newMem) {
      throw new Error('Both old and new memory records must exist and be accessible');
    }

    oldMem.freshnessState = 'superseded';
    oldMem.supersededBy = newMem.id;
    oldMem.updatedAt = new Date().toISOString();

    const supersedesList = newMem.supersedes || [];
    if (!supersedesList.includes(oldMem.id)) {
      supersedesList.push(oldMem.id);
    }
    newMem.supersedes = supersedesList;
    newMem.updatedAt = new Date().toISOString();

    this.store.save(oldMem);
    this.store.save(newMem);

    return { oldRecord: oldMem, newRecord: newMem };
  }
}
