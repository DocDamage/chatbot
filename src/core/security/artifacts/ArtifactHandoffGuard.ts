import * as crypto from 'crypto';

export interface ArtifactHandoffRequest {
  artifactId: string;
  sourceCapabilityId: string;
  targetCapabilityId: string;
  sourceProjectId: string;
  targetProjectId: string;
  fileName: string;
  mimeType: string;
  contentBuffer: Buffer;
  declaredSha256: string;
  requiresMutationOrEgress: boolean;
}

export interface ArtifactHandoffValidationResult {
  isAllowed: boolean;
  requiresFreshApproval: boolean;
  issues: string[];
}

export class ArtifactHandoffGuard {
  private static readonly DISALLOWED_MIME_TYPES = [
    'application/x-msdownload',
    'application/x-executable',
    'application/x-dosexec',
    'application/x-bat',
    'application/x-sh'
  ];

  public static validateHandoff(req: ArtifactHandoffRequest): ArtifactHandoffValidationResult {
    const issues: string[] = [];

    // 1. Cross-project tenant boundary check
    if (req.sourceProjectId !== req.targetProjectId) {
      issues.push(`Cross-project handoff denied. Source project (${req.sourceProjectId}) != Target project (${req.targetProjectId})`);
    }

    // 2. Filename traversal check
    if (req.fileName.includes('..') || req.fileName.includes('/') || req.fileName.includes('\\')) {
      issues.push(`Artifact filename "${req.fileName}" contains path traversal characters.`);
    }

    // 3. MIME type inspection
    if (this.DISALLOWED_MIME_TYPES.includes(req.mimeType.toLowerCase())) {
      issues.push(`MIME type ${req.mimeType} is forbidden for cross-capability artifact transfer.`);
    }

    // 4. SHA-256 integrity verification
    const computedHash = crypto.createHash('sha256').update(req.contentBuffer).digest('hex');
    if (computedHash !== req.declaredSha256) {
      issues.push(`Artifact SHA-256 integrity verification failed. Expected ${req.declaredSha256}, calculated ${computedHash}`);
    }

    // 5. Mutation or egress triggers fresh approval requirement
    const requiresFreshApproval = req.requiresMutationOrEgress;

    return {
      isAllowed: issues.length === 0,
      requiresFreshApproval,
      issues
    };
  }
}
