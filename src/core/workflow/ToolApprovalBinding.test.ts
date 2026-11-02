import { ToolApprovalService } from './ToolApprovalBinding';

describe('ToolApprovalBinding (CRK-P04-T06)', () => {
  const sampleInputs = {
    filePath: 'src/core/chat/ChatRuntime.ts',
    targetLines: [10, 20],
    content: 'const x = 1;',
  };

  it('generates valid cryptographic approval binding', () => {
    const binding = ToolApprovalService.createBinding({
      stepId: 'step-apply',
      operation: 'modify_file',
      toolName: 'replace_file_content',
      inputs: sampleInputs,
      targetPaths: ['src/core/chat/ChatRuntime.ts'],
      allowedSideEffects: ['modify_code'],
      ttlSeconds: 60,
    });

    expect(binding.operation).toBe('modify_file');
    expect(binding.toolName).toBe('replace_file_content');
    expect(binding.inputHash).toHaveLength(64);
    expect(binding.approvalToken).toHaveLength(64);

    const verification = ToolApprovalService.verifyBinding({
      binding,
      operation: 'modify_file',
      toolName: 'replace_file_content',
      inputs: sampleInputs,
      targetPaths: ['src/core/chat/ChatRuntime.ts'],
      approvalToken: binding.approvalToken,
    });

    expect(verification.valid).toBe(true);
  });

  it('invalidates approval when inputs are altered after grant (§1201)', () => {
    const binding = ToolApprovalService.createBinding({
      stepId: 'step-apply',
      operation: 'modify_file',
      toolName: 'replace_file_content',
      inputs: sampleInputs,
      targetPaths: ['src/core/chat/ChatRuntime.ts'],
    });

    // Tampered input (content modified)
    const tamperedInputs = {
      ...sampleInputs,
      content: 'malicious_code_injection();',
    };

    const verification = ToolApprovalService.verifyBinding({
      binding,
      operation: 'modify_file',
      toolName: 'replace_file_content',
      inputs: tamperedInputs,
      approvalToken: binding.approvalToken,
    });

    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain('hash mismatch');
  });

  it('rejects expired approval tokens (§1199)', () => {
    const binding = ToolApprovalService.createBinding({
      stepId: 'step-apply',
      operation: 'modify_file',
      toolName: 'replace_file_content',
      inputs: sampleInputs,
      ttlSeconds: 1, // 1 sec
    });

    const verification = ToolApprovalService.verifyBinding({
      binding,
      operation: 'modify_file',
      toolName: 'replace_file_content',
      inputs: sampleInputs,
      approvalToken: binding.approvalToken,
      now: new Date(Date.now() + 5000).toISOString(), // 5 seconds later
    });

    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain('expired');
  });

  it('rejects unauthorized target paths (§1197)', () => {
    const binding = ToolApprovalService.createBinding({
      stepId: 'step-apply',
      operation: 'modify_file',
      toolName: 'replace_file_content',
      inputs: sampleInputs,
      targetPaths: ['src/safe/path.ts'],
    });

    const verification = ToolApprovalService.verifyBinding({
      binding,
      operation: 'modify_file',
      toolName: 'replace_file_content',
      inputs: sampleInputs,
      targetPaths: ['src/critical/secret.ts'],
      approvalToken: binding.approvalToken,
    });

    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain('Unauthorized target path');
  });
});
