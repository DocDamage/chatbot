/**
 * Safety Pipeline - Integrates all safety mechanisms
 * Research: MIT Safer Chatbots, Stanford AI Safety
 */

import { SelfCheckSafety, SafetyCheckResult } from './SelfCheckSafety';
import { ConstitutionalAI } from './ConstitutionalAI';
import { ToxicityDetector, ToxicityResult } from './ToxicityDetector';
import { BiasMitigator, BiasResult } from './BiasMitigator';
import { FactChecker, FactCheckResult } from './FactChecker';
import { UncertaintyQuantifier, UncertaintyResult } from './UncertaintyQuantifier';
import { LLMAdapter } from '../providers/LLMAdapter';
import { HybridRetriever } from '../rag/HybridRetriever';
import { logger } from '../observability/logger';

export interface SafetyPipelineResult {
  safe: boolean;
  confidence: number;
  checks: {
    selfCheck: SafetyCheckResult;
    constitutional: { compliant: boolean; violations: string[] };
    toxicity: ToxicityResult;
    bias: BiasResult;
    factCheck?: FactCheckResult;
    uncertainty: UncertaintyResult;
  };
  mitigatedContent?: string;
  warnings: string[];
}

export class SafetyPipeline {
  private selfCheck: SelfCheckSafety;
  private constitutional: ConstitutionalAI;
  private toxicityDetector: ToxicityDetector;
  private biasMitigator: BiasMitigator;
  private factChecker?: FactChecker;
  private uncertaintyQuantifier: UncertaintyQuantifier;

  constructor(
    llmAdapter: LLMAdapter,
    retriever?: HybridRetriever
  ) {
    this.selfCheck = new SelfCheckSafety(llmAdapter);
    this.constitutional = new ConstitutionalAI(llmAdapter);
    this.toxicityDetector = new ToxicityDetector();
    this.biasMitigator = new BiasMitigator();
    if (retriever) {
      this.factChecker = new FactChecker(retriever);
    }
    this.uncertaintyQuantifier = new UncertaintyQuantifier(llmAdapter);
  }

  /**
   * Run full safety pipeline on content
   */
  async check(content: string, checkFacts: boolean = false): Promise<SafetyPipelineResult> {
    logger.info('Safety pipeline check started', { contentLength: content.length });

    // Run all checks in parallel
    const [selfCheckResult, constitutionalResult, toxicityResult, biasResult, uncertaintyResult] = await Promise.all([
      this.selfCheck.check(content),
      this.constitutional.check(content),
      Promise.resolve(this.toxicityDetector.detect(content)),
      Promise.resolve(this.biasMitigator.detect(content)),
      this.uncertaintyQuantifier.quantify(content, checkFacts)
    ]);

    // Optional fact check
    let factCheckResult: FactCheckResult | undefined;
    if (checkFacts && this.factChecker) {
      factCheckResult = await this.factChecker.check(content);
    }

    // Determine overall safety
    const safe = 
      selfCheckResult.safe &&
      constitutionalResult.compliant &&
      !toxicityResult.toxic &&
      !biasResult.biased &&
      (!factCheckResult || factCheckResult.verified);

    // Calculate overall confidence
    const confidences = [
      selfCheckResult.confidence,
      constitutionalResult.compliant ? 0.9 : 0.3,
      toxicityResult.toxic ? 0.2 : 0.8,
      biasResult.biased ? 0.3 : 0.8,
      uncertaintyResult.confidence
    ];
    const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;

    // Collect warnings
    const warnings: string[] = [];
    if (!selfCheckResult.safe) {
      warnings.push('Self-check safety issues detected');
    }
    if (!constitutionalResult.compliant) {
      warnings.push(`Constitutional violations: ${constitutionalResult.violations.join(', ')}`);
    }
    if (toxicityResult.toxic) {
      warnings.push(`Toxicity detected (score: ${toxicityResult.score.toFixed(2)})`);
    }
    if (biasResult.biased) {
      warnings.push(`Bias detected: ${biasResult.suggestions.join('; ')}`);
    }
    if (factCheckResult && !factCheckResult.verified) {
      warnings.push('Some facts could not be verified');
    }
    if (uncertaintyResult.uncertainty > 0.5) {
      warnings.push(`High uncertainty (${uncertaintyResult.uncertainty.toFixed(2)})`);
    }

    // Mitigate if needed
    let mitigatedContent: string | undefined;
    if (!safe && biasResult.biased) {
      mitigatedContent = this.biasMitigator.mitigate(content, biasResult);
    }

    const result: SafetyPipelineResult = {
      safe,
      confidence: avgConfidence,
      checks: {
        selfCheck: selfCheckResult,
        constitutional: {
          compliant: constitutionalResult.compliant,
          violations: constitutionalResult.violations
        },
        toxicity: toxicityResult,
        bias: biasResult,
        factCheck: factCheckResult,
        uncertainty: uncertaintyResult
      },
      mitigatedContent,
      warnings
    };

    logger.info('Safety pipeline check completed', {
      safe: result.safe,
      confidence: result.confidence.toFixed(2),
      warningsCount: result.warnings.length
    });

    return result;
  }

  async validate(content: string, checkFacts: boolean = false): Promise<SafetyPipelineResult> {
    return this.check(content, checkFacts);
  }
}

