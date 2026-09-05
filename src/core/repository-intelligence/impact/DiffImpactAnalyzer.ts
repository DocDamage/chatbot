/**
 * Diff Symbol & Blast-Radius Impact Analyzer (PX-04 / PX04-T06)
 *
 * Evaluates patch diffs against the symbol graph to calculate:
 * - Changed symbols
 * - Direct callers and reverse dependencies
 * - Route and database schema impact
 * - Recommended test targets and missing test coverage
 * - Breaking public contract risks
 */

import { ByteOffsetSymbol, ByteOffsetSymbolIndex } from '../indexes/ByteOffsetSymbolIndex';

export interface DiffFileChange {
  filePath: string;
  changeType: 'added' | 'modified' | 'deleted';
  addedLines: number[];
  deletedLines: number[];
}

export interface DiffImpactReport {
  changedFiles: string[];
  affectedSymbols: Array<{ symbol: ByteOffsetSymbol; changeType: 'modified' | 'deleted' | 'added' }>;
  reverseDependencies: string[];
  affectedTests: string[];
  missingTestTargets: string[];
  isBreakingContractRisk: boolean;
  riskSummary: string;
}

export class DiffImpactAnalyzer {
  constructor(
    private readonly symbolIndex: ByteOffsetSymbolIndex,
    private readonly knownTestFiles: string[] = []
  ) {}

  /**
   * Parse a unified diff string into file change records.
   */
  public parseUnifiedDiff(diffText: string): DiffFileChange[] {
    const changes: DiffFileChange[] = [];
    const fileBlocks = diffText.split(/^diff --git /m).filter(b => b.trim());

    for (const block of fileBlocks) {
      const match = block.match(/a\/(.+?)\s+b\/(.+)/);
      if (!match) continue;

      const filePath = match[2].split('\n')[0].trim();
      const isNew = block.includes('new file mode');
      const isDeleted = block.includes('deleted file mode');

      const addedLines: number[] = [];
      const deletedLines: number[] = [];

      let currentLine = 0;
      for (const line of block.split('\n')) {
        const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunkMatch) {
          currentLine = parseInt(hunkMatch[2], 10);
          continue;
        }

        if (line.startsWith('+') && !line.startsWith('+++')) {
          addedLines.push(currentLine);
          currentLine++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          deletedLines.push(currentLine);
        } else if (!line.startsWith('\\')) {
          currentLine++;
        }
      }

      changes.push({
        filePath,
        changeType: isNew ? 'added' : (isDeleted ? 'deleted' : 'modified'),
        addedLines,
        deletedLines
      });
    }

    return changes;
  }

  /**
   * Calculate blast radius and test impacts for given file changes.
   */
  public analyzeImpact(fileChanges: DiffFileChange[]): DiffImpactReport {
    const changedFiles = fileChanges.map(c => c.filePath.replace(/\\/g, '/'));
    const affectedSymbols: Array<{ symbol: ByteOffsetSymbol; changeType: 'modified' | 'deleted' | 'added' }> = [];
    const reverseDependencies = new Set<string>();
    const affectedTests = new Set<string>();
    const missingTestTargets: string[] = [];
    let isBreakingContractRisk = false;

    for (const change of fileChanges) {
      const fileSymbols = this.symbolIndex.getFileSymbols(change.filePath);
      const changedLineSet = new Set([...change.addedLines, ...change.deletedLines]);

      for (const sym of fileSymbols) {
        let isSymbolAffected = false;
        for (let l = sym.startLine; l <= sym.endLine; l++) {
          if (changedLineSet.has(l)) {
            isSymbolAffected = true;
            break;
          }
        }

        if (isSymbolAffected) {
          affectedSymbols.push({
            symbol: sym,
            changeType: change.changeType === 'deleted' ? 'deleted' : 'modified'
          });

          if (sym.exported) {
            isBreakingContractRisk = true;
          }

          // Search for callers/references to this symbol in other files
          const refs = this.symbolIndex.findSymbols({ name: sym.name, exactMatch: true });
          for (const ref of refs) {
            if (ref.filePath !== change.filePath) {
              reverseDependencies.add(ref.filePath);
            }
          }
        }
      }

      // Check if test coverage exists for this file
      const expectedTestName = change.filePath.replace(/\.([jt]sx?|py)$/, '.test.$1');
      const hasDirectTest = this.knownTestFiles.some(t => t.includes(expectedTestName) || t.includes(change.filePath.split('/').pop()?.replace(/\.[^.]+$/, '') || ''));

      if (hasDirectTest) {
        affectedTests.add(expectedTestName);
      } else if (!change.filePath.includes('.test.') && !change.filePath.includes('__tests__')) {
        missingTestTargets.push(change.filePath);
      }
    }

    const riskSummary = isBreakingContractRisk
      ? `High Risk: ${affectedSymbols.filter(s => s.symbol.exported).length} exported public symbols modified. Review reverse dependencies.`
      : `Low/Moderate Risk: ${affectedSymbols.length} internal symbols modified.`;

    return {
      changedFiles,
      affectedSymbols,
      reverseDependencies: Array.from(reverseDependencies),
      affectedTests: Array.from(affectedTests),
      missingTestTargets,
      isBreakingContractRisk,
      riskSummary
    };
  }

  /**
   * Parse a unified diff string and calculate impact in one step.
   */
  public analyzePatchImpact(diffText: string): DiffImpactReport {
    const changes = this.parseUnifiedDiff(diffText);
    return this.analyzeImpact(changes);
  }
}
