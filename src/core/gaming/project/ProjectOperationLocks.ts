import { ProjectEnrollmentError } from './ProjectEnrollmentTypes';

/** Process-local exclusion shared by every owner/session/route factory for a physical project. */
export class ProjectOperationLocks {
  private readonly busy = new Set<string>();
  public async run<T>(physicalKey: string, work: () => Promise<T>): Promise<T> {
    if (this.busy.has(physicalKey)) throw new ProjectEnrollmentError('PROJECT_BUSY', 'Another operation owns this physical project. Retry after it completes.');
    this.busy.add(physicalKey);
    try { return await work(); } finally { this.busy.delete(physicalKey); }
  }
}

export const projectOperationLocks = new ProjectOperationLocks();
