import { describe, it, expect } from '@jest/globals';
import { MemoryKnowledgeArbiter } from '../MemoryKnowledgeArbiter';
import { InformationPayload } from '../../../types/memory-knowledge-table';

describe('MemoryKnowledgeArbiter (§52)', () => {
  const arbiter = new MemoryKnowledgeArbiter();

  it('should verify all 9 canonical decision table entries exist', () => {
    expect(MemoryKnowledgeArbiter.CANONICAL_DECISION_TABLE).toHaveLength(9);
    const classes = MemoryKnowledgeArbiter.CANONICAL_DECISION_TABLE.map((e) => e.storageClass);
    expect(classes).toContain('conversation_variable');
    expect(classes).toContain('user_memory');
    expect(classes).toContain('project_evidence');
    expect(classes).toContain('knowledge_pack');
    expect(classes).toContain('conversation_history');
    expect(classes).toContain('project_memory');
    expect(classes).toContain('developer_qa');
    expect(classes).toContain('tool_ledger');
    expect(classes).toContain('feedback_store');
  });

  it('should approve valid conversation_variable payload without requiring user consent', () => {
    const payload: InformationPayload = {
      id: 'p-1',
      content: "I'm using Godot 4.7 for current project",
      sourceType: 'user_turn',
      targetStorageClass: 'conversation_variable',
    };
    const decision = arbiter.arbitrate(payload);
    expect(decision.isAuthorized).toBe(true);
    expect(decision.approvedStorageClass).toBe('conversation_variable');
  });

  it('should enforce consent for user_memory', () => {
    const withoutConsent: InformationPayload = {
      id: 'p-2',
      content: 'Always format code with 2 spaces',
      sourceType: 'user_explicit_preference',
      targetStorageClass: 'user_memory',
    };
    const decision1 = arbiter.arbitrate(withoutConsent);
    expect(decision1.isAuthorized).toBe(false);
    expect(decision1.rejectionReason).toContain('requires explicit user consent');

    const withConsent: InformationPayload = {
      ...withoutConsent,
      metadata: { userConsented: true },
    };
    const decision2 = arbiter.arbitrate(withConsent);
    expect(decision2.isAuthorized).toBe(true);
  });

  it('should reject assistant_message written to canonical knowledge_pack', () => {
    const payload: InformationPayload = {
      id: 'p-3',
      content: 'Antigravity IDE supports TypeScript 5.5',
      sourceType: 'assistant_message',
      targetStorageClass: 'knowledge_pack',
    };
    const decision = arbiter.arbitrate(payload);
    expect(decision.isAuthorized).toBe(false);
    expect(decision.approvedStorageClass).toBe('conversation_history');
    expect(decision.rejectionReason).toContain('Violation of §52');
  });

  it('should reject tool_execution_failure written to user_memory', () => {
    const payload: InformationPayload = {
      id: 'p-4',
      content: 'Compilation failed with exit code 1',
      sourceType: 'tool_execution_failure',
      targetStorageClass: 'user_memory',
      metadata: { userConsented: true },
    };
    const decision = arbiter.arbitrate(payload);
    expect(decision.isAuthorized).toBe(false);
    expect(decision.approvedStorageClass).toBe('tool_ledger');
    expect(decision.rejectionReason).toContain('tool ledger');
  });

  it('should reject thumbs_down feedback written to knowledge_pack', () => {
    const payload: InformationPayload = {
      id: 'p-5',
      content: 'Response contained inaccurate syntax',
      sourceType: 'thumbs_down',
      targetStorageClass: 'knowledge_pack',
    };
    const decision = arbiter.arbitrate(payload);
    expect(decision.isAuthorized).toBe(false);
    expect(decision.approvedStorageClass).toBe('feedback_store');
    expect(decision.rejectionReason).toContain('feedback_store');
  });
});
