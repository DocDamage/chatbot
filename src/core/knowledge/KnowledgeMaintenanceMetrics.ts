/**
 * Knowledge Maintenance Metrics & Alerts (CRK-P26-T07)
 *
 * Tracks operational telemetry for knowledge datasets and jobs,
 * computes health metrics, and evaluates alerting conditions.
 */

import {
  OperationalAlert,
  OperationalMaintenanceMetrics,
} from '../../types/knowledge-maintenance';

export interface DatasetJobRecord {
  jobId: string;
  datasetId: string;
  status: 'COMPLETED' | 'FAILED';
  downloadBytes: number;
  chunksIndexed: number;
  durationMs: number;
  duplicateCount: number;
  timestamp: number;
}

export class KnowledgeMaintenanceMetrics {
  private readonly jobRecords: DatasetJobRecord[] = [];
  private readonly alerts: OperationalAlert[] = [];
  private readonly consecutiveFailures = new Map<string, number>();

  public recordJob(record: DatasetJobRecord): void {
    this.jobRecords.push(record);

    if (record.status === 'FAILED') {
      const count = (this.consecutiveFailures.get(record.datasetId) || 0) + 1;
      this.consecutiveFailures.set(record.datasetId, count);

      // Alert if repeated refresh failure occurs >= 3 times (§3854)
      if (count >= 3) {
        this.emitAlert({
          id: `alt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          code: 'REPEATED_REFRESH_FAILURE',
          severity: 'CRITICAL',
          datasetId: record.datasetId,
          message: `Dataset ${record.datasetId} has failed refresh ${count} consecutive times`,
          timestamp: Date.now(),
        });
      }
    } else {
      this.consecutiveFailures.set(record.datasetId, 0);
    }
  }

  public emitAlert(alert: OperationalAlert): void {
    this.alerts.push(alert);
  }

  public getAlerts(): OperationalAlert[] {
    return [...this.alerts];
  }

  /**
   * Check system disk threshold and emit alert if exceeded (§3855)
   */
  public checkDiskThreshold(diskUsagePercent: number, freeDiskGb: number): void {
    if (diskUsagePercent >= 85 || freeDiskGb < 10) {
      this.emitAlert({
        id: `alt-disk-${Date.now()}`,
        code: 'DISK_THRESHOLD_EXCEEDED',
        severity: diskUsagePercent >= 95 ? 'CRITICAL' : 'WARNING',
        message: `Disk threshold exceeded: ${diskUsagePercent}% used, ${freeDiskGb}GB free remaining`,
        timestamp: Date.now(),
        details: { diskUsagePercent, freeDiskGb },
      });
    }
  }

  /**
   * Check source count drop and emit alert if anomaly detected (>20% drop) (§3858)
   */
  public checkSourceCountAnomaly(datasetId: string, previousCount: number, currentCount: number): void {
    if (previousCount > 0 && currentCount < previousCount * 0.8) {
      const dropPct = Math.round(((previousCount - currentCount) / previousCount) * 100);
      this.emitAlert({
        id: `alt-drop-${Date.now()}`,
        code: 'ABNORMAL_SOURCE_COUNT_DROP',
        severity: 'CRITICAL',
        datasetId,
        message: `Dataset ${datasetId} source count dropped by ${dropPct}% (${previousCount} -> ${currentCount})`,
        timestamp: Date.now(),
        details: { previousCount, currentCount, dropPct },
      });
    }
  }

  /**
   * Computes aggregate operational metrics (§3837-3849)
   */
  public computeMetrics(
    staleDatasetCount: number,
    diskUsagePercent: number,
    freeDiskGb: number,
    avgRetrievalLatencyMs = 45
  ): OperationalMaintenanceMetrics {
    const totalJobs = this.jobRecords.length;
    const successful = this.jobRecords.filter((j) => j.status === 'COMPLETED').length;
    const failed = this.jobRecords.filter((j) => j.status === 'FAILED').length;

    let totalBytes = 0;
    let totalChunks = 0;
    let totalDuplicates = 0;

    for (const job of this.jobRecords) {
      totalBytes += job.downloadBytes;
      totalChunks += job.chunksIndexed;
      totalDuplicates += job.duplicateCount;
    }

    return {
      totalJobsExecuted: totalJobs,
      successfulJobs: successful,
      failedJobs: failed,
      totalBytesDownloaded: totalBytes,
      totalChunksIndexed: totalChunks,
      staleDatasetCount,
      duplicateRejectionCount: totalDuplicates,
      diskUsagePercent,
      freeDiskGb,
      averageRetrievalLatencyMs: avgRetrievalLatencyMs,
    };
  }
}
