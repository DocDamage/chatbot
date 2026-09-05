/**
 * Memory Capture & Proposal Pipeline (PX-05 / PX05-T02)
 *
 * Ingests knowledge from explicit user commands, completed task handoffs,
 * ADRs, PR reviews, and failure-fix pairs into proposed memory candidates.
 */

import { createHash } from 'crypto';
import { ProjectMemoryRecord, MemoryKind, MemoryCaptureMethod, MemorySourceEvidence } from './ProjectMemorySchema';
import { ProjectMemoryStore } from './ProjectMemoryStore';

export class MemoryCaptureService {
  constructor(private readonly store: ProjectMemoryStore) {}

  /**
   * Capture an explicit user memory proposal.
   */
  public captureUserMemory(params: {
    ownerId: string;
    projectId?: string;
    repositoryId?: string;
    branch?: string;
    commitHash?: string;
    kind: MemoryKind;
    title: string;
    content: string;
    tags?: string[];
    relatedFiles?: string[];
    relatedSymbols?: string[];
    isProtected?: boolean;
    autoApprove?: boolean;
  }): ProjectMemoryRecord {
    const memoryId = `mem_${createHash('sha256').update(`${params.ownerId}:${params.title}:${Date.now()}`).digest('hex').slice(0, 16)}`;

    const record: ProjectMemoryRecord = {
      id: memoryId,
      ownerId: params.ownerId,
      projectId: params.projectId,
      repositoryId: params.repositoryId,
      branch: params.branch || 'main',
      originatingCommit: params.commitHash || 'HEAD',
      kind: params.kind,
      title: params.title,
      content: params.content,
      evidence: [],
      relatedFiles: params.relatedFiles || [],
      relatedSymbols: params.relatedSymbols || [],
      confidence: 1.0, // Explicit user captures have maximum confidence
      captureMethod: 'explicit_user',
      approvalState: params.autoApprove ? 'approved' : 'proposed',
      freshnessState: 'current',
      isProtected: params.isProtected,
      retentionClass: 'permanent',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authorId: params.ownerId,
      accessScope: 'project_shared',
      tags: params.tags || []
    };

    return this.store.save(record);
  }

  /**
   * Ingest and propose memory from a completed task handoff document.
   */
  public ingestTaskHandoff(params: {
    ownerId: string;
    projectId?: string;
    taskId: string;
    taskTitle: string;
    branch: string;
    commitHash: string;
    summary: string;
    decisions: string[];
    gotchas: string[];
    changedFiles: string[];
  }): ProjectMemoryRecord[] {
    const records: ProjectMemoryRecord[] = [];

    // Capture key decisions
    for (let i = 0; i < params.decisions.length; i++) {
      const decision = params.decisions[i];
      const id = `mem_dec_${params.taskId}_${i}`;
      const record: ProjectMemoryRecord = {
        id,
        ownerId: params.ownerId,
        projectId: params.projectId,
        branch: params.branch,
        originatingCommit: params.commitHash,
        kind: 'decision',
        title: `Decision from ${params.taskId}: ${params.taskTitle}`,
        content: decision,
        evidence: [{ commitHash: params.commitHash, filePath: params.changedFiles[0] }],
        relatedFiles: params.changedFiles,
        relatedSymbols: [],
        confidence: 0.9,
        captureMethod: 'task_handoff',
        approvalState: 'approved', // Handoffs from completed verified tasks are approved
        freshnessState: 'current',
        retentionClass: 'permanent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        authorId: params.ownerId,
        accessScope: 'project_shared',
        tags: [params.taskId, 'decision', 'handoff']
      };
      records.push(this.store.save(record));
    }

    // Capture gotchas
    for (let i = 0; i < params.gotchas.length; i++) {
      const gotcha = params.gotchas[i];
      const id = `mem_got_${params.taskId}_${i}`;
      const record: ProjectMemoryRecord = {
        id,
        ownerId: params.ownerId,
        projectId: params.projectId,
        branch: params.branch,
        originatingCommit: params.commitHash,
        kind: 'gotcha',
        title: `Gotcha in ${params.taskId}: ${gotcha.slice(0, 40)}...`,
        content: gotcha,
        evidence: [{ commitHash: params.commitHash }],
        relatedFiles: params.changedFiles,
        relatedSymbols: [],
        confidence: 0.85,
        captureMethod: 'task_handoff',
        approvalState: 'approved',
        freshnessState: 'current',
        retentionClass: 'permanent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        authorId: params.ownerId,
        accessScope: 'project_shared',
        tags: [params.taskId, 'gotcha']
      };
      records.push(this.store.save(record));
    }

    return records;
  }

  /**
   * Mine a failure-fix occurrence into a proposed memory.
   */
  public mineFailureFix(params: {
    ownerId: string;
    projectId?: string;
    branch: string;
    commitHash: string;
    failureDescription: string;
    fixResolution: string;
    affectedFile: string;
  }): ProjectMemoryRecord {
    const id = `mem_fix_${createHash('sha256').update(params.failureDescription).digest('hex').slice(0, 16)}`;
    const record: ProjectMemoryRecord = {
      id,
      ownerId: params.ownerId,
      projectId: params.projectId,
      branch: params.branch,
      originatingCommit: params.commitHash,
      kind: 'fix',
      title: `Fix for: ${params.failureDescription.slice(0, 50)}`,
      content: `Failure: ${params.failureDescription}\n\nFix applied: ${params.fixResolution}`,
      evidence: [{ filePath: params.affectedFile, commitHash: params.commitHash }],
      relatedFiles: [params.affectedFile],
      relatedSymbols: [],
      confidence: 0.8,
      captureMethod: 'failure_fix_mined',
      approvalState: 'proposed', // Automated failure mining produces proposal
      freshnessState: 'current',
      retentionClass: 'permanent',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authorId: params.ownerId,
      accessScope: 'project_shared',
      tags: ['failure-fix', 'mined']
    };

    return this.store.save(record);
  }
}
