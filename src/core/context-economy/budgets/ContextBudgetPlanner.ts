/**
 * Context Budget Planner & Token Allocator (PX-03 / PX03-T07)
 * Allocates available token window across instructions, user query, conversation turns,
 * project memory, repository structure, exact code evidence, and response reserve.
 */

export interface TokenBudgetAllocation {
  totalWindowTokens: number;
  instructionsTokens: number;
  responseReserveTokens: number;
  toolsTokens: number;
  availableForContext: number;
  allocated: {
    userQuery: number;
    recentTurns: number;
    projectMemory: number;
    repoStructure: number;
    codeEvidence: number;
    diagnostics: number;
  };
  droppedItems: Array<{ item: string; reason: string; tokensSaved: number }>;
}

export interface ContextItem {
  id: string;
  category: 'user_query' | 'recent_turns' | 'project_memory' | 'repo_structure' | 'code_evidence' | 'diagnostics';
  content: string;
  estimatedTokens: number;
  priority: number; // 1 = highest, 10 = lowest
}

export class ContextBudgetPlanner {
  public static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4); // Standard approximation: 1 token ~ 4 chars
  }

  public static planBudget(params: {
    totalWindowTokens: number;
    systemPrompt: string;
    toolSchemasText: string;
    responseReserveTokens?: number;
    items: ContextItem[];
  }): TokenBudgetAllocation {
    const totalWindow = params.totalWindowTokens;
    const responseReserve = params.responseReserveTokens || 2048;
    const instructionsTokens = this.estimateTokens(params.systemPrompt);
    const toolsTokens = this.estimateTokens(params.toolSchemasText);

    const availableForContext = Math.max(
      0,
      totalWindow - instructionsTokens - toolsTokens - responseReserve
    );

    let remainingBudget = availableForContext;
    const allocated = {
      userQuery: 0,
      recentTurns: 0,
      projectMemory: 0,
      repoStructure: 0,
      codeEvidence: 0,
      diagnostics: 0
    };

    const droppedItems: Array<{ item: string; reason: string; tokensSaved: number }> = [];

    // Sort items by priority (ascending: 1 comes first)
    const sorted = params.items.slice().sort((a, b) => a.priority - b.priority);

    for (const item of sorted) {
      if (item.estimatedTokens <= remainingBudget) {
        remainingBudget -= item.estimatedTokens;
        if (item.category === 'user_query') allocated.userQuery += item.estimatedTokens;
        else if (item.category === 'recent_turns') allocated.recentTurns += item.estimatedTokens;
        else if (item.category === 'project_memory') allocated.projectMemory += item.estimatedTokens;
        else if (item.category === 'repo_structure') allocated.repoStructure += item.estimatedTokens;
        else if (item.category === 'code_evidence') allocated.codeEvidence += item.estimatedTokens;
        else if (item.category === 'diagnostics') allocated.diagnostics += item.estimatedTokens;
      } else {
        droppedItems.push({
          item: item.id,
          reason: `Insufficient context budget (required ${item.estimatedTokens} tokens, only ${remainingBudget} remaining)`,
          tokensSaved: item.estimatedTokens
        });
      }
    }

    return {
      totalWindowTokens: totalWindow,
      instructionsTokens,
      responseReserveTokens: responseReserve,
      toolsTokens,
      availableForContext,
      allocated,
      droppedItems
    };
  }
}
