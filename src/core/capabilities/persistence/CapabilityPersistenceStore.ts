/**
 * Capability Persistence Store (CF-10)
 *
 * Provides persistent, crash-resilient disk storage for:
 * - Telemetry events (telemetry.jsonl)
 * - Promotion decision records (decisions.jsonl)
 * - Evaluation suite run artifacts (evaluations.jsonl)
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../observability/logger';
import { CapabilityTelemetryEvent } from '../observability/CapabilityObservabilityService';
import { PromotionDecisionRecord } from '../promotion/CapabilityPromotionEngine';
import { EvaluationSuiteResult } from '../evaluation/CapabilityEvaluationSuite';

export class CapabilityPersistenceStore {
  private static instance: CapabilityPersistenceStore;
  private storageDir: string;
  private telemetryFile: string;
  private decisionsFile: string;
  private evaluationsFile: string;

  private constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), '.capabilities');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    this.telemetryFile = path.join(this.storageDir, 'telemetry.jsonl');
    this.decisionsFile = path.join(this.storageDir, 'decisions.jsonl');
    this.evaluationsFile = path.join(this.storageDir, 'evaluations.jsonl');
  }

  public static getInstance(options?: { storageDir?: string }): CapabilityPersistenceStore {
    if (!CapabilityPersistenceStore.instance) {
      CapabilityPersistenceStore.instance = new CapabilityPersistenceStore(options);
    }
    return CapabilityPersistenceStore.instance;
  }

  public static resetInstance(): void {
    (CapabilityPersistenceStore as any).instance = undefined;
  }

  /**
   * Append a telemetry event to disk
   */
  public appendTelemetry(event: CapabilityTelemetryEvent): void {
    try {
      const line = JSON.stringify(event) + '\n';
      fs.appendFileSync(this.telemetryFile, line, 'utf-8');
    } catch (err: any) {
      logger.warn('Failed to persist telemetry event', { error: err.message, eventId: event.id });
    }
  }

  /**
   * Load telemetry events from disk
   */
  public loadTelemetry(limit = 1000): CapabilityTelemetryEvent[] {
    if (!fs.existsSync(this.telemetryFile)) return [];
    try {
      const content = fs.readFileSync(this.telemetryFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines.slice(-limit).map(l => JSON.parse(l));
    } catch (err: any) {
      logger.warn('Failed to read telemetry store', { error: err.message });
      return [];
    }
  }

  /**
   * Append an immutable PromotionDecisionRecord to disk
   */
  public appendDecision(decision: PromotionDecisionRecord): void {
    try {
      const line = JSON.stringify(decision) + '\n';
      fs.appendFileSync(this.decisionsFile, line, 'utf-8');
    } catch (err: any) {
      logger.warn('Failed to persist promotion decision record', { error: err.message, recordId: decision.recordId });
    }
  }

  /**
   * Load all PromotionDecisionRecords from disk
   */
  public loadDecisions(): PromotionDecisionRecord[] {
    if (!fs.existsSync(this.decisionsFile)) return [];
    try {
      const content = fs.readFileSync(this.decisionsFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines.map(l => JSON.parse(l));
    } catch (err: any) {
      logger.warn('Failed to read decisions store', { error: err.message });
      return [];
    }
  }

  /**
   * Append an evaluation suite result to disk
   */
  public appendEvaluation(evaluation: EvaluationSuiteResult): void {
    try {
      const line = JSON.stringify(evaluation) + '\n';
      fs.appendFileSync(this.evaluationsFile, line, 'utf-8');
    } catch (err: any) {
      logger.warn('Failed to persist evaluation result', { error: err.message, id: evaluation.id });
    }
  }

  /**
   * Load recent evaluation results from disk
   */
  public loadEvaluations(limit = 50): EvaluationSuiteResult[] {
    if (!fs.existsSync(this.evaluationsFile)) return [];
    try {
      const content = fs.readFileSync(this.evaluationsFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines.slice(-limit).map(l => JSON.parse(l));
    } catch (err: any) {
      logger.warn('Failed to read evaluation store', { error: err.message });
      return [];
    }
  }
}
