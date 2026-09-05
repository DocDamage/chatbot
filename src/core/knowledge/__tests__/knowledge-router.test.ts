/**
 * Knowledge Router Integration Tests & Phase 08 Exit Gate (§1859-1865)
 */

import { KnowledgeRouter } from '../KnowledgeRouter';
import { KnowledgePackManager } from '../KnowledgePackManager';

describe('Knowledge Router & Phase 08 Exit Gate', () => {
  let router: KnowledgeRouter;
  let packManager: KnowledgePackManager;

  beforeEach(() => {
    packManager = new KnowledgePackManager();
    router = new KnowledgeRouter(packManager);
  });

  it('Exit Gate Criterion 1: Coding queries do not search Wikipedia / general-knowledge by default (§1861)', () => {
    const decision = router.route('coding');
    expect(decision.selectedPacks).toContain('core-official-docs');
    expect(decision.candidatePacks).not.toContain('general-knowledge');
    expect(decision.candidatePacks).not.toContain('encyclopedia-core');

    const debugDecision = router.route('coding_debug');
    expect(debugDecision.candidatePacks).toContain('core-official-docs');
    expect(debugDecision.candidatePacks).toContain('developer-qa');
    expect(debugDecision.candidatePacks).not.toContain('general-knowledge');
  });

  it('Exit Gate Criterion 2: General questions do not search code corpora by default (§1862)', () => {
    const decision = router.route('general');
    expect(decision.candidatePacks).toContain('general-knowledge');
    expect(decision.candidatePacks).not.toContain('core-official-docs');
    expect(decision.candidatePacks).not.toContain('curated-code');
    expect(decision.candidatePacks).not.toContain('developer-qa');

    const historyDecision = router.route('history');
    expect(historyDecision.candidatePacks).toContain('general-knowledge');
    expect(historyDecision.candidatePacks).not.toContain('curated-code');
  });

  it('Exit Gate Criterion 3: Pack routing is testable, observable, and records telemetry (§1863)', () => {
    const decision = router.route('math');
    expect(decision.domain).toBe('math');
    expect(decision.telemetry).toBeDefined();
    expect(decision.telemetry.domain).toBe('math');
    expect(decision.telemetry.durationMs).toBeGreaterThanOrEqual(0);
    expect(decision.telemetry.requestedPacks).toContain('math');
    expect(decision.telemetry.resolvedPacks).toContain('math');
  });

  it('Exit Gate Criterion 4: User no-online preference is strictly respected (§1864)', () => {
    // coding_debug allows online fallback by default
    const defaultDebug = router.route('coding_debug');
    expect(defaultDebug.allowWeb).toBe(true);

    // User explicitly sets noOnline: true
    const offlineDebug = router.route('coding_debug', {
      mode: 'custom',
      noOnline: true,
    });
    expect(offlineDebug.allowWeb).toBe(false);
    expect(offlineDebug.telemetry.noOnlinePreference).toBe(true);
  });

  it('Exit Gate Criterion 5: Pack readiness handles missing/disabled packs gracefully without crashing (§1840-1848)', () => {
    // Route when no datasets are installed
    const decision = router.route('coding', undefined, []);
    expect(decision.selectedPacks).toHaveLength(0);
    expect(decision.unavailablePacks).toContain('core-official-docs');
    expect(decision.telemetry.missingPacks).toContain('core-official-docs');

    // Disable pack and verify it gets flagged as unavailable
    packManager.setEnabled('core-official-docs', false);
    const disabledDecision = router.route('coding');
    expect(disabledDecision.selectedPacks).not.toContain('core-official-docs');
    expect(disabledDecision.unavailablePacks).toContain('core-official-docs');
  });

  it('User overrides customize pack selection while preserving valid packs (§1825-1839)', () => {
    const overrideDecision = router.route('general', {
      mode: 'custom',
      includePacks: ['research'],
      excludePacks: ['educational-web'],
    }, ['encyclopedia-core', 'arxiv-summaries']);

    expect(overrideDecision.overridesApplied).toBe(true);
    expect(overrideDecision.selectedPacks).toContain('research');
    expect(overrideDecision.selectedPacks).not.toContain('educational-web');
  });
});
