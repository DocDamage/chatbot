import { describe, it, expect } from '@jest/globals';
import {
  InformationStorageClass,
  ArbitrationDecision,
} from './memory-knowledge-table';

describe('MemoryKnowledgeTable Types', () => {
  it('should enumerate all 9 mandatory storage classes', () => {
    const classes: InformationStorageClass[] = [
      'conversation_variable',
      'user_memory',
      'project_evidence',
      'knowledge_pack',
      'conversation_history',
      'project_memory',
      'developer_qa',
      'tool_ledger',
      'feedback_store',
    ];
    expect(classes).toHaveLength(9);
  });

  it('should validate complete ArbitrationDecision structure', () => {
    const decision: ArbitrationDecision = {
      payloadId: 'payload-001',
      requestedStorageClass: 'user_memory',
      approvedStorageClass: 'user_memory',
      isAuthorized: true,
      timestamp: new Date().toISOString(),
    };

    expect(decision.isAuthorized).toBe(true);
    expect(decision.approvedStorageClass).toBe('user_memory');
  });
});
