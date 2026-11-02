import { describe, it, expect } from '@jest/globals';
import { VerificationCommandsOrchestrator } from '../VerificationCommandsOrchestrator';

describe('VerificationCommandsOrchestrator (§57)', () => {
  it('registers all 16 canonical implementation commands', () => {
    const orchestrator = new VerificationCommandsOrchestrator();
    const commands = orchestrator.listCommands();

    expect(commands).toHaveLength(16);
    expect(orchestrator.getCommand('test:chat-runtime')).toBeDefined();
    expect(orchestrator.getCommand('test:conversation-state')).toBeDefined();
    expect(orchestrator.getCommand('test:context-planner')).toBeDefined();
    expect(orchestrator.getCommand('test:knowledge')).toBeDefined();
    expect(orchestrator.getCommand('test:knowledge:migrations')).toBeDefined();
    expect(orchestrator.getCommand('test:retrieval')).toBeDefined();
    expect(orchestrator.getCommand('test:model-policy')).toBeDefined();
    expect(orchestrator.getCommand('test:prompt-assembler')).toBeDefined();
    expect(orchestrator.getCommand('test:grounding')).toBeDefined();
    expect(orchestrator.getCommand('test:tool-truth')).toBeDefined();
    expect(orchestrator.getCommand('test:feedback')).toBeDefined();
    expect(orchestrator.getCommand('test:chat-diagnostics')).toBeDefined();
    expect(orchestrator.getCommand('eval:chat:smoke')).toBeDefined();
    expect(orchestrator.getCommand('eval:chat:full')).toBeDefined();
    expect(orchestrator.getCommand('eval:retrieval')).toBeDefined();
    expect(orchestrator.getCommand('eval:datasets')).toBeDefined();
  });

  it('rejects fake/mock/trivial commands', () => {
    const orchestrator = new VerificationCommandsOrchestrator();

    expect(orchestrator.validateNonFakeCommand('test:chat-runtime', 'echo "passed"')).toBe(false);
    expect(orchestrator.validateNonFakeCommand('test:chat-runtime', 'exit 0')).toBe(false);
    expect(orchestrator.validateNonFakeCommand('test:chat-runtime', 'jest src/core/chat --runInBand')).toBe(true);
  });

  it('audits all canonical commands as valid and non-fake', () => {
    const orchestrator = new VerificationCommandsOrchestrator();
    const audit = orchestrator.auditAllCommands();

    expect(audit.total).toBe(16);
    expect(audit.valid).toBe(16);
    expect(audit.invalid).toHaveLength(0);
  });
});
