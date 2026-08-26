/**
 * Agent Evidence & Review Bundle Service (PX-06 / PX06-T08)
 * Compiles cryptographic evidence, touched files, command executions,
 * test results, reviewer findings, cost metrics, and handoff packages for completed tasks.
 */

import * as crypto from 'crypto';
import { TaskEnvelope } from '../../coding/teams/TaskEnvelope';
import { AgentPrivacyRedactor } from '../privacy/AgentPrivacyRedactor';

export interface CommandExecutionRecord {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timestamp: string;
}

export interface ReviewFindingRecord {
  reviewerRole: 'reviewer' | 'security_reviewer';
  verdict: 'approved' | 'rejected' | 'changes_requested';
  comments: string[];
  findings: Array<{
    severity: 'info' | 'warning' | 'critical';
    category: string;
    description: string;
    filePath?: string;
    lineNumber?: number;
  }>;
  signedDigest: string;
}

export interface AgentEvidenceBundle {
  bundleId: string;
  taskId: string;
  sessionId: string;
  agentId: string;
  taskEnvelope: TaskEnvelope;
  sourceBaseline: {
    commitSha?: string;
    branch?: string;
    repository?: string;
  };
  filesRead: string[];
  filesChanged: string[];
  patches: Array<{ filePath: string; diffContent: string }>;
  commandsRun: CommandExecutionRecord[];
  testsExecuted: Array<{
    testSuiteName: string;
    passed: boolean;
    durationMs: number;
    failureDetails?: string;
  }>;
  reviewerFindings: ReviewFindingRecord[];
  unresolvedConflicts: string[];
  artifactsGenerated: Array<{ artifactId: string; fileName: string; sha256Digest: string }>;
  resourceSummary: {
    tokensUsed: number;
    durationMs: number;
    commandsCount: number;
    diskBytesUsed: number;
    estimatedCostUsd: number;
  };
  finalStatus: 'succeeded' | 'failed' | 'cancelled' | 'rejected';
  handoffSummary: string;
  bundleDigest: string;
  createdAt: string;
}

export interface CreateEvidenceBundleOptions {
  bundleId?: string;
  taskId: string;
  sessionId: string;
  agentId: string;
  taskEnvelope: TaskEnvelope;
  sourceBaseline?: AgentEvidenceBundle['sourceBaseline'];
  filesRead?: string[];
  filesChanged?: string[];
  patches?: Array<{ filePath: string; diffContent: string }>;
  commandsRun?: CommandExecutionRecord[];
  testsExecuted?: AgentEvidenceBundle['testsExecuted'];
  reviewerFindings?: ReviewFindingRecord[];
  unresolvedConflicts?: string[];
  artifactsGenerated?: AgentEvidenceBundle['artifactsGenerated'];
  resourceSummary: AgentEvidenceBundle['resourceSummary'];
  finalStatus: AgentEvidenceBundle['finalStatus'];
  handoffSummary: string;
}

export class AgentEvidenceBundleService {
  /**
   * Assemble and cryptographically sign an immutable evidence bundle
   */
  public static createBundle(options: CreateEvidenceBundleOptions): AgentEvidenceBundle {
    const bundleId = options.bundleId || `bundle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const sanitizedCommands = (options.commandsRun || []).map(cmd => ({
      ...cmd,
      stdout: AgentPrivacyRedactor.redactString(cmd.stdout),
      stderr: AgentPrivacyRedactor.redactString(cmd.stderr)
    }));

    const rawBundle: Omit<AgentEvidenceBundle, 'bundleDigest'> = {
      bundleId,
      taskId: options.taskId,
      sessionId: options.sessionId,
      agentId: options.agentId,
      taskEnvelope: options.taskEnvelope,
      sourceBaseline: options.sourceBaseline || {},
      filesRead: options.filesRead || [],
      filesChanged: options.filesChanged || [],
      patches: options.patches || [],
      commandsRun: sanitizedCommands,
      testsExecuted: options.testsExecuted || [],
      reviewerFindings: options.reviewerFindings || [],
      unresolvedConflicts: options.unresolvedConflicts || [],
      artifactsGenerated: options.artifactsGenerated || [],
      resourceSummary: options.resourceSummary,
      finalStatus: options.finalStatus,
      handoffSummary: AgentPrivacyRedactor.redactString(options.handoffSummary),
      createdAt: now
    };

    const bundleDigest = this.computeBundleDigest(rawBundle);

    return {
      ...rawBundle,
      bundleDigest
    };
  }

  /**
   * Verify the integrity of an AgentEvidenceBundle
   */
  public static verifyBundle(bundle: AgentEvidenceBundle): boolean {
    const { bundleDigest, ...rest } = bundle;
    const computed = this.computeBundleDigest(rest);
    return computed === bundleDigest;
  }

  private static computeBundleDigest(bundleData: any): string {
    const normalized = JSON.stringify(bundleData);
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }
}
