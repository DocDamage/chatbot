/**
 * Project Memory Durable Store (PX-05 / PX05-T01 & PX05-T07)
 *
 * Provides multi-tenant, project-scoped CRUD and indexing for project memory records.
 */

import { ProjectMemoryRecord, MemoryFreshnessState, MemoryApprovalState } from './ProjectMemorySchema';

export interface MemoryQueryFilter {
  ownerId?: string;
  projectId?: string;
  repositoryId?: string;
  branch?: string;
  kinds?: string[];
  approvalStates?: MemoryApprovalState[];
  freshnessStates?: MemoryFreshnessState[];
  isProtected?: boolean;
  tags?: string[];
  searchQuery?: string;
  includeQuarantined?: boolean;
  limit?: number;
}

export class ProjectMemoryStore {
  private static instance: ProjectMemoryStore;
  private memories = new Map<string, ProjectMemoryRecord>();

  public static getInstance(): ProjectMemoryStore {
    if (!ProjectMemoryStore.instance) {
      ProjectMemoryStore.instance = new ProjectMemoryStore();
    }
    return ProjectMemoryStore.instance;
  }

  public save(record: ProjectMemoryRecord): ProjectMemoryRecord {
    this.memories.set(record.id, {
      ...record,
      updatedAt: new Date().toISOString()
    });
    return this.memories.get(record.id)!;
  }

  public get(id: string, requester: { userId: string; projectId?: string; isAdmin?: boolean }): ProjectMemoryRecord | undefined {
    const record = this.memories.get(id);
    if (!record) return undefined;

    // Tenant / Access Scope verification
    if (!requester.isAdmin) {
      if (record.accessScope === 'user_only' && record.ownerId !== requester.userId) {
        return undefined;
      }
      if (record.accessScope === 'project_shared') {
        if (record.projectId && record.projectId !== requester.projectId && record.ownerId !== requester.userId) {
          return undefined;
        }
      }
    }

    return record;
  }

  public query(filter: MemoryQueryFilter, requester: { userId: string; projectId?: string; isAdmin?: boolean }): ProjectMemoryRecord[] {
    let list = Array.from(this.memories.values());

    // Security & Scope filtering
    if (!requester.isAdmin) {
      list = list.filter(m => {
        if (m.accessScope === 'user_only') return m.ownerId === requester.userId;
        if (m.accessScope === 'project_shared') {
          if (m.projectId && requester.projectId) return m.projectId === requester.projectId || m.ownerId === requester.userId;
          return m.ownerId === requester.userId;
        }
        return true;
      });
    }

    if (filter.projectId) {
      list = list.filter(m => m.projectId === filter.projectId);
    }

    if (filter.repositoryId) {
      list = list.filter(m => m.repositoryId === filter.repositoryId);
    }

    if (filter.branch) {
      list = list.filter(m => m.branch === filter.branch || m.branch === 'main' || m.branch === 'master');
    }

    if (filter.kinds && filter.kinds.length > 0) {
      list = list.filter(m => filter.kinds!.includes(m.kind));
    }

    if (filter.approvalStates && filter.approvalStates.length > 0) {
      list = list.filter(m => filter.approvalStates!.includes(m.approvalState));
    } else {
      // Default: exclude rejected unless asked
      list = list.filter(m => m.approvalState !== 'rejected');
    }

    if (filter.freshnessStates && filter.freshnessStates.length > 0) {
      list = list.filter(m => filter.freshnessStates!.includes(m.freshnessState));
    } else {
      // Default: exclude deleted
      list = list.filter(m => m.freshnessState !== 'deleted');
      if (!filter.includeQuarantined) {
        list = list.filter(m => m.freshnessState !== 'quarantined');
      }
    }

    if (filter.isProtected !== undefined) {
      list = list.filter(m => !!m.isProtected === filter.isProtected);
    }

    if (filter.tags && filter.tags.length > 0) {
      list = list.filter(m => filter.tags!.some(t => m.tags.includes(t)));
    }

    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      list = list.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        m.relatedFiles.some(f => f.toLowerCase().includes(q)) ||
        m.relatedSymbols.some(s => s.toLowerCase().includes(q))
      );
    }

    // Sort by confidence & update date
    list.sort((a, b) => b.confidence - a.confidence || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    if (filter.limit && filter.limit > 0) {
      return list.slice(0, filter.limit);
    }

    return list;
  }

  public delete(id: string, requester: { userId: string; isAdmin?: boolean }): boolean {
    const record = this.memories.get(id);
    if (!record) return false;

    if (!requester.isAdmin && record.ownerId !== requester.userId) {
      throw new Error('Access denied: caller cannot delete this memory');
    }

    // Soft delete: update freshnessState to deleted
    record.freshnessState = 'deleted';
    record.updatedAt = new Date().toISOString();
    return true;
  }

  public hardDelete(id: string): boolean {
    return this.memories.delete(id);
  }

  public clear(): void {
    this.memories.clear();
  }
}
