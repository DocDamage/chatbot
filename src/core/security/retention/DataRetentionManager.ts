export interface RetentionPolicy {
  entityType: 'job_logs' | 'artifacts' | 'memories' | 'temp_files' | 'transcripts';
  defaultRetentionDays: number;
  hardDeleteAfterExpiry: boolean;
  exportFormat: 'json' | 'markdown' | 'binary';
}

export interface DeletionAuditReport {
  timestamp: string;
  entityType: string;
  deletedRecordsCount: number;
  freedBytes: number;
  clearedStorageLayers: string[];
}

export class DataRetentionManager {
  private static readonly POLICIES: Record<string, RetentionPolicy> = {
    job_logs: {
      entityType: 'job_logs',
      defaultRetentionDays: 30,
      hardDeleteAfterExpiry: true,
      exportFormat: 'json'
    },
    artifacts: {
      entityType: 'artifacts',
      defaultRetentionDays: 90,
      hardDeleteAfterExpiry: false, // marked archived
      exportFormat: 'binary'
    },
    memories: {
      entityType: 'memories',
      defaultRetentionDays: 365,
      hardDeleteAfterExpiry: true,
      exportFormat: 'json'
    },
    temp_files: {
      entityType: 'temp_files',
      defaultRetentionDays: 1,
      hardDeleteAfterExpiry: true,
      exportFormat: 'binary'
    },
    transcripts: {
      entityType: 'transcripts',
      defaultRetentionDays: 60,
      hardDeleteAfterExpiry: true,
      exportFormat: 'markdown'
    }
  };

  public static getPolicy(entityType: string): RetentionPolicy | undefined {
    return this.POLICIES[entityType];
  }

  public static executeDataScrub(
    entityType: 'job_logs' | 'artifacts' | 'memories' | 'temp_files' | 'transcripts',
    mockRecordList: Array<{ id: string; createdAt: string; sizeBytes?: number }>,
    nowTimestamp: number = Date.now()
  ): {
    remainingRecords: Array<{ id: string; createdAt: string; sizeBytes?: number }>;
    deletedCount: number;
    auditReport: DeletionAuditReport;
  } {
    const policy = this.POLICIES[entityType];
    const maxAgeMs = (policy?.defaultRetentionDays || 30) * 86400000;

    let deletedCount = 0;
    let freedBytes = 0;
    const remainingRecords: Array<{ id: string; createdAt: string; sizeBytes?: number }> = [];

    for (const record of mockRecordList) {
      const recordAge = nowTimestamp - new Date(record.createdAt).getTime();
      if (recordAge > maxAgeMs) {
        deletedCount++;
        freedBytes += record.sizeBytes || 1024;
      } else {
        remainingRecords.push(record);
      }
    }

    const auditReport: DeletionAuditReport = {
      timestamp: new Date().toISOString(),
      entityType,
      deletedRecordsCount: deletedCount,
      freedBytes,
      clearedStorageLayers: ['database_records', 'vector_index_entries', 'disk_storage', 'cache_keys']
    };

    return {
      remainingRecords,
      deletedCount,
      auditReport
    };
  }
}
