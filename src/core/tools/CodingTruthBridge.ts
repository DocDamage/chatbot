/**
 * Coding Truth Bridge (CRK-P18-T04)
 *
 * Unifies structured coding/patch actions and verification with CanonicalToolResult
 * and SideEffectLedger without maintaining a separate truth model (§3040-3045):
 * - Translates file edits, patches, and build/test executions into CanonicalToolResult
 * - Records mutations directly into SideEffectLedger
 * - Binds verification results (verified, unverified, failed) to the ledger
 *
 * Strictly adheres to the < 300 lines per file rule (§494).
 */

import {
  CanonicalToolResult,
  ToolExecutionStatus,
  ToolVerificationStatus,
} from '../../types/tool-truth';
import { SideEffectLedger } from './SideEffectLedger';

export interface CodePatchExecutionParams {
  sessionId: string;
  toolCallId: string;
  actor: string;
  authorizationId: string;
  targetPath: string;
  patchDiff?: string;
  backupPath?: string;
  success: boolean;
  error?: { code: string; safeMessage: string };
}

export interface VerificationExecutionParams {
  sessionId: string;
  toolCallId: string;
  ledgerId?: string;
  command: string;
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

export class CodingTruthBridge {
  private readonly ledger: SideEffectLedger;

  constructor(ledger?: SideEffectLedger) {
    this.ledger = ledger || SideEffectLedger.getInstance();
  }

  /**
   * Records a code patch execution as a canonical tool result and ledger entry (§3042).
   */
  public recordCodePatch(params: CodePatchExecutionParams): {
    toolResult: CanonicalToolResult;
    ledgerId: string;
  } {
    const inputHash = `hash_${params.targetPath}_${Date.now()}`;
    const intent = this.ledger.recordIntent({
      sessionId: params.sessionId,
      toolCallId: params.toolCallId,
      actor: params.actor,
      authorizationId: params.authorizationId,
      inputHash,
      exactTarget: params.targetPath,
      rollbackInfo: params.backupPath
        ? {
            mechanism: 'file_restore',
            backupPath: params.backupPath,
          }
        : undefined,
    });

    const status: ToolExecutionStatus = params.success ? 'success' : 'failed';

    if (params.success) {
      this.ledger.recordApplied(intent.ledgerId, [params.targetPath]);
    } else {
      this.ledger.recordFailure(intent.ledgerId);
    }

    const toolResult: CanonicalToolResult = {
      toolCallId: params.toolCallId,
      toolId: 'code_patcher',
      status,
      startedAt: intent.createdAt,
      completedAt: new Date().toISOString(),
      inputsDigest: inputHash,
      outputs: [
        {
          id: `out_${params.toolCallId}`,
          type: 'diff',
          path: params.targetPath,
          summary: params.patchDiff?.slice(0, 100) || 'Applied file diff',
        },
      ],
      error: params.error,
      verification: {
        status: 'unverified',
        evidence: [],
      },
    };

    return { toolResult, ledgerId: intent.ledgerId };
  }

  /**
   * Bridges automated test or type-check verification to the canonical tool result and ledger (§3043).
   */
  public recordVerification(params: VerificationExecutionParams): CanonicalToolResult {
    const vStatus: ToolVerificationStatus = params.exitCode === 0 ? 'verified' : 'failed';
    const evidence = [
      `Command: ${params.command}`,
      `Exit Code: ${params.exitCode}`,
      ...(params.stdout ? [`Stdout: ${params.stdout.slice(0, 200)}`] : []),
      ...(params.stderr ? [`Stderr: ${params.stderr.slice(0, 200)}`] : []),
    ];

    if (params.ledgerId) {
      this.ledger.recordVerification(params.ledgerId, {
        status: vStatus,
        evidence,
      });
    }

    return {
      toolCallId: params.toolCallId,
      toolId: 'verification_runner',
      status: params.exitCode === 0 ? 'success' : 'failed',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      inputsDigest: `digest_${params.command}`,
      verification: {
        status: vStatus,
        evidence,
      },
      error:
        params.exitCode !== 0
          ? {
              code: 'VERIFICATION_COMMAND_FAILED',
              safeMessage: `Verification command "${params.command}" failed with exit code ${params.exitCode}.`,
            }
          : undefined,
    };
  }
}
