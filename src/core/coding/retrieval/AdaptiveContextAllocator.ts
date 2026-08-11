import { ContextEvidence } from '../types';

export interface ContextAllocationInput { modelContextTokens: number; outputTokens: number; intent: string; evidence: ContextEvidence[]; repositorySize: number; errorCount?: number; }
export interface AllocatedContext { tokenBudget: number; estimatedTokens: number; items: ContextEvidence[]; budgets: Record<string, number>; }

export class AdaptiveContextAllocator {
  allocate(input: ContextAllocationInput): AllocatedContext {
    const tokenBudget = Math.max(256, input.modelContextTokens - input.outputTokens);
    const budgets: Record<string, number> = { request: 0.08, instruction: 0.12, architecture: 0.08, source: 0.28, symbol: 0.16, test: 0.14, dependency: 0.06, diff: 0.06, diagnostic: 0.12, documentation: 0.04 };
    if (input.errorCount) { budgets.diagnostic += 0.1; budgets.source -= 0.05; budgets.test -= 0.05; }
    if (input.repositorySize > 1000) { budgets.architecture += 0.08; budgets.source -= 0.08; }
    const ranked = [...input.evidence].sort((a, b) => {
      const mandatory = (kind: string) => kind === 'request' || kind === 'instruction' || kind === 'diagnostic';
      return Number(mandatory(b.kind)) - Number(mandatory(a.kind)) || b.confidence - a.confidence;
    });
    const items: ContextEvidence[] = [];
    let used = 0;
    for (const evidence of ranked) {
      if (used >= tokenBudget) break;
      const allowance = Math.max(1, Math.floor(tokenBudget * (budgets[evidence.kind] || 0.04)));
      const current = Math.ceil(evidence.content.length / 4);
      const remaining = tokenBudget - used;
      const tokens = Math.min(current, allowance, remaining);
      if (tokens <= 0) continue;
      items.push({ ...evidence, content: evidence.content.slice(0, tokens * 4) });
      used += tokens;
    }
    return { tokenBudget, estimatedTokens: used, items, budgets };
  }
}
