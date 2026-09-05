/**
 * Context Plan Diagnostics and Observability (CRK-P05-T06)
 *
 * Records structured diagnostics on what context was requested, what was skipped,
 * allocated token budgets, and selection rationale without exposing raw private content.
 */

import { ContextPlan } from '../../types/context-plan';

export interface DiagnosticContextReport {
  requestId: string;
  requestedTypes: string[];
  skippedTypes: Array<{ type: string; reason: string }>;
  tokenBudgets: Record<string, number>;
  selectedPacks: string[];
  knowledgeQueries: Array<{ queryPreview: string; packs: string[] }>;
  rationaleCodes: string[];
  confidence: number;
  timestamp: string;
}

export class ContextPlanDiagnostics {
  public static summarize(plan: ContextPlan): DiagnosticContextReport {
    const requestedTypes = plan.requirements.map(r => r.type);
    const selectedPacks: string[] = [];
    const knowledgeQueries: Array<{ queryPreview: string; packs: string[] }> = [];

    for (const req of plan.requirements) {
      if (req.type === 'knowledge') {
        selectedPacks.push(...req.packs);
        knowledgeQueries.push({
          queryPreview: req.query.length > 30 ? `${req.query.slice(0, 30)}...` : req.query,
          packs: req.packs,
        });
      }
    }

    return {
      requestId: plan.requestId,
      requestedTypes: Array.from(new Set(requestedTypes)),
      skippedTypes: plan.skippedRequirements || [],
      tokenBudgets: plan.tokenBudgets || {
        reserve: plan.answerReserveTokens,
      },
      selectedPacks: Array.from(new Set(selectedPacks)),
      knowledgeQueries,
      rationaleCodes: plan.rationaleCodes,
      confidence: plan.confidence ?? 1.0,
      timestamp: new Date().toISOString(),
    };
  }
}
