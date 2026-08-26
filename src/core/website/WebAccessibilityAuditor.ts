/**
 * Phase PX-16: Website Accessibility Auditor
 * PX16-T10 / PX16-T12
 */

import { WebsiteProjectSchema, WebAuditReport, WebAuditIssue } from './WebsiteTypes';
import { ElementInspectorService } from './ElementInspectorService';

export class WebAccessibilityAuditor {
  private inspector = new ElementInspectorService();

  public auditProject(project: WebsiteProjectSchema): WebAuditReport {
    const issues: WebAuditIssue[] = [];
    let totalChecks = 0;
    let passedChecks = 0;

    // Check 1: Color Contrast of Theme
    totalChecks++;
    const fg = project.theme.colors.foreground || '#f8fafc';
    const bg = project.theme.colors.background || '#0a0a0c';
    const contrast = this.inspector.calculateContrast(fg, bg);
    if (!contrast.passesAA) {
      issues.push({
        ruleId: 'wcag-contrast-minimum',
        severity: 'error',
        message: `Theme foreground (${fg}) and background (${bg}) have contrast ratio ${contrast.ratio}:1, failing WCAG AA (4.5:1 minimum).`,
        wcagCriterion: '1.4.3 Contrast (Minimum)'
      });
    } else {
      passedChecks++;
    }

    for (const page of project.pages) {
      // Check 2: Page Title
      totalChecks++;
      if (!page.title || page.title.trim().length === 0) {
        issues.push({
          ruleId: 'wcag-page-titled',
          severity: 'error',
          message: `Page '${page.slug}' is missing a descriptive title.`,
          wcagCriterion: '2.4.2 Page Titled'
        });
      } else {
        passedChecks++;
      }

      // Check 3: Headings Hierarchy (At least one h1 on page)
      totalChecks++;
      const hasHeroOrH1 = page.blocks.some(b => b.type === 'hero' || b.title);
      if (!hasHeroOrH1) {
        issues.push({
          ruleId: 'wcag-heading-structure',
          severity: 'warning',
          message: `Page '${page.slug}' has no primary heading block.`,
          wcagCriterion: '1.3.1 Info and Relationships'
        });
      } else {
        passedChecks++;
      }

      // Check 4: Image Alt Text
      for (const block of page.blocks) {
        if (block.imageUrl) {
          totalChecks++;
          if (!block.imageAlt || block.imageAlt.trim().length === 0) {
            issues.push({
              ruleId: 'wcag-non-text-content',
              severity: 'error',
              blockId: block.id,
              message: `Block '${block.id}' has image without alt text.`,
              wcagCriterion: '1.1.1 Non-text Content'
            });
          } else {
            passedChecks++;
          }
        }

        // Check 5: Link Labels
        if (block.links) {
          for (const link of block.links) {
            totalChecks++;
            if (!link.label || link.label.trim().length === 0) {
              issues.push({
                ruleId: 'wcag-link-purpose',
                severity: 'error',
                blockId: block.id,
                message: `Block '${block.id}' has a link missing descriptive anchor text.`,
                wcagCriterion: '2.4.4 Link Purpose'
              });
            } else {
              passedChecks++;
            }
          }
        }
      }
    }

    const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;

    return {
      score,
      passedChecks,
      totalChecks,
      issues,
      timestamp: new Date().toISOString()
    };
  }
}
