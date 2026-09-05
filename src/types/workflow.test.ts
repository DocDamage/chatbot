import {
  workflowStepTypeSchema,
  workflowDefinitionSchema,
  toolApprovalBindingSchema,
  workflowExecutionStateSchema,
  WorkflowDefinition,
} from './workflow';

describe('Workflow Schemas (CRK-P04-T01)', () => {
  it('validates all 9 canonical step types (§1120-1129)', () => {
    const expectedTypes = [
      'capture-variable',
      'retrieve-knowledge',
      'call-model',
      'call-tool',
      'condition',
      'approval',
      'verify',
      'emit',
      'end',
    ];
    for (const t of expectedTypes) {
      expect(workflowStepTypeSchema.parse(t)).toBe(t);
    }
    expect(() => workflowStepTypeSchema.parse('invalid-type')).toThrow();
  });

  it('validates a complete WorkflowDefinition', () => {
    const wf: WorkflowDefinition = {
      id: 'wf-coding-test',
      version: 1,
      name: 'Test Workflow',
      description: 'Workflow for unit testing',
      intents: ['code_build'],
      startStep: 'step-1',
      steps: {
        'step-1': {
          id: 'step-1',
          type: 'capture-variable',
          name: 'Capture Goal',
          config: { variable: 'userGoal' },
          nextStepId: 'step-2',
          transitions: [],
        },
        'step-2': {
          id: 'step-2',
          type: 'end',
          name: 'Finish',
          config: {},
          transitions: [],
        },
      },
    };

    const parsed = workflowDefinitionSchema.parse(wf);
    expect(parsed.id).toBe('wf-coding-test');
    expect(parsed.steps['step-1'].type).toBe('capture-variable');
  });

  it('validates tool approval binding schema (§1192-1202)', () => {
    const binding = {
      stepId: 'step-approval',
      operation: 'file_edit',
      toolName: 'apply_patch',
      inputHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      targetPaths: ['src/index.ts'],
      allowedSideEffects: ['modify_file'],
      approvalToken: 'token-abc-123',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    };

    const parsed = toolApprovalBindingSchema.parse(binding);
    expect(parsed.operation).toBe('file_edit');
    expect(parsed.toolName).toBe('apply_patch');
  });

  it('validates workflow execution state lifecycle', () => {
    const state = {
      sessionId: 'sess-123',
      workflowId: 'wf-coding-test',
      version: 1,
      activeStepId: 'step-1',
      status: 'running' as const,
      stepOutputs: {},
      approvals: {},
      failures: [],
      cancelled: false,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const parsed = workflowExecutionStateSchema.parse(state);
    expect(parsed.status).toBe('running');
    expect(parsed.cancelled).toBe(false);
  });
});
