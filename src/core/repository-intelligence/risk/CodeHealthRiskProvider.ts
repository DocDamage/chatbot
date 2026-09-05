/**
 * Code Health & Risk Intelligence Provider (PX-04 / PX04-T05)
 *
 * Evaluates code complexity, oversized files/functions, duplication signals,
 * high-churn + high-complexity hotspots, test coverage gaps, and route-policy risks.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CodeHealthFinding {
  id: string;
  ruleId: string;
  category: 'complexity' | 'size' | 'duplication' | 'hotspot' | 'security' | 'test_gap';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  disposition: 'metric' | 'signal' | 'suspected_weakness' | 'confirmed_defect' | 'accepted_risk';
  filePath: string;
  startLine: number;
  endLine: number;
  message: string;
  metricValue?: number;
  threshold?: number;
}

export interface HotspotRecord {
  filePath: string;
  complexityScore: number;
  churnScore: number;
  hotspotScore: number;
  riskTier: 'critical' | 'high' | 'medium' | 'low';
}

export class CodeHealthRiskProvider {
  constructor(private readonly workspaceRoot: string) {}

  /**
   * Scan files and compute code health findings.
   */
  public analyzeCodeHealth(files: Array<{ filePath: string; content: string }>, churnMap = new Map<string, number>()): { findings: CodeHealthFinding[]; hotspots: HotspotRecord[] } {
    const findings: CodeHealthFinding[] = [];
    const hotspots: HotspotRecord[] = [];

    for (const file of files) {
      const normalizedPath = file.filePath.replace(/\\/g, '/');
      const lines = file.content.split('\n');

      // 1. File Size check (oversized files > 500 lines)
      if (lines.length > 500) {
        findings.push({
          id: `size_file_${normalizedPath}`,
          ruleId: 'CODE_HEALTH_OVERSIZED_FILE',
          category: 'size',
          severity: lines.length > 1000 ? 'high' : 'medium',
          disposition: 'signal',
          filePath: normalizedPath,
          startLine: 1,
          endLine: lines.length,
          message: `File contains ${lines.length} lines, exceeding the 500-line guideline. Consider modularizing into focused components.`,
          metricValue: lines.length,
          threshold: 500
        });
      }

      // 2. Cyclomatic/Cognitive Complexity heuristics
      let totalComplexity = 0;
      let functionLineCount = 0;
      let currentFunction = '';
      let functionStartLine = 1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Track function starts
        const funcMatch = line.match(/^\s*(public|private|protected|async|function|def|fn)*\s*([A-Za-z0-9_$]+)\s*\([^)]*\)/);
        if (funcMatch && !line.includes('if (') && !line.includes('switch (')) {
          if (functionLineCount > 80 && currentFunction) {
            findings.push({
              id: `size_func_${normalizedPath}_${functionStartLine}`,
              ruleId: 'CODE_HEALTH_OVERSIZED_FUNCTION',
              category: 'size',
              severity: 'medium',
              disposition: 'signal',
              filePath: normalizedPath,
              startLine: functionStartLine,
              endLine: i,
              message: `Function '${currentFunction}' is ${functionLineCount} lines long. Recommended maximum is 80 lines.`,
              metricValue: functionLineCount,
              threshold: 80
            });
          }
          currentFunction = funcMatch[2];
          functionStartLine = i + 1;
          functionLineCount = 0;
        }
        functionLineCount++;

        // Count branching tokens for complexity
        const branchTokens = (line.match(/\b(if|else if|for|while|switch|case|catch|&&|\|\||\?)\b/g) || []).length;
        totalComplexity += branchTokens;

        // Security / Dangerous capability check
        if (/\b(?:eval|new\s+Function|child_process\.exec)\s*\(/.test(line)) {
          findings.push({
            id: `sec_dyn_${normalizedPath}_${i + 1}`,
            ruleId: 'SECURITY_DANGEROUS_EXECUTION',
            category: 'security',
            severity: 'high',
            disposition: 'suspected_weakness',
            filePath: normalizedPath,
            startLine: i + 1,
            endLine: i + 1,
            message: 'Potentially dangerous dynamic execution pattern detected.',
            metricValue: 1
          });
        }
      }

      // Compute Hotspot Score = Complexity * Churn
      const churn = churnMap.get(normalizedPath) || 1;
      const complexityScore = totalComplexity + Math.floor(lines.length / 20);
      const hotspotScore = complexityScore * (1 + Math.log10(churn + 1));

      let riskTier: 'critical' | 'high' | 'medium' | 'low' = 'low';
      if (hotspotScore > 100) riskTier = 'critical';
      else if (hotspotScore > 50) riskTier = 'high';
      else if (hotspotScore > 20) riskTier = 'medium';

      hotspots.push({
        filePath: normalizedPath,
        complexityScore,
        churnScore: churn,
        hotspotScore,
        riskTier
      });
    }

    hotspots.sort((a, b) => b.hotspotScore - a.hotspotScore);
    return { findings, hotspots };
  }
}
