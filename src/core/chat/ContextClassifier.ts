/**
 * Bounded Context Classifier (CRK-P05-T03)
 *
 * Provides an optional, inexpensive classification step when deterministic routing
 * confidence is low. Strictly bounded by timeout and fallback, with no tool execution.
 */

import { ClassifierResult } from '../../types/context-plan';

export interface IClassifierModel {
  classify(prompt: string, maxTokens: number): Promise<string>;
}

export class ContextClassifier {
  private readonly model?: IClassifierModel;
  private readonly timeoutMs: number;

  constructor(model?: IClassifierModel, timeoutMs = 1500) {
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  public async classify(message: string): Promise<ClassifierResult | null> {
    if (!this.model) {
      return null;
    }

    try {
      const prompt = [
        'Analyze the user message and output JSON only with this schema:',
        '{"task": string, "needsProject": boolean, "needsKnowledge": boolean, "knowledgeDomains": string[], "needsWeb": boolean, "confidence": number}',
        `User Message: "${message}"`,
      ].join('\n');

      const classificationPromise = this.model.classify(prompt, 128);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Classifier timeout')), this.timeoutMs)
      );

      const raw = await Promise.race([classificationPromise, timeoutPromise]);
      const parsed = JSON.parse(raw);

      return {
        task: String(parsed.task || 'general_qa'),
        needsProject: Boolean(parsed.needsProject),
        needsKnowledge: Boolean(parsed.needsKnowledge),
        knowledgeDomains: Array.isArray(parsed.knowledgeDomains)
          ? parsed.knowledgeDomains.map(String)
          : [],
        needsWeb: Boolean(parsed.needsWeb),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.75,
      };
    } catch {
      // Safe fallback to null, allowing deterministic routing to proceed (§1275)
      return null;
    }
  }
}
