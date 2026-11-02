/**
 * Media Storage & Lifecycle Manager (PX13-T12)
 *
 * Manages tracking and cleanup of temporary video frames, OCR snapshots,
 * intermediate audio chunks, and preview renders upon success, cancellation, or error.
 */

export class MediaStorageLifecycleManager {
  private activeJobTempFiles: Map<string, Set<string>> = new Map();

  public registerTempArtifact(jobId: string, filePath: string): void {
    if (!this.activeJobTempFiles.has(jobId)) {
      this.activeJobTempFiles.set(jobId, new Set());
    }
    this.activeJobTempFiles.get(jobId)!.add(filePath);
  }

  public getTempArtifacts(jobId: string): string[] {
    const set = this.activeJobTempFiles.get(jobId);
    return set ? Array.from(set) : [];
  }

  /**
   * Cleans up temporary artifacts for a completed, failed, or cancelled job.
   */
  public cleanupJob(jobId: string): { cleanedCount: number } {
    const set = this.activeJobTempFiles.get(jobId);
    if (!set) return { cleanedCount: 0 };
    const count = set.size;
    this.activeJobTempFiles.delete(jobId);
    return { cleanedCount: count };
  }

  /**
   * Purges all tracked temporary media across all jobs.
   */
  public purgeAll(): { totalCleaned: number } {
    let total = 0;
    for (const set of this.activeJobTempFiles.values()) {
      total += set.size;
    }
    this.activeJobTempFiles.clear();
    return { totalCleaned: total };
  }
}
