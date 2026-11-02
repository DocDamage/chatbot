import { describe, expect, it, beforeEach } from '@jest/globals';
import { ApprovalPolicy } from '../ApprovalPolicy';

describe('RT-PLAT-005 / RT-SEC-006: ApprovalPolicy Action Evaluation Suite', () => {
  let policy: ApprovalPolicy;

  beforeEach(() => {
    policy = new ApprovalPolicy({
      defaultLevel: 'on-request',
      requestTimeout: 1000
    });
  });

  it('determines if actions require approval based on patterns and levels', () => {
    policy.setApprovalLevel('write:file', 'untrusted');
    policy.setApprovalLevel('safe:log', 'never');

    expect(policy.needsApproval('write:file')).toBe(true);
    expect(policy.needsApproval('safe:log')).toBe(false);
  });

  it('handles approval request creation, responses, and handlers', async () => {
    policy.registerHandler(async (req) => {
      return req.risk === 'low';
    });

    const lowRiskApproved = await policy.requestApproval(
      'deploy:dev',
      'Deploy to dev container',
      { environment: 'dev' }
    );
    expect(lowRiskApproved).toBe(true);

    const history = policy.getHistory();
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].action).toBe('deploy:dev');
  });
});
