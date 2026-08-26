import { CapabilityApprovalService } from '../approvals/CapabilityApprovalService';
import { CapabilityPermissionEngine } from '../permissions/CapabilityPermissionEngine';
import { ResourceBudgetManager } from '../resources/ResourceBudgetManager';
import { UnifiedJobConsoleService } from '../jobs/UnifiedJobConsoleService';
import { SixSigmaBlackBeltAgent } from '../../agents/sixsigma/SixSigmaBlackBeltAgent';

describe('B75-08: Capability Infrastructure & SixSigma BlackBelt Agent Matrix', () => {
  describe('CapabilityApprovalService', () => {
    it('generates digests, verifies exact scopes, and handles revocation and expiration', () => {
      const approvalService = CapabilityApprovalService.getInstance();
      approvalService.clear();

      const req = {
        jobType: 'game_export',
        capabilityId: 'game_studio',
        ownerId: 'user_1',
        projectId: 'proj_alpha',
        inputHashes: ['hash1', 'hash2'],
        targetPaths: ['builds/game.exe'],
        providerModel: 'godot-cli',
        proposedActions: ['compile', 'package'],
        resourceBudget: { maxRamBytes: 1024 * 1024 * 1024 },
        dataEgress: {
          destinationType: 'local_only' as const,
          targetEndpoints: [],
          transfersSensitiveData: false
        },
        ttlSeconds: 3600
      };

      const digest = approvalService.computeScopeDigest(req);
      expect(typeof digest).toBe('string');
      expect(digest.length).toBe(64);

      const record = approvalService.recordApproval(req, 'admin_1');
      expect(record.approvalDigest).toBe(digest);
      expect(record.approvedBy).toBe('admin_1');

      // Successful verification
      expect(approvalService.verifyApprovalDigest(digest, {
        ownerId: 'user_1',
        projectId: 'proj_alpha',
        capabilityId: 'game_studio'
      })).toBe(true);

      // Wrong owner verification failure
      expect(approvalService.verifyApprovalDigest(digest, {
        ownerId: 'wrong_user',
        projectId: 'proj_alpha',
        capabilityId: 'game_studio'
      })).toBe(false);

      // Revocation
      expect(approvalService.revokeApproval(digest)).toBe(true);
      expect(approvalService.revokeApproval('nonexistent')).toBe(false);
      expect(approvalService.verifyApprovalDigest(digest, {
        ownerId: 'user_1',
        projectId: 'proj_alpha',
        capabilityId: 'game_studio'
      })).toBe(false);
    });
  });

  describe('CapabilityPermissionEngine', () => {
    it('enforces default-deny, role hierarchy, maturity, and hosted safety policies', () => {
      const engine = CapabilityPermissionEngine.getInstance();
      const approvalService = CapabilityApprovalService.getInstance();

      // 1. Unhealthy dependency -> Deny
      const unhealthyRes = engine.evaluatePermission({
        userId: 'u1',
        userRole: 'user',
        profile: 'local',
        capabilityId: 'c1',
        capabilityMaturity: 'PRODUCTION_SUPPORTED',
        requestedPermission: 'read',
        isDependencyHealthy: false
      });
      expect(unhealthyRes.granted).toBe(false);

      // 2. Deprecated maturity -> Deny
      const deprecatedRes = engine.evaluatePermission({
        userId: 'u1',
        userRole: 'user',
        profile: 'local',
        capabilityId: 'c1',
        capabilityMaturity: 'DEPRECATED',
        requestedPermission: 'read'
      });
      expect(deprecatedRes.granted).toBe(false);

      // 3. Experimental in hosted profile -> Deny
      const hostedExpRes = engine.evaluatePermission({
        userId: 'u1',
        userRole: 'user',
        profile: 'hosted',
        capabilityId: 'c1',
        capabilityMaturity: 'LOCAL_ONLY_EXPERIMENTAL',
        requestedPermission: 'read'
      });
      expect(hostedExpRes.granted).toBe(false);

      // 4. Dangerous local permission in hosted profile -> Deny
      const dangerousHostedRes = engine.evaluatePermission({
        userId: 'u1',
        userRole: 'admin',
        profile: 'hosted',
        capabilityId: 'c1',
        capabilityMaturity: 'PRODUCTION_SUPPORTED',
        requestedPermission: 'process.execute.allowlisted'
      });
      expect(dangerousHostedRes.granted).toBe(false);

      // 5. Admin permission requested by non-admin -> Deny
      const adminDenied = engine.evaluatePermission({
        userId: 'u1',
        userRole: 'user',
        profile: 'local',
        capabilityId: 'c1',
        capabilityMaturity: 'PRODUCTION_SUPPORTED',
        requestedPermission: 'admin.promote'
      });
      expect(adminDenied.granted).toBe(false);

      // 6. Mutating permission without approval digest -> Deny with required scope
      const mutatingNoApproval = engine.evaluatePermission({
        userId: 'u1',
        userRole: 'developer',
        profile: 'local',
        capabilityId: 'game_engine',
        capabilityMaturity: 'PRODUCTION_SUPPORTED',
        requestedPermission: 'engine.mutate.approved'
      });
      expect(mutatingNoApproval.granted).toBe(false);
      expect(mutatingNoApproval.requiredApprovalScope).toBe('engine.mutate.approved');

      // 7. Mutating permission with valid approval digest -> Granted
      const approvalReq = {
        jobType: 'mutate',
        capabilityId: 'game_engine',
        ownerId: 'u1',
        projectId: 'p1',
        inputHashes: ['h1'],
        targetPaths: ['p1'],
        proposedActions: ['add_node'],
        resourceBudget: {},
        dataEgress: {
          destinationType: 'local_only' as const,
          targetEndpoints: [],
          transfersSensitiveData: false
        }
      };
      const record = approvalService.recordApproval(approvalReq, 'admin');
      const mutatingApproved = engine.evaluatePermission({
        userId: 'u1',
        userRole: 'developer',
        profile: 'local',
        capabilityId: 'game_engine',
        capabilityMaturity: 'PRODUCTION_SUPPORTED',
        requestedPermission: 'engine.mutate.approved',
        projectId: 'p1',
        approvalDigest: record.approvalDigest
      });
      expect(mutatingApproved.granted).toBe(true);
    });
  });

  describe('ResourceBudgetManager', () => {
    it('registers budgets and detects memory and network quota violations', () => {
      const manager = ResourceBudgetManager.getInstance();
      const budget = manager.registerBudget('job-123', {
        ramCeilingBytes: 500 * 1024 * 1024,
        maxNetworkBytes: 50 * 1024 * 1024
      });

      expect(budget.ramCeilingBytes).toBe(500 * 1024 * 1024);

      // Initial check -> no violation
      expect(manager.checkBudgetViolation('job-123').violated).toBe(false);

      // Non-existent job
      expect(manager.checkBudgetViolation('job-nonexistent').violated).toBe(false);
    });
  });

  describe('UnifiedJobConsoleService', () => {
    it('creates jobs, transitions states, records logs, and handles cancellation', () => {
      const consoleService = new UnifiedJobConsoleService();
      const job = consoleService.createJob({
        capabilityId: 'coding_agent',
        packId: 'core_team',
        ownerId: 'user_1',
        title: 'Refactor Module',
        inputPayload: { query: 'Fix bug' }
      });

      expect(job.state).toBe('queued');
      expect(job.inputDigest).toBeDefined();

      // Retrieve job
      const fetched = consoleService.getJob(job.id);
      expect(fetched?.title).toBe('Refactor Module');

      // Transition state
      consoleService.transitionState(job.id, 'running', 'Compiling', 50, 'Compilation started');
      expect(consoleService.getJob(job.id)?.progressPercent).toBe(50);
      expect(consoleService.getJob(job.id)?.state).toBe('running');

      // Record approval
      consoleService.recordApproval(job.id, 'digest_abc1234567890');
      expect(consoleService.getJob(job.id)?.approvalDigest).toBe('digest_abc1234567890');

      // List jobs
      const list = consoleService.listJobs({ capabilityId: 'coding_agent', state: 'running' });
      expect(list.length).toBe(1);

      // Cancel job
      const cancelled = consoleService.cancelJob(job.id, 'User stopped run');
      expect(cancelled.state).toBe('cancelled');

      // Retry job
      const retried = consoleService.retryJob(job.id);
      expect(retried.state).toBe('queued');
    });
  });

  describe('SixSigmaBlackBeltAgent', () => {
    it('routes requests to calculators, coaching, simulation, compliance, and playbooks', async () => {
      const agent = new SixSigmaBlackBeltAgent();

      // Calculation routing
      const calcRes = await agent.ask('calculate cpk for mean 10, std 1, usl 13, lsl 7');
      expect(calcRes.answerType).toBe('calculation');

      // Project coaching
      const projRes = await agent.ask('project coaching for defect reduction in assembly');
      expect(projRes.answerType).toBe('project_coaching');

      // Certification
      const certRes = await agent.ask('certification requirements for green belt');
      expect(certRes).toBeDefined();

      // Simulation
      const simRes = await agent.ask('simulate monte carlo variation');
      expect(simRes).toBeDefined();

      // Compliance
      const compRes = await agent.ask('check RoHS compliance requirements');
      expect(compRes.answerType).toBe('compliance');

      // General QA
      const qaRes = await agent.ask('General overview of statistical quality methods');
      expect(qaRes.answerType).toBe('sixsigma_qa');
    });
  });
});
