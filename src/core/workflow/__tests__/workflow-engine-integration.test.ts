/**
 * Guided Workflow Engine Integration & Exit Gate (CRK-P04-T05 / T06)
 *
 * Verifies all 4 Phase 04 exit gate criteria (§1203-1209):
 * 1. Coding and debug guided workflows exist and execute properly.
 * 2. Normal chat cleanly bypasses the workflow engine when not needed.
 * 3. Cancellation / escape hatch works cleanly without trapping the user.
 * 4. Tool approval remains exact, auditable, and tamper-resistant.
 */

import { WorkflowEngine } from '../WorkflowEngine';
import { WorkflowResolver } from '../WorkflowResolver';
import { WorkflowStateRepository } from '../WorkflowStateRepository';
import { ToolApprovalService } from '../ToolApprovalBinding';
import { codingBuildWorkflowDefinition } from '../definitions/CodingBuildWorkflow';
import { debugWorkflowDefinition } from '../definitions/DebugWorkflow';
import { NormalizedChatRequest, TaskClassificationResult } from '../../../types/chat-runtime';

describe('CRK Phase 04 Exit Gate: Workflow Engine Integration', () => {
  let repository: WorkflowStateRepository;
  let engine: WorkflowEngine;
  let resolver: WorkflowResolver;

  beforeEach(() => {
    repository = new WorkflowStateRepository();
    engine = new WorkflowEngine({ repository });
    resolver = new WorkflowResolver();
  });

  const makeReq = (msg: string, mode?: string): NormalizedChatRequest => ({
    requestId: `req-${Date.now()}-${Math.random()}`,
    sessionId: 'sess-wf-integration',
    message: msg,
    mode,
    botProfileId: 'default',
    loadedFiles: [],
    loadedAudio: [],
    clientCapabilities: { streaming: false, citations: false, toolApproval: false },
    metadata: {},
  });

  // Exit Gate Item 1: Coding/debug guided workflows exist and execute
  it('Exit Gate 1: Coding and debug workflows resolve and execute step sequences', async () => {
    const codingAnalysis: TaskClassificationResult = {
      taskType: 'coding',
      intent: 'coding_build',
      confidence: 0.95,
      heuristicSignals: [],
      requiresTools: true,
      requiresGrounding: true,
    };
    const resolvedCoding = await resolver.resolve(codingAnalysis, makeReq('build feature auth', 'coding_guided'));
    expect(resolvedCoding).toBeDefined();
    expect(resolvedCoding?.workflowId).toBe('wf-coding-build-v1');

    const debugAnalysis: TaskClassificationResult = {
      taskType: 'coding',
      intent: 'debug',
      confidence: 0.95,
      heuristicSignals: [],
      requiresTools: true,
      requiresGrounding: true,
    };
    const resolvedDebug = await resolver.resolve(debugAnalysis, makeReq('debug error null pointer', 'debug_guided'));
    expect(resolvedDebug).toBeDefined();
    expect(resolvedDebug?.workflowId).toBe('wf-debug-v1');

    // Run first step of coding workflow
    const initial = await engine.startWorkflow('sess-wf-integration', codingBuildWorkflowDefinition);
    expect(initial.activeStepId).toBe('step-understand-goal');
    expect(initial.status).toBe('running');

    const step1 = await engine.step('sess-wf-integration', codingBuildWorkflowDefinition);
    expect(step1.completed).toBe(false);
    expect(step1.state.activeStepId).toBe('step-inspect-project');
  });

  // Exit Gate Item 2: Normal chat bypasses workflow engine
  it('Exit Gate 2: Normal chat, casual questions, and general Q&A bypass workflow engine (§1206)', async () => {
    const generalAnalysis: TaskClassificationResult = {
      taskType: 'general_qa',
      intent: 'conversation',
      confidence: 0.9,
      heuristicSignals: [],
      requiresTools: false,
      requiresGrounding: false,
    };

    const result = await resolver.resolve(generalAnalysis, makeReq('What is the capital of France?'));
    expect(result).toBeUndefined(); // Cleanly bypassed!
  });

  // Exit Gate Item 3: Cancellation works and does not trap user
  it('Exit Gate 3: Escape hatch immediately halts workflow and yields to chat (§1180-1190)', async () => {
    await engine.startWorkflow('sess-wf-integration', codingBuildWorkflowDefinition);

    // User triggers escape hatch
    const stepResult = await engine.step('sess-wf-integration', codingBuildWorkflowDefinition, 'cancel');
    expect(stepResult.completed).toBe(true);
    expect(stepResult.state.status).toBe('cancelled');
    expect(stepResult.state.cancelled).toBe(true);
    expect(stepResult.message).toContain('Workflow cancelled');

    const persisted = await repository.getState('sess-wf-integration');
    expect(persisted?.status).toBe('cancelled');
  });

  // Exit Gate Item 4: Tool approval remains exact and auditable
  it('Exit Gate 4: Tool approval is strictly verified against cryptographic input hash (§1191-1202)', () => {
    const payload = { targetFile: 'src/main.ts', edits: [{ line: 5, text: 'console.log("hello");' }] };
    const binding = ToolApprovalService.createBinding({
      stepId: 'step-apply',
      operation: 'modify_file',
      toolName: 'apply_patch',
      inputs: payload,
      targetPaths: ['src/main.ts'],
    });

    // Valid check
    const validCheck = ToolApprovalService.verifyBinding({
      binding,
      operation: 'modify_file',
      toolName: 'apply_patch',
      inputs: payload,
      targetPaths: ['src/main.ts'],
      approvalToken: binding.approvalToken,
    });
    expect(validCheck.valid).toBe(true);

    // Tampered payload
    const invalidCheck = ToolApprovalService.verifyBinding({
      binding,
      operation: 'modify_file',
      toolName: 'apply_patch',
      inputs: { ...payload, edits: [{ line: 5, text: 'rm -rf /' }] },
      targetPaths: ['src/main.ts'],
      approvalToken: binding.approvalToken,
    });
    expect(invalidCheck.valid).toBe(false);
    expect(invalidCheck.reason).toContain('hash mismatch');
  });
});
