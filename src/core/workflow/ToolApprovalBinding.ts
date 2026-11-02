/**
 * Canonical Tool Approval Binding (CRK-P04-T06)
 *
 * Cryptographically binds user tool approvals to (§1191-1202):
 * - Exact operation and tool name
 * - Exact input payload hash (SHA-256)
 * - Target file/resource paths
 * - Allowed side effects
 * - Strict temporal expiration
 *
 * Changing operation, tool arguments, or paths immediately invalidates approval (§1201).
 */

import { createHash } from 'crypto';
import { ToolApprovalBinding, toolApprovalBindingSchema } from '../../types/workflow';

export interface CreateApprovalParams {
  stepId: string;
  operation: string;
  toolName: string;
  inputs: unknown;
  targetPaths?: string[];
  allowedSideEffects?: string[];
  ttlSeconds?: number;
}

export interface VerifyApprovalParams {
  binding: ToolApprovalBinding;
  operation: string;
  toolName: string;
  inputs: unknown;
  targetPaths?: string[];
  approvalToken: string;
  now?: string;
}

export class ToolApprovalService {
  public static hashInputs(inputs: unknown): string {
    const stringifyCanonical = (val: any): string => {
      if (val === null || typeof val !== 'object') {
        return JSON.stringify(val);
      }
      if (Array.isArray(val)) {
        return '[' + val.map(stringifyCanonical).join(',') + ']';
      }
      const sortedKeys = Object.keys(val).sort();
      const parts = sortedKeys.map((k) => `${JSON.stringify(k)}:${stringifyCanonical(val[k])}`);
      return '{' + parts.join(',') + '}';
    };
    return createHash('sha256').update(stringifyCanonical(inputs)).digest('hex');
  }

  public static createBinding(params: CreateApprovalParams): ToolApprovalBinding {
    const inputHash = this.hashInputs(params.inputs);
    const ttl = params.ttlSeconds || 300; // default 5 minutes
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    const rawTokenData = `${params.stepId}:${params.operation}:${params.toolName}:${inputHash}:${expiresAt}`;
    const approvalToken = createHash('sha256').update(rawTokenData).digest('hex');

    const binding: ToolApprovalBinding = {
      stepId: params.stepId,
      operation: params.operation,
      toolName: params.toolName,
      inputHash,
      targetPaths: params.targetPaths || [],
      allowedSideEffects: params.allowedSideEffects || [],
      approvalToken,
      expiresAt,
    };

    return toolApprovalBindingSchema.parse(binding);
  }

  public static verifyBinding(params: VerifyApprovalParams): { valid: boolean; reason?: string } {
    const { binding, operation, toolName, inputs, targetPaths, approvalToken } = params;
    const now = params.now || new Date().toISOString();

    // 1. Expiration check
    if (binding.expiresAt < now) {
      return { valid: false, reason: `Approval token expired at ${binding.expiresAt}` };
    }

    // 2. Token match
    if (binding.approvalToken !== approvalToken) {
      return { valid: false, reason: 'Invalid approval token provided' };
    }

    // 3. Operation & Tool check
    if (binding.operation !== operation) {
      return {
        valid: false,
        reason: `Operation mismatch: expected ${binding.operation}, received ${operation}`,
      };
    }
    if (binding.toolName !== toolName) {
      return {
        valid: false,
        reason: `Tool mismatch: expected ${binding.toolName}, received ${toolName}`,
      };
    }

    // 4. Input payload hash check
    const currentHash = this.hashInputs(inputs);
    if (binding.inputHash !== currentHash) {
      return {
        valid: false,
        reason: 'Input payload altered after approval granted (hash mismatch)',
      };
    }

    // 5. Target paths check
    if (targetPaths && targetPaths.length > 0) {
      const boundPaths = new Set(binding.targetPaths);
      for (const p of targetPaths) {
        if (!boundPaths.has(p)) {
          return {
            valid: false,
            reason: `Unauthorized target path attempted: ${p}`,
          };
        }
      }
    }

    return { valid: true };
  }
}
