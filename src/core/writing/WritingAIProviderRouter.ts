/**
 * Writing AI Provider Router (PX14-T08)
 *
 * Implements sensitivity controls, local vs cloud provider routing, data egress notices,
 * and long-document chunked transformations.
 */

import {
  AIWritingAction,
  CanonicalDocument,
  DocumentSensitivity,
  ProcessingLocality,
  TextRange
} from './WritingTypes';

export interface ProviderRouteConfig {
  localModelEndpoint?: string;
  allowCloudEgress: boolean;
  preferredLocalModel: string;
  preferredCloudModel: string;
}

export interface WritingTransformRequest {
  document: CanonicalDocument;
  action: AIWritingAction;
  range?: TextRange;
  instruction?: string;
  targetTone?: string;
  preferCloud?: boolean;
}

export interface WritingTransformResult {
  transformedText: string;
  providerModel: string;
  locality: ProcessingLocality;
  egressNotice?: string;
  chunksProcessed: number;
}

export interface WritingTransformBackend {
  health?(): Promise<{ available: boolean; models?: string[] }>;
  transform(input: {
    text: string;
    action: AIWritingAction;
    instruction?: string;
    targetTone?: string;
    providerModel: string;
    locality: ProcessingLocality;
  }): Promise<string>;
}

export class WritingAIProviderRouter {
  private config: ProviderRouteConfig;

  constructor(config: Partial<ProviderRouteConfig> = {}, private readonly backend?: WritingTransformBackend) {
    this.config = {
      localModelEndpoint: config.localModelEndpoint || 'http://127.0.0.1:11434',
      allowCloudEgress: config.allowCloudEgress ?? false,
      preferredLocalModel: config.preferredLocalModel || process.env.OLLAMA_MODEL || 'qwen3:8b',
      preferredCloudModel: config.preferredCloudModel || 'gemini-1.5-pro'
    };
  }

  public isAvailable(): boolean {
    return Boolean(this.backend);
  }

  /**
   * Evaluates document sensitivity and user preference to determine processing locality.
   */
  public determineLocality(
    sensitivity: DocumentSensitivity,
    preferCloud: boolean = false
  ): {
    locality: ProcessingLocality;
    providerModel: string;
    egressNotice?: string;
  } {
    // Confidential or restricted documents strictly disallow cloud egress
    if (sensitivity === 'confidential' || sensitivity === 'restricted') {
      return {
        locality: 'local_only',
        providerModel: this.config.preferredLocalModel,
        egressNotice: `Local-only processing enforced: Document marked as ${sensitivity}. No text leaves the device.`
      };
    }

    if (preferCloud && this.config.allowCloudEgress) {
      return {
        locality: 'cloud_egress',
        providerModel: this.config.preferredCloudModel,
        egressNotice:
          'Data Egress Notice: Content is being sent to external cloud provider for high-tier processing.'
      };
    }

    return {
      locality: 'local_only',
      providerModel: this.config.preferredLocalModel,
      egressNotice: 'Processing executed entirely on local model runtime.'
    };
  }

  /**
   * Executes transform on text or chunked document sections.
   */
  public async executeTransform(request: WritingTransformRequest): Promise<WritingTransformResult> {
    const { document, action, range, instruction, targetTone, preferCloud } = request;
    const { locality, providerModel, egressNotice } = this.determineLocality(
      document.metadata.sensitivity,
      preferCloud
    );

    const sourceText = range
      ? document.rawText.substring(range.startOffset, range.endOffset)
      : document.rawText;
    if (!this.backend) {
      throw new Error('WRITING_TRANSFORM_BACKEND_UNAVAILABLE: configure a verified writing model backend before generating AI proposals.');
    }

    // Handle long documents with windowed chunking (e.g. max 10,000 chars per chunk)
    const maxChunk = 10000;
    if (sourceText.length > maxChunk) {
      const chunks = this.splitIntoChunks(sourceText, maxChunk);
      const transformedChunks: string[] = [];

      for (const chunk of chunks) {
        const transformed = await this.backend.transform({
          text: chunk,
          action,
          instruction,
          targetTone,
          providerModel,
          locality
        });
        transformedChunks.push(transformed);
      }

      return {
        transformedText: transformedChunks.join('\n\n'),
        providerModel,
        locality,
        egressNotice,
        chunksProcessed: chunks.length
      };
    }

    const transformedText = await this.backend.transform({
      text: sourceText,
      action,
      instruction,
      targetTone,
      providerModel,
      locality
    });

    return {
      transformedText,
      providerModel,
      locality,
      egressNotice,
      chunksProcessed: 1
    };
  }

  private splitIntoChunks(text: string, maxLen: number): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + maxLen, text.length);
      if (end < text.length) {
        const nextBreak = text.indexOf('\n\n', end - 500);
        if (nextBreak !== -1 && nextBreak < end + 500) {
          end = nextBreak + 2;
        }
      }
      chunks.push(text.substring(start, end));
      start = end;
    }
    return chunks;
  }

}
