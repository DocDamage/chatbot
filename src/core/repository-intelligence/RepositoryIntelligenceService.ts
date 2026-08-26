/**
 * Unified Repository Intelligence Service (PX-04 / PX04-T08)
 *
 * Integrates ByteOffsetSymbolIndex, MultiLanguageSymbolIndexer,
 * SemanticArchitectureCardProvider, GitIntelligenceProvider,
 * CodeHealthRiskProvider, and DiffImpactAnalyzer into one cohesive facade.
 */

import { ByteOffsetSymbolIndex } from './indexes/ByteOffsetSymbolIndex';
import { MultiLanguageSymbolIndexer, ParserHealthReport } from './indexes/MultiLanguageSymbolIndexer';
import { SemanticArchitectureCardProvider, SemanticArchitectureCard } from './architecture/SemanticArchitectureCardProvider';
import { GitIntelligenceProvider, GitStatusSnapshot, FileChurnRecord } from './git/GitIntelligenceProvider';
import { CodeHealthRiskProvider, CodeHealthFinding, HotspotRecord } from './risk/CodeHealthRiskProvider';
import { DiffImpactAnalyzer, DiffImpactReport, DiffFileChange } from './impact/DiffImpactAnalyzer';
import { SafeRepositoryIngester } from './ingestion/SafeRepositoryIngester';

export interface RepositoryOverview {
  workspaceRoot: string;
  totalFiles: number;
  totalSymbols: number;
  gitStatus: GitStatusSnapshot;
  parserHealth: ParserHealthReport[];
  architectureCards: SemanticArchitectureCard[];
  healthFindings: CodeHealthFinding[];
  hotspots: HotspotRecord[];
}

export class RepositoryIntelligenceService {
  private symbolIndex: ByteOffsetSymbolIndex;
  private multiLangIndexer: MultiLanguageSymbolIndexer;
  private cardProvider: SemanticArchitectureCardProvider;
  private gitProvider: GitIntelligenceProvider;
  private riskProvider: CodeHealthRiskProvider;
  private impactAnalyzer: DiffImpactAnalyzer;

  constructor(private readonly workspaceRoot: string) {
    this.symbolIndex = new ByteOffsetSymbolIndex(workspaceRoot);
    this.multiLangIndexer = new MultiLanguageSymbolIndexer(this.symbolIndex);
    this.cardProvider = new SemanticArchitectureCardProvider();
    this.gitProvider = new GitIntelligenceProvider(workspaceRoot);
    this.riskProvider = new CodeHealthRiskProvider(workspaceRoot);
    this.impactAnalyzer = new DiffImpactAnalyzer(this.symbolIndex);
  }

  public getSymbolIndex(): ByteOffsetSymbolIndex {
    return this.symbolIndex;
  }

  public getIndexer(): MultiLanguageSymbolIndexer {
    return this.multiLangIndexer;
  }

  public getArchitectureCardProvider(): SemanticArchitectureCardProvider {
    return this.cardProvider;
  }

  public getGitProvider(): GitIntelligenceProvider {
    return this.gitProvider;
  }

  public getRiskProvider(): CodeHealthRiskProvider {
    return this.riskProvider;
  }

  public getImpactAnalyzer(): DiffImpactAnalyzer {
    return this.impactAnalyzer;
  }

  /**
   * Index multiple files in memory.
   */
  public indexFiles(files: Array<{ filePath: string; content: string }>): void {
    for (const file of files) {
      this.multiLangIndexer.indexFile(file.filePath, file.content);
    }
  }

  /**
   * Generate complete repository overview.
   */
  public getOverview(files: Array<{ filePath: string; content: string }> = []): RepositoryOverview {
    const gitStatus = this.gitProvider.getStatus();
    const churnRecords = this.gitProvider.getFileChurn(50);
    const churnMap = new Map<string, number>(churnRecords.map(c => [c.filePath, c.churnScore]));

    const { findings, hotspots } = this.riskProvider.analyzeCodeHealth(files, churnMap);

    return {
      workspaceRoot: this.workspaceRoot,
      totalFiles: files.length,
      totalSymbols: this.symbolIndex.getAllSymbols().length,
      gitStatus,
      parserHealth: this.multiLangIndexer.getHealthReports(),
      architectureCards: this.cardProvider.getAllCards(),
      healthFindings: findings,
      hotspots
    };
  }

  /**
   * Evaluate patch diff impact.
   */
  public analyzePatchImpact(diffText: string): DiffImpactReport {
    const changes = this.impactAnalyzer.parseUnifiedDiff(diffText);
    return this.impactAnalyzer.analyzeImpact(changes);
  }
}
