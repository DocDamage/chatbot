import { ProcessTreeSupervisor } from '../../coding/teams/ProcessTreeSupervisor';
import { AgentTeamCoordinator } from '../../coding/teams/AgentTeamCoordinator';

describe('RT-AGENT-001..002 — Agent Operations, Process Trees, and Communication Isolation Suite', () => {
  describe('RT-AGENT-002: Process Tree Supervision and Cancellation', () => {
    it('executes process within timeout boundary and cleans up process tree on termination', async () => {
      const supervisor = new ProcessTreeSupervisor();
      const result = await supervisor.executeCommand(process.execPath, ['-e', 'console.log("agent worker output")'], {
        cwd: process.cwd(),
        timeoutMs: 5000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('agent worker output');
      expect(result.timedOut).toBe(false);
      expect(result.outputDigest).toBeDefined();
    });

    it('terminates process tree when execution exceeds deadline', async () => {
      const supervisor = new ProcessTreeSupervisor();
      const result = await supervisor.executeCommand(
        process.execPath,
        ['-e', 'setInterval(() => {}, 1000)'],
        {
          cwd: process.cwd(),
          timeoutMs: 150,
        }
      );

      expect(result.timedOut).toBe(true);
      expect(result.killedBySupervisor).toBe(true);
    });
  });
});
