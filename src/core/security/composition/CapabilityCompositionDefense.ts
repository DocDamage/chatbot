import * as crypto from 'crypto';

export interface AbuseCheckResult {
  isBlocked: boolean;
  threatCategory?: string;
  reason?: string;
  sanitizedOutput?: unknown;
}

export class CapabilityCompositionDefense {
  private static readonly INJECTION_INSTRUCTION_PATTERNS = [
    /ignore\s+(?:all\s+)?previous\s+instructions/i,
    /system\s+override\s*:\s*enable\s+capability/i,
    /escalate\s+privilege\s+to\s+admin/i,
    /grant\s+permission\s+["']?[a-zA-Z._-]+["']?/i,
    /disable\s+approval\s+gate/i,
    /exfiltrate\s+secrets/i,
    /send\s+api_key\s+to/i
  ];

  public static inspectInputInstruction(input: string): AbuseCheckResult {
    for (const pattern of this.INJECTION_INSTRUCTION_PATTERNS) {
      if (pattern.test(input)) {
        return {
          isBlocked: true,
          threatCategory: 'INDIRECT_PROMPT_INJECTION',
          reason: `Detected forbidden prompt-level policy override or privilege escalation pattern: ${pattern}`
        };
      }
    }

    return {
      isBlocked: false
    };
  }

  public static validateApprovalReplay(
    approvalDigest: string,
    actionPayload: unknown,
    recordedTimestamp: number,
    ttlMs: number = 300000 // 5 minutes
  ): AbuseCheckResult {
    const now = Date.now();
    if (now - recordedTimestamp > ttlMs) {
      return {
        isBlocked: true,
        threatCategory: 'APPROVAL_EXPIRED',
        reason: 'The exact-scope approval has expired. Re-authentication required.'
      };
    }

    const payloadJson = JSON.stringify(actionPayload);
    const expectedDigest = crypto.createHash('sha256').update(payloadJson).digest('hex');

    if (approvalDigest !== expectedDigest) {
      return {
        isBlocked: true,
        threatCategory: 'APPROVAL_DIGEST_MISMATCH',
        reason: 'Approval digest mismatch. Proposed action or target was modified after approval was granted.'
      };
    }

    return {
      isBlocked: false
    };
  }

  public static validateFileImportQuarantine(
    fileName: string,
    targetDirectory: string,
    allowedExtensions: string[]
  ): AbuseCheckResult {
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return {
        isBlocked: true,
        threatCategory: 'PATH_TRAVERSAL_IN_IMPORT',
        reason: 'Filename contains forbidden directory traversal characters.'
      };
    }

    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex === -1) {
      return {
        isBlocked: true,
        threatCategory: 'MISSING_FILE_EXTENSION',
        reason: 'File must possess a validated extension.'
      };
    }

    const ext = fileName.slice(dotIndex).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return {
        isBlocked: true,
        threatCategory: 'DISALLOWED_EXTENSION',
        reason: `File extension ${ext} is not allowlisted for import into target workspace.`
      };
    }

    return {
      isBlocked: false
    };
  }
}
