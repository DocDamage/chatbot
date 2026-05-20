import { createWorkflowGuidance } from './WorkflowComponent';

describe('createWorkflowGuidance', () => {
  it('returns structured domain guidance for specialist submodules', () => {
    const result = createWorkflowGuidance('security', 'ThreatModeler', 'Review my login flow.');

    expect(result.domain).toBe('security');
    expect(result.component).toBe('ThreatModeler');
    expect(result.intent).toBe('security.threat_modeler');
    expect(result.guidance.join(' ')).toContain('trust boundaries');
    expect(result.artifacts).toContain('verification checklist');
    expect(result.guardrails.join(' ')).toContain('Defensive-only');
  });

  it('falls back safely for unknown domains', () => {
    const result = createWorkflowGuidance('custom', 'CustomPlanner', 'Plan this.');

    expect(result.intent).toBe('custom.custom_planner');
    expect(result.guidance.join(' ')).toContain('Classify the request');
    expect(result.guardrails).toContain('Use domain-specific safety boundaries.');
  });
});
