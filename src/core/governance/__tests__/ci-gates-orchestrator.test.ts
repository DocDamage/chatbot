import { CIGatesOrchestrator } from '../CIGatesOrchestrator';

describe('CIGatesOrchestrator (§48)', () => {
  let orchestrator: CIGatesOrchestrator;

  beforeEach(() => {
    orchestrator = new CIGatesOrchestrator();
  });

  it('registers all 13 PR CI gates and 5 release-only gates', () => {
    const prGates = orchestrator.listGates('pr');
    const releaseGates = orchestrator.listGates('release_only');

    expect(prGates).toHaveLength(13);
    expect(releaseGates).toHaveLength(5);
  });

  it('runs all PR gates successfully in nominal conditions', async () => {
    const report = await orchestrator.runPipeline('pr');

    expect(report.totalGates).toBe(13);
    expect(report.passedCount).toBe(13);
    expect(report.failedCount).toBe(0);
    expect(report.allPassed).toBe(true);
    expect(report.blockedByDownloadViolation).toBe(false);
  });

  it('strictly blocks PR CI if an external dataset download is attempted (§48 invariant)', async () => {
    const report = await orchestrator.runPipeline('pr', {
      downloadAttemptGate: 'knowledge-adapter-fixtures'
    });

    expect(report.allPassed).toBe(false);
    expect(report.failedCount).toBe(1);
    expect(report.blockedByDownloadViolation).toBe(true);

    const failedGate = report.results.find((r) => r.gate === 'knowledge-adapter-fixtures');
    expect(failedGate?.passed).toBe(false);
    expect(failedGate?.violation).toBe('PR_CI_EXTERNAL_DOWNLOAD_PROHIBITED');
  });

  it('executes release-only pipeline', async () => {
    const report = await orchestrator.runPipeline('release_only');

    expect(report.totalGates).toBe(5);
    expect(report.passedCount).toBe(5);
    expect(report.allPassed).toBe(true);
  });
});
