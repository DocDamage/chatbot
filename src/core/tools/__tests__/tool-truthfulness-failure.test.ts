/**
 * Phase 18 Exit Gate & Failure Test Suite: Tool Result Truthfulness & Side-Effect Ledger
 *
 * Verifies all 6 mandatory failure conditions (§3046-3056) and exit criteria (§3057-3063):
 * 1. Provider returns success text but tool failed (§3050).
 * 2. Tool throws after partial write (§3051).
 * 3. Approval expires (§3052).
 * 4. Verification command unavailable (§3053).
 * 5. Cancellation during action (§3054).
 * 6. Process exits zero but expected artifact missing (§3055).
 */

import { SideEffectLedger } from '../SideEffectLedger';
import { ToolLanguageTruthfulness } from '../ToolLanguageTruthfulness';
import { CodingTruthBridge } from '../CodingTruthBridge';
import { CanonicalToolResult } from '../../../types/tool-truth';
import { ResponseQualityGate } from '../../validation/ResponseQualityGate';

describe('Tool Result Truthfulness & Failure Suite (CRK-P18-T05)', () => {
  let ledger: SideEffectLedger;
  let bridge: CodingTruthBridge;

  beforeEach(() => {
    SideEffectLedger.resetInstance();
    ledger = SideEffectLedger.getInstance();
    bridge = new CodingTruthBridge(ledger);
  });

  describe('Failure Scenario 1: Provider returns success text but tool failed (§3050)', () => {
    it('detects discrepancy and replaces false success claims with failure notification', () => {
      const toolResults: CanonicalToolResult[] = [
        {
          toolCallId: 'call_edit_fail',
          toolId: 'file_patcher',
          status: 'failed',
          inputsDigest: 'hash_123',
          error: { code: 'PERMISSION_DENIED', safeMessage: 'File is read-only' },
        },
      ];

      const providerResponse = 'I successfully executed the update on src/index.ts.';
      const validated = ToolLanguageTruthfulness.validateResponse(providerResponse, toolResults);

      expect(validated.valid).toBe(false);
      expect(validated.violations).toHaveLength(1);
      expect(validated.violations[0]).toContain('failed, but response claims successful completion');
      expect(validated.correctedResponse).toContain('failed to complete the operation');
      expect(validated.correctedResponse).toContain('File is read-only');
    });
  });

  describe('Failure Scenario 2: Tool throws after partial write (§3051)', () => {
    it('records partial mutation in ledger with rollback snapshot details', () => {
      const intent = ledger.recordIntent({
        sessionId: 'sess_partial',
        toolCallId: 'call_partial',
        actor: 'patcher_agent',
        authorizationId: 'auth_sig_456',
        inputHash: 'hash_partial_src',
        exactTarget: 'src/database/schema.sql',
        rollbackInfo: {
          mechanism: 'file_restore',
          backupPath: '.backups/schema.sql.bak',
          snapshotDigest: 'sha256_orig_snapshot',
        },
      });

      // Simulate partial write failure
      ledger.recordFailure(intent.ledgerId);
      const entry = ledger.getEntry(intent.ledgerId);

      expect(entry?.status).toBe('failed');
      expect(entry?.rollbackInfo?.backupPath).toBe('.backups/schema.sql.bak');

      // Check allowed language for partial tool result
      const wording = ToolLanguageTruthfulness.getAllowedWording('partial');
      expect(wording).toBe('partially completed');
    });
  });

  describe('Failure Scenario 3: Approval expires (§3052)', () => {
    it('marks tool as blocked and restricts response to permission/policy wording', () => {
      const toolResults: CanonicalToolResult[] = [
        {
          toolCallId: 'call_expired_token',
          toolId: 'production_deployer',
          status: 'blocked',
          inputsDigest: 'hash_deploy',
          error: { code: 'APPROVAL_EXPIRED', safeMessage: 'Approval token expired after 300s' },
        },
      ];

      const providerText = 'I ran the action and deployed the application.';
      const validated = ToolLanguageTruthfulness.validateResponse(providerText, toolResults);

      expect(validated.valid).toBe(false);
      expect(validated.violations[0]).toContain('was blocked, but response claims it executed');
      expect(validated.correctedResponse).toContain('could not run due to policy/permission');
    });
  });

  describe('Failure Scenario 4: Verification command unavailable (§3053)', () => {
    it('marks tool as success + unverified and strictly prohibits claiming verified', () => {
      const toolResults: CanonicalToolResult[] = [
        {
          toolCallId: 'call_patch_ok',
          toolId: 'file_patcher',
          status: 'success',
          inputsDigest: 'hash_patch_1',
          verification: {
            status: 'unverified',
            evidence: ['Verification tool "jest" not installed or unavailable in PATH'],
          },
        },
      ];

      const wording = ToolLanguageTruthfulness.getAllowedWording('success', 'unverified');
      expect(wording).toBe('completed; verification not performed');

      const providerText = 'I updated the file and verified that all changes pass.';
      const validated = ToolLanguageTruthfulness.validateResponse(providerText, toolResults);

      expect(validated.valid).toBe(false);
      expect(validated.correctedResponse).toContain('completed; verification not performed');
    });
  });

  describe('Failure Scenario 5: Cancellation during action (§3054)', () => {
    it('records cancellation and prevents claiming completion', () => {
      const toolResults: CanonicalToolResult[] = [
        {
          toolCallId: 'call_cancelled',
          toolId: 'heavy_migration',
          status: 'cancelled',
          inputsDigest: 'hash_migr',
          error: { code: 'USER_CANCELLED', safeMessage: 'Operation cancelled by user' },
        },
      ];

      const providerText = 'The database migration completed successfully.';
      const validated = ToolLanguageTruthfulness.validateResponse(providerText, toolResults);

      expect(validated.valid).toBe(false);
      expect(validated.violations[0]).toContain('was cancelled, but response claims completion');
      expect(validated.correctedResponse).toContain('was cancelled before completion');
    });
  });

  describe('Failure Scenario 6: Process exits zero but expected artifact missing (§3055)', () => {
    it('records verification failure when expected artifact verification fails', () => {
      const patch = bridge.recordCodePatch({
        sessionId: 'sess_art_miss',
        toolCallId: 'call_build',
        actor: 'builder',
        authorizationId: 'auth_ok',
        targetPath: 'dist/bundle.js',
        success: true,
      });

      // Verification finds artifact missing despite 0 exit code
      const verifiedResult = bridge.recordVerification({
        sessionId: 'sess_art_miss',
        toolCallId: 'call_verify_art',
        ledgerId: patch.ledgerId,
        command: 'test -f dist/bundle.js',
        exitCode: 1,
        stderr: 'dist/bundle.js: No such file or directory',
      });

      expect(verifiedResult.status).toBe('failed');
      expect(verifiedResult.verification?.status).toBe('failed');

      const ledgerEntry = ledger.getEntry(patch.ledgerId);
      expect(ledgerEntry?.verification.status).toBe('failed');
    });
  });

  describe('Phase 18 Exit Gate (§3057-3063)', () => {
    it('guarantees mutations have an auditable ledger and coding path does not overclaim', () => {
      // 1. Ledger auditability
      const patch = bridge.recordCodePatch({
        sessionId: 'sess_audit_test',
        toolCallId: 'call_mod_1',
        actor: 'developer_agent',
        authorizationId: 'auth_sig_999',
        targetPath: 'src/app.ts',
        patchDiff: '+ console.log("ready");',
        backupPath: '.backups/app.ts.bak',
        success: true,
      });

      const auditLog = ledger.exportAuditLog('sess_audit_test');
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].exactTarget).toBe('src/app.ts');
      expect(auditLog[0].status).toBe('applied');

      // 2. ResponseQualityGate integration
      const qualityCheck = ResponseQualityGate.validate({
        requestId: 'req_exit_gate',
        userMessage: 'Did you verify the patch?',
        response: 'I applied the change and verified that the tests pass.',
        isCodingTask: true,
        toolResults: [
          {
            toolCallId: 'call_mod_1',
            toolName: 'patch_file',
            status: 'success',
          },
        ],
      });

      // Verification command was never run, so quality gate must block overclaim
      expect(qualityCheck.valid).toBe(false);
      expect(qualityCheck.codes).toContain('OVERCLAIMED_VERIFICATION');
    });
  });
});
