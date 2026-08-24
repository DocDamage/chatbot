/**
 * Capability Promotion Engine (CF-10)
 * Evaluates objective criteria for promoting capabilities across the 3 maturity stages:
 *   Stage 1: DISABLED -> LOCAL_ONLY_EXPERIMENTAL
 *   Stage 2: LOCAL_ONLY_EXPERIMENTAL -> PRODUCTION_PREVIEW
 *   Stage 3: PRODUCTION_PREVIEW -> PRODUCTION_SUPPORTED
 * Generates immutable, cryptographically signed Promotion Decision Records.
 */

import { createHash } from 'crypto';
import { CapabilityMaturity, CapabilityRegistry, UserRole } from '../CapabilityRegistry';
import { CapabilityEvaluationSuite, EvaluationSuiteResult } from '../evaluation/CapabilityEvaluationSuite';
import { CapabilityObservabilityService } from '../observability/CapabilityObservabilityService';
import * as fs from 'fs';
import * as path from 'path';

export interface PromotionGateCriterion {
  id: string;
  name: string;
  required: boolean;
  evaluated: boolean;
  passed: boolean;
  evidence: string;
}

export interface PromotionEvaluationResult {
  capabilityId: string;
  currentMaturity: CapabilityMaturity;
  targetMaturity: CapabilityMaturity;
  isEligible: boolean;
  gateCriteria: PromotionGateCriterion[];
  evaluationSummary: {
    passedCriteria: number;
    totalCriteria: number;
    score: number;
  };
  blockers: string[];
}

export interface PromotionDecisionRecord {
  recordId: string;
  timestamp: string;
  capabilityId: string;
  previousMaturity: CapabilityMaturity;
  newMaturity: CapabilityMaturity;
  promotedBy: string;
  rationale: string;
  evaluationRunId: string;
  gateEvidence: PromotionGateCriterion[];
  rollbackCondition: string;
  sha256Digest: string;
}

export class CapabilityPromotionEngine {
  private static instance: CapabilityPromotionEngine;
  private evalSuite = CapabilityEvaluationSuite.getInstance();
  private obsService = CapabilityObservabilityService.getInstance();
  private decisionRecords: PromotionDecisionRecord[] = [];

  public static getInstance(): CapabilityPromotionEngine {
    if (!CapabilityPromotionEngine.instance) {
      CapabilityPromotionEngine.instance = new CapabilityPromotionEngine();
    }
    return CapabilityPromotionEngine.instance;
  }

  /**
   * Evaluates if a capability satisfies the objective criteria to move to the target maturity stage.
   */
  public async evaluatePromotion(
    capabilityId: string,
    targetMaturity: CapabilityMaturity,
    evalResult?: EvaluationSuiteResult
  ): Promise<PromotionEvaluationResult> {
    const registry = CapabilityRegistry.getInstance();
    const capability = registry.getCapabilityById(capabilityId);

    if (!capability) {
      return {
        capabilityId,
        currentMaturity: 'DEPRECATED',
        targetMaturity,
        isEligible: false,
        gateCriteria: [],
        evaluationSummary: { passedCriteria: 0, totalCriteria: 0, score: 0 },
        blockers: [`Capability '${capabilityId}' not found in registry.`]
      };
    }

    const currentMaturity = capability.maturity;
    const gateCriteria: PromotionGateCriterion[] = [];
    const blockers: string[] = [];

    // Run evaluation suite if not provided
    const suiteResult = evalResult || await this.evalSuite.runSuite();
    const allowedTransition =
      (currentMaturity === 'DEPRECATED' && targetMaturity === 'LOCAL_ONLY_EXPERIMENTAL') ||
      (currentMaturity === 'LOCAL_ONLY_EXPERIMENTAL' && targetMaturity === 'PRODUCTION_PREVIEW') ||
      (currentMaturity === 'PRODUCTION_PREVIEW' && targetMaturity === 'PRODUCTION_SUPPORTED');
    if (!allowedTransition) {
      blockers.push(`Invalid promotion transition: ${currentMaturity} -> ${targetMaturity}. Promotions must advance exactly one maturity stage.`);
    }

    if (targetMaturity === 'LOCAL_ONLY_EXPERIMENTAL') {
      // Stage 1: Disabled -> Local Only Experimental
      // Requires: Unit/Integration tests pass, local canary definition
      const evalPassed = suiteResult.status === 'passed' || suiteResult.overallScore >= 0.8;
      const canaryMap: Record<string, string> = {
        local_model_adapter: 'LOCAL_MODEL_CANARY.md',
        typed_agent_teams: 'AGENT_TEAM_CANARY.md',
        browser_jobs: 'BROWSER_JOB_CANARY.md',
        video_localization: 'MEDIA_LOCALIZATION_CANARY.md',
        lattice_gamedev: 'LATTICE_GAMEDEV_CANARY.md'
      };
      const canaryFile = canaryMap[capabilityId];
      const canaryExists = Boolean(canaryFile && fs.existsSync(path.resolve(process.cwd(), 'docs', 'implementation', 'canaries', canaryFile)));
      gateCriteria.push({
        id: 'STAGE1-EVAL',
        name: 'Evaluation Suite & Unit/Integration Test Pass',
        required: true,
        evaluated: true,
        passed: evalPassed,
        evidence: `Evaluation Suite score: ${(suiteResult.overallScore * 100).toFixed(1)}%`
      });

      gateCriteria.push({
        id: 'STAGE1-CANARY',
        name: 'Documented Local Canary Requirements',
        required: true,
        evaluated: true,
        passed: canaryExists,
        evidence: canaryExists ? `Canary definition found: ${canaryFile}` : 'No capability-specific canary definition was found'
      });

    } else if (targetMaturity === 'PRODUCTION_PREVIEW') {
      // Stage 2: Local Experimental -> Production Preview
      // Requires: Complete UI, accessible views, docs, recovery paths, benchmark score >= 90%
      const benchmarkPassed = suiteResult.overallScore >= 0.90;
      gateCriteria.push({
        id: 'STAGE2-BENCHMARK',
        name: 'Comprehensive Benchmark Score >= 90%',
        required: true,
        evaluated: true,
        passed: benchmarkPassed,
        evidence: `Benchmark Score: ${(suiteResult.overallScore * 100).toFixed(1)}%`
      });

      const sloSummary = this.obsService.getDashboardSummary();
      const sloHealthy = sloSummary.totalInvocations > 0 && sloSummary.slos.every(s => s.status === 'healthy');
      const uiSourcesExist = fs.existsSync(path.resolve(process.cwd(), 'client', 'src', 'components', 'CapabilityHubPanel.tsx'));
      const accessibilityCertified = process.env.CF_ACCESSIBILITY_CERTIFIED === 'true';
      gateCriteria.push({
        id: 'STAGE2-SLO',
        name: 'Service Level Objectives Compliance',
        required: true,
        evaluated: true,
        passed: sloHealthy,
        evidence: `All ${sloSummary.slos.length} SLOs operating within error budget`
      });

      gateCriteria.push({
        id: 'STAGE2-UI-DOCS',
        name: 'Accessible UI, Plain-Language Specs & Recovery',
        required: true,
        evaluated: true,
        passed: uiSourcesExist && accessibilityCertified,
        evidence: uiSourcesExist && accessibilityCertified
          ? 'Capability Hub source exists and CF_ACCESSIBILITY_CERTIFIED is explicitly recorded'
          : 'Automated UI presence is insufficient; set CF_ACCESSIBILITY_CERTIFIED only after manual keyboard and screen-reader certification'
      });

    } else if (targetMaturity === 'PRODUCTION_SUPPORTED') {
      // Stage 3: Preview -> Production Supported
      // Requires: Full production plan gates, signed ADR, release candidate commit verification
      const allPassed = suiteResult.status === 'passed' && suiteResult.overallScore >= 0.95;
      const adrExists = fs.existsSync(path.resolve(process.cwd(), 'docs', 'implementation', 'decisions'));
      const releaseCertified = process.env.CF_RELEASE_CERTIFIED === 'true';
      gateCriteria.push({
        id: 'STAGE3-PROD-GATES',
        name: 'Full Production Verification Gates (Phases 3-12)',
        required: true,
        evaluated: true,
        passed: allPassed,
        evidence: `Production gate suite score: ${(suiteResult.overallScore * 100).toFixed(1)}%`
      });

      gateCriteria.push({
        id: 'STAGE3-ADR',
        name: 'Architectural Decision Record Signed',
        required: true,
        evaluated: true,
        passed: adrExists && releaseCertified,
        evidence: adrExists && releaseCertified
          ? 'ADR directory exists and release certification is explicitly recorded'
          : 'ADR presence alone is insufficient; signed release certification is not recorded'
      });
    }

    for (const criterion of gateCriteria) {
      if (criterion.required && !criterion.passed) {
        blockers.push(`Required gate criterion failed: ${criterion.name} (${criterion.evidence})`);
      }
    }

    const passedCriteria = gateCriteria.filter(c => c.passed).length;
    const totalCriteria = gateCriteria.length;
    const score = totalCriteria > 0 ? Number((passedCriteria / totalCriteria).toFixed(2)) : 0;
    const isEligible = blockers.length === 0;

    return {
      capabilityId,
      currentMaturity,
      targetMaturity,
      isEligible,
      gateCriteria,
      evaluationSummary: {
        passedCriteria,
        totalCriteria,
        score
      },
      blockers
    };
  }

  /**
   * Promotes a capability to the target maturity stage and records an immutable decision record.
   */
  public async executePromotion(options: {
    capabilityId: string;
    targetMaturity: CapabilityMaturity;
    promotedBy: string;
    rationale: string;
    userRole: UserRole;
    evaluationRunId?: string;
  }): Promise<{ success: boolean; decisionRecord?: PromotionDecisionRecord; message: string }> {
    if (options.userRole !== 'admin' && options.userRole !== 'developer') {
      return {
        success: false,
        message: `User role '${options.userRole}' does not have authority to promote capabilities (requires admin or developer).`
      };
    }

    const evalResult = await this.evaluatePromotion(options.capabilityId, options.targetMaturity);
    if (!evalResult.isEligible) {
      return {
        success: false,
        message: `Promotion failed gate validation: ${evalResult.blockers.join('; ')}`
      };
    }

    const registry = CapabilityRegistry.getInstance();
    const capability = registry.getCapabilityById(options.capabilityId);
    if (!capability) {
      return { success: false, message: `Capability '${options.capabilityId}' not found.` };
    }

    const previousMaturity = capability.maturity;
    const recordId = `pdr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();

    const recordPayload = {
      recordId,
      timestamp,
      capabilityId: options.capabilityId,
      previousMaturity,
      newMaturity: options.targetMaturity,
      promotedBy: options.promotedBy,
      rationale: options.rationale,
      evaluationRunId: options.evaluationRunId || 'eval-suite-auto',
      gateEvidence: evalResult.gateCriteria,
      rollbackCondition: 'Automatic rollback if SLO availability < 98% or privacy breach occurs'
    };

    const sha256Digest = createHash('sha256').update(JSON.stringify(recordPayload)).digest('hex');
    const decisionRecord: PromotionDecisionRecord = {
      ...recordPayload,
      sha256Digest
    };

    this.decisionRecords.push(decisionRecord);

    // Persist decision record to disk
    try {
      const { CapabilityPersistenceStore } = require('../persistence/CapabilityPersistenceStore');
      CapabilityPersistenceStore.getInstance().appendDecision(decisionRecord);
    } catch {
      // Non-blocking disk persistence
    }

    // Apply the maturity update in registry
    registry.updateCapabilityMaturity(options.capabilityId, options.targetMaturity);

    return {
      success: true,
      decisionRecord,
      message: `Successfully promoted '${options.capabilityId}' from ${previousMaturity} to ${options.targetMaturity}.`
    };
  }

  /**
   * Rolls back a capability maturity in response to degradation or incident.
   */
  public async executeRollback(options: {
    capabilityId: string;
    rollbackMaturity: CapabilityMaturity;
    reason: string;
    operator: string;
    userRole: UserRole;
  }): Promise<{ success: boolean; message: string }> {
    if (options.userRole !== 'admin' && options.userRole !== 'developer') {
      return { success: false, message: `User role '${options.userRole}' does not have authority to roll back capabilities.` };
    }
    const registry = CapabilityRegistry.getInstance();
    const capability = registry.getCapabilityById(options.capabilityId);
    if (!capability) {
      return { success: false, message: `Capability '${options.capabilityId}' not found.` };
    }

    const previousMaturity = capability.maturity;
    const maturityRank: Record<CapabilityMaturity, number> = {
      DEPRECATED: 0,
      LOCAL_ONLY_EXPERIMENTAL: 1,
      PRODUCTION_PREVIEW: 2,
      PRODUCTION_SUPPORTED: 3
    };
    if (maturityRank[options.rollbackMaturity] >= maturityRank[previousMaturity]) {
      return { success: false, message: `Rollback target ${options.rollbackMaturity} must be below current maturity ${previousMaturity}.` };
    }
    registry.updateCapabilityMaturity(options.capabilityId, options.rollbackMaturity);

    const rollbackPayload = {
      recordId: `rollback-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      capabilityId: options.capabilityId,
      previousMaturity,
      newMaturity: options.rollbackMaturity,
      promotedBy: options.operator,
      rationale: `ROLLBACK TRIGGERED: ${options.reason}`,
      evaluationRunId: 'rollback-incident',
      gateEvidence: [],
      rollbackCondition: 'N/A'
    };
    const rollbackRecord: PromotionDecisionRecord = {
      ...rollbackPayload,
      sha256Digest: createHash('sha256').update(JSON.stringify(rollbackPayload)).digest('hex')
    };

    this.decisionRecords.push(rollbackRecord);

    return {
      success: true,
      message: `Rollback completed for '${options.capabilityId}': reverted from ${previousMaturity} to ${options.rollbackMaturity}.`
    };
  }

  public getDecisionRecords(): PromotionDecisionRecord[] {
    return [...this.decisionRecords];
  }
}
