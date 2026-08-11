import { WorkMode, normalizeWorkMode } from '../../modes/ExecutionModePolicy';

export type CodingAction = 'inspect' | 'plan' | 'create_patch' | 'apply_patch' | 'run_verification' | 'repair' | 'execute_code';
export interface CodingAuthorizationRecord { requestId: string; mode: WorkMode; action: CodingAction; approved: boolean; reason: string; createdAt: string; }

const allowed: Record<WorkMode, CodingAction[]> = {
  plan: ['inspect', 'plan'],
  implement: ['inspect', 'plan', 'create_patch', 'apply_patch', 'run_verification'],
  debug: ['inspect', 'plan', 'run_verification', 'repair'],
  chat: ['inspect']
};

export class CodingAuthorization {
  authorize(input: { requestId?: string; mode?: string; action: CodingAction; explicitApproval?: boolean }): CodingAuthorizationRecord {
    const mode = normalizeWorkMode(input.mode);
    const policyAllows = allowed[mode].includes(input.action);
    const requiresApproval = input.action === 'apply_patch' || input.action === 'execute_code' || input.action === 'repair';
    const approved = policyAllows && (!requiresApproval || input.explicitApproval === true);
    const reason = !policyAllows ? `Action ${input.action} is not allowed in ${mode} mode` : approved ? 'Authorized by coding mode policy and approval state' : `Action ${input.action} requires explicit approval`;
    return { requestId: input.requestId || `coding-${Date.now()}`, mode, action: input.action, approved, reason, createdAt: new Date().toISOString() };
  }

  assert(record: CodingAuthorizationRecord): void { if (!record.approved) throw new Error(record.reason); }
}
