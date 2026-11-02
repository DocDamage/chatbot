import { describe, it, expect } from '@jest/globals';
import { ProhibitedShortcutsDetector } from '../ProhibitedShortcutsDetector';

describe('ProhibitedShortcutsDetector (§62)', () => {
  it('defines all 20 prohibited shortcuts with descriptions and remediations', () => {
    const keys = Object.keys(ProhibitedShortcutsDetector.SHORTCUT_DEFINITIONS);
    expect(keys).toHaveLength(20);

    for (const key of keys) {
      const def = ProhibitedShortcutsDetector.SHORTCUT_DEFINITIONS[key as keyof typeof ProhibitedShortcutsDetector.SHORTCUT_DEFINITIONS];
      expect(def.description.length).toBeGreaterThan(10);
      expect(def.remediation.length).toBeGreaterThan(10);
    }
  });

  it('detects violations and provides exact remediation guidance', () => {
    const detector = new ProhibitedShortcutsDetector();
    const violations = detector.detectViolations(
      {
        FORWARD_ONLY_SHIM: true,
        PRIVATE_COT_IN_DIAGNOSTICS: true,
        LOWERED_EVAL_THRESHOLDS: true,
      },
      {
        FORWARD_ONLY_SHIM: 'src/core/chat/ChatRuntime.ts',
        PRIVATE_COT_IN_DIAGNOSTICS: 'src/core/diagnostics/ChatRunRepository.ts',
      }
    );

    expect(violations).toHaveLength(3);
    expect(violations[0].code).toBe('FORWARD_ONLY_SHIM');
    expect(violations[0].affectedComponent).toBe('src/core/chat/ChatRuntime.ts');
    expect(violations[1].code).toBe('PRIVATE_COT_IN_DIAGNOSTICS');
    expect(violations[1].affectedComponent).toBe('src/core/diagnostics/ChatRunRepository.ts');
    expect(violations[2].code).toBe('LOWERED_EVAL_THRESHOLDS');
    expect(violations[2].affectedComponent).toBe('Canonical System Component');
  });

  it('returns empty violations when no prohibited shortcuts are present', () => {
    const detector = new ProhibitedShortcutsDetector();
    const violations = detector.detectViolations({});
    expect(violations).toHaveLength(0);
  });
});
