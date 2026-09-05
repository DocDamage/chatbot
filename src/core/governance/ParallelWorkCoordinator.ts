/**
 * Section 40: Parallel Work Rules & Lane Concurrency Coordinator
 * Governs multi-lane concurrency, branch isolation, and file-conflict prevention.
 */
import {
  ParallelLaneId,
  LaneTaskAllocation,
} from '../../types/dependency-graph';

export interface LaneConflictReport {
  hasConflict: boolean;
  conflictingFiles: string[];
  competingTasks: string[];
}

export interface PackPromotionPrerequisiteCheck {
  canPromote: boolean;
  reason?: string;
  missingCorePrerequisites: string[];
}

export class ParallelWorkCoordinator {
  private activeAllocations: Map<string, LaneTaskAllocation> = new Map();

  allocateTask(allocation: LaneTaskAllocation): {
    success: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 1. Check unique task ID
    if (this.activeAllocations.has(allocation.taskId)) {
      errors.push(`Task ID ${allocation.taskId} is already allocated`);
    }

    // 2. Validate branch naming convention
    const validBranchPattern = /^lane\/(runtime|knowledge|client|evals)\/[A-Za-z0-9-_]+$/;
    if (!validBranchPattern.test(allocation.branchName)) {
      errors.push(
        `Branch name '${allocation.branchName}' does not follow convention 'lane/<runtime|knowledge|client|evals>/<task-id>'`,
      );
    }

    // 3. Detect concurrent file conflicts
    const conflict = this.checkFileConflicts(
      allocation.targetFiles,
      allocation.taskId,
    );
    if (conflict.hasConflict) {
      errors.push(
        `File conflict detected in files: ${conflict.conflictingFiles.join(', ')} currently edited by tasks: ${conflict.competingTasks.join(', ')}`,
      );
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    this.activeAllocations.set(allocation.taskId, allocation);
    return { success: true, errors: [] };
  }

  releaseTask(taskId: string): boolean {
    return this.activeAllocations.delete(taskId);
  }

  getAllAllocations(): LaneTaskAllocation[] {
    return Array.from(this.activeAllocations.values());
  }

  getAllocationsByLane(laneId: ParallelLaneId): LaneTaskAllocation[] {
    return this.getAllAllocations().filter((a) => a.laneId === laneId);
  }

  checkFileConflicts(
    targetFiles: string[],
    currentTaskId?: string,
  ): LaneConflictReport {
    const normalizedTargets = new Set(targetFiles.map((f) => f.replace(/\\/g, '/').toLowerCase()));
    const conflictingFiles: Set<string> = new Set();
    const competingTasks: Set<string> = new Set();

    for (const alloc of this.activeAllocations.values()) {
      if (currentTaskId && alloc.taskId === currentTaskId) continue;
      for (const existingFile of alloc.targetFiles) {
        const normExisting = existingFile.replace(/\\/g, '/').toLowerCase();
        if (normalizedTargets.has(normExisting)) {
          conflictingFiles.add(existingFile);
          competingTasks.add(alloc.taskId);
        }
      }
    }

    return {
      hasConflict: conflictingFiles.size > 0,
      conflictingFiles: Array.from(conflictingFiles),
      competingTasks: Array.from(competingTasks),
    };
  }

  verifyPackPromotionPrerequisites(
    packId: string,
    verifiedCorePhases: Set<string>,
  ): PackPromotionPrerequisiteCheck {
    const requiredCore = ['P06', 'P07', 'P08', 'P09'];
    const missing = requiredCore.filter((p) => !verifiedCorePhases.has(p));

    if (missing.length > 0) {
      return {
        canPromote: false,
        reason: `Pack adapter '${packId}' cannot be promoted before core registry and scoring phases are verified (${missing.join(', ')})`,
        missingCorePrerequisites: missing,
      };
    }

    return {
      canPromote: true,
      missingCorePrerequisites: [],
    };
  }
}
