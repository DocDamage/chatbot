/**
 * Unit Tests for Tool Truth & Ledger Schemas (CRK-P18-T01, T02)
 */

import {
  canonicalToolResultSchema,
  sideEffectLedgerEntrySchema,
  STATUS_ALLOWED_LANGUAGE,
  CanonicalToolResult,
} from './tool-truth';

describe('Tool Truth Schemas (CRK-P18-T01, T02)', () => {
  it('validates a successful verified canonical tool result', () => {
    const raw: CanonicalToolResult = {
      toolCallId: 'call_123',
      toolId: 'file_patcher',
      status: 'success',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      inputsDigest: 'sha256_abcdef123456',
      outputs: [
        {
          id: 'out_1',
          type: 'diff',
          path: 'src/index.ts',
          summary: 'Updated export statement',
        },
      ],
      verification: {
        status: 'verified',
        evidence: ['npm run test passed with 0 errors'],
      },
    };

    const parsed = canonicalToolResultSchema.parse(raw);
    expect(parsed.toolCallId).toBe('call_123');
    expect(parsed.status).toBe('success');
    expect(parsed.verification?.status).toBe('verified');
    expect(parsed.outputs).toHaveLength(1);
  });

  it('validates a failed tool result with error code and safeMessage', () => {
    const raw = {
      toolCallId: 'call_failed',
      toolId: 'git_commit',
      status: 'failed' as const,
      inputsDigest: 'sha256_digest_xyz',
      error: {
        code: 'GIT_DIRTY_WORKTREE',
        safeMessage: 'Cannot commit with unstaged changes',
      },
      outputs: [],
    };

    const parsed = canonicalToolResultSchema.parse(raw);
    expect(parsed.status).toBe('failed');
    expect(parsed.error?.code).toBe('GIT_DIRTY_WORKTREE');
  });

  it('validates SideEffectLedgerEntry schema with rollback snapshot', () => {
    const entry = {
      ledgerId: 'ledg_001',
      sessionId: 'sess_999',
      toolCallId: 'call_edit',
      actor: 'system_agent',
      authorizationId: 'auth_token_sig_123',
      inputHash: 'hash_987654',
      exactTarget: 'src/core/ChatRuntime.ts',
      status: 'applied' as const,
      changedResources: ['src/core/ChatRuntime.ts'],
      rollbackInfo: {
        mechanism: 'file_restore' as const,
        backupPath: '.backups/ChatRuntime.ts.bak',
        snapshotDigest: 'sha256_backup_hash',
      },
      verification: {
        status: 'verified' as const,
        evidence: ['tsc passed'],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const parsed = sideEffectLedgerEntrySchema.parse(entry);
    expect(parsed.ledgerId).toBe('ledg_001');
    expect(parsed.rollbackInfo?.mechanism).toBe('file_restore');
    expect(parsed.verification.status).toBe('verified');
  });

  it('verifies all 6 tool execution statuses have standard allowed language', () => {
    const statuses = ['success', 'failed', 'blocked', 'cancelled', 'partial', 'not_run'] as const;
    for (const status of statuses) {
      expect(STATUS_ALLOWED_LANGUAGE[status]).toBeDefined();
    }
  });
});
