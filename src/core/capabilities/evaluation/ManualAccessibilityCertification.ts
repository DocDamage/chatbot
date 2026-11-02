/**
 * Manual Accessibility Certification (PX21-T10)
 * Evaluates WCAG 2.1 AA and manual accessibility standards across:
 * - Keyboard-only navigation & focus trap prevention
 * - NVDA / Windows narrator screen reader baseline
 * - 200% Zoom and reflow without content truncation
 * - High contrast / forced colors compliance
 * - Reduced motion preference honoring (prefers-reduced-motion)
 * - Non-visual alternatives for graphs, canvas, audio waveforms, and sprite previews
 * - Accessible errors, progress live regions (aria-live), and approval prompts
 * - Caption and transcript availability for audio/video lessons
 */

export interface AccessibilityCheckItem {
  id: string;
  criterion: string;
  category: 'keyboard' | 'screen_reader' | 'visual' | 'nonvisual_alternatives' | 'captions';
  passed: boolean;
  notes: string;
}

export class ManualAccessibilityCertification {
  private static instance: ManualAccessibilityCertification;

  public static getInstance(): ManualAccessibilityCertification {
    if (!ManualAccessibilityCertification.instance) {
      ManualAccessibilityCertification.instance = new ManualAccessibilityCertification();
    }
    return ManualAccessibilityCertification.instance;
  }

  public getCertificationResults(evidence: Record<string, string> = {}): { passed: boolean; score: number; checks: AccessibilityCheckItem[] } {
    const definitions: Array<Pick<AccessibilityCheckItem, 'id' | 'criterion' | 'category'>> = [
      { id: 'A11Y-KEYBOARD-001', criterion: 'Full keyboard tab sequence & visible focus rings across all studio panels', category: 'keyboard' },
      { id: 'A11Y-SCREENREADER-001', criterion: 'NVDA screen reader announcements for async job progress & dynamic approvals', category: 'screen_reader' },
      { id: 'A11Y-ZOOM-001', criterion: '200% zoom and reflow without horizontal scrolling or clipping', category: 'visual' },
      { id: 'A11Y-NONVISUAL-001', criterion: 'Accessible textual tables & outlines alongside SVG graphs/sprites', category: 'nonvisual_alternatives' },
      { id: 'A11Y-CAPTIONS-001', criterion: 'Accurate WebVTT captions & text transcripts for synthesized audio', category: 'captions' }
    ];
    const checks = definitions.map(definition => ({
      ...definition,
      passed: Boolean(evidence[definition.id]?.trim()),
      notes: evidence[definition.id]?.trim() || 'NOT_RUN: signed manual accessibility evidence is required.'
    }));

    const passedCount = checks.filter(c => c.passed).length;
    return {
      passed: passedCount === checks.length,
      score: checks.length > 0 ? Number((passedCount / checks.length).toFixed(2)) : 0,
      checks
    };
  }
}
