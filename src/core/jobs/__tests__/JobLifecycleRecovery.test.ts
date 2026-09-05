import { CapabilityJobService } from '../../capabilities/jobs/CapabilityJobService';
import { DurableRestartRecoveryService } from '../../capabilities/reliability/DurableRestartRecoveryService';
import { DEFAULT_LOCAL_RESOURCE_BUDGET } from '../../capabilities/resources/ResourceBudgetManager';

describe('RT-PLAT-006 — Job Lifecycle and Restart Recovery Suite', () => {
  let jobService: CapabilityJobService;
  let recoveryService: DurableRestartRecoveryService;

  beforeEach(() => {
    jobService = CapabilityJobService.getInstance();
    recoveryService = DurableRestartRecoveryService.getInstance();
  });

  it('creates job in queued state with inputDigest and resource budget', () => {
    const job = jobService.createJob({
      capabilityId: 'cap-video-ocr',
      packId: 'pack-media',
      ownerId: 'user-test-1',
      inputs: { videoPath: '/test/video.mp4' },
      budget: DEFAULT_LOCAL_RESOURCE_BUDGET,
    });

    expect(job.id).toBeDefined();
    expect(job.state).toBe('queued');
    expect(job.inputDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(job.progressPercent).toBe(0);
  });

  it('executes staged workflow and records progress events', async () => {
    const job = jobService.createJob({
      capabilityId: 'cap-stt',
      packId: 'pack-voice',
      ownerId: 'user-test-2',
      inputs: { audio: 'sample.wav' },
    });

    jobService.registerJobStages('cap-stt', [
      {
        name: 'preprocess',
        isIdempotent: true,
        execute: async (_j, progress: (pct: number) => void) => {
          progress(50);
          return { result: 'preprocessed' };
        },
      },
      {
        name: 'transcribe',
        isIdempotent: true,
        execute: async (_j, progress: (pct: number) => void) => {
          progress(100);
          return { result: 'transcript text' };
        },
      },
    ]);

    const completed = await jobService.runJob(job.id);
    expect(completed.state).toBe('succeeded');
    expect(completed.progressPercent).toBe(100);
    expect(completed.events.length).toBeGreaterThan(0);
  });

  it('handles cancellation gracefully and sets terminal state', async () => {
    const job = jobService.createJob({
      capabilityId: 'cap-long-running',
      packId: 'pack-ai',
      ownerId: 'user-test-3',
      inputs: {},
    });

    jobService.registerJobStages('cap-long-running', [
      {
        name: 'stage-1',
        isIdempotent: true,
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return {};
        },
      },
    ]);

    const runPromise = jobService.runJob(job.id);
    jobService.cancelJob(job.id, 'User clicked cancel');
    const result = await runPromise;

    expect(result.state).toBe('cancelled');
    expect(result.failureCategory).toBe('user_cancelled');
  });

  it('recovers abandoned in-flight jobs upon restart', async () => {
    const recoveryReport = await recoveryService.executeStartupRecovery({
      pendingJobs: [
        {
          jobId: 'job-pending-1',
          capabilityId: 'cap-media',
          isIdempotent: true,
          status: 'running',
          payloadSummary: 'video render',
          createdTimestamp: new Date().toISOString(),
        },
      ],
    });

    expect(recoveryReport).toBeDefined();
    expect(recoveryReport.requeuedJobs).toContain('job-pending-1');
  });
});
