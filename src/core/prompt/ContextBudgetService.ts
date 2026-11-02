/**
 * Context Budget Service
 * CRK Phase 11: Token Budget Service (CRK-P11-T04)
 */

import { CategoryBudget, TaskContextType, TokenBudgetReport } from '../../types/prompt-assembler';

export interface BudgetConfig {
  maxTokens: number;
  answerReserveRatio?: number;
}

export class ContextBudgetService {
  private static readonly CHARS_PER_TOKEN = 4;

  public static estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / ContextBudgetService.CHARS_PER_TOKEN);
  }

  public static calculateAllocations(
    maxTokens: number,
    taskType: TaskContextType = 'general'
  ): Record<string, CategoryBudget> {
    const percentages = this.getPercentages(taskType);
    const allocations: Record<string, CategoryBudget> = {};

    for (const [category, pct] of Object.entries(percentages)) {
      allocations[category] = {
        allocatedTokens: Math.floor(maxTokens * (pct / 100)),
        usedTokens: 0,
        percentage: pct,
      };
    }

    return allocations;
  }

  private static getPercentages(taskType: TaskContextType): Record<string, number> {
    switch (taskType) {
      case 'coding':
        return {
          system: 10,
          conversation: 15,
          project: 35,
          evidence: 15,
          tools: 10,
          reserve: 15,
        };
      case 'research':
        return {
          system: 10,
          conversation: 15,
          project: 10,
          evidence: 40,
          tools: 10,
          reserve: 15,
        };
      case 'debug':
        return {
          system: 10,
          conversation: 15,
          project: 25,
          evidence: 10,
          tools: 25,
          reserve: 15,
        };
      case 'general':
      default:
        return {
          system: 10,
          conversation: 18,
          project: 22,
          evidence: 25,
          tools: 10,
          reserve: 15,
        };
    }
  }

  public static createReport(
    maxTokens: number,
    allocations: Record<string, CategoryBudget>,
    droppedSections: string[] = [],
    truncatedSections: string[] = []
  ): TokenBudgetReport {
    let totalUsed = 0;
    for (const cat of Object.values(allocations)) {
      totalUsed += cat.usedTokens;
    }

    const reservedTokens = allocations.reserve?.allocatedTokens || Math.floor(maxTokens * 0.15);

    return {
      maxTokens,
      totalUsedTokens: totalUsed,
      reservedTokens,
      categoryAllocations: allocations,
      droppedSections,
      truncatedSections,
    };
  }
}
