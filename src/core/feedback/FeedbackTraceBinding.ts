/**
 * Feedback Trace Binding Service (CRK-P16-T03)
 *
 * Extracts and binds immutable execution trace metadata to incoming feedback events,
 * allowing feedback to be analyzed against specific model, prompt, and retrieval versions.
 *
 * In strict accordance with §2845, full private prompt text and user content are
 * never duplicated into feedback records.
 */

import {
  ChatRuntimeResult,
  ChatContextPlan,
  ChatTraceContext,
} from '../../types/chat-runtime';
import {
  FeedbackTraceBindingMetadata,
  feedbackTraceBindingMetadataSchema,
} from '../../types/feedback';

export interface TraceExtractionParams {
  result?: Partial<ChatRuntimeResult>;
  plan?: Partial<ChatContextPlan>;
  trace?: Partial<ChatTraceContext>;
  promptVersion?: string;
  botProfileVersion?: string;
  retrievalPolicy?: string;
  selectedDatasetVersions?: Record<string, string>;
}

export class FeedbackTraceBinding {
  /**
   * Extracts sanitized, immutable trace metadata for feedback binding.
   */
  public extractTraceMetadata(params: TraceExtractionParams): FeedbackTraceBindingMetadata {
    const {
      result,
      plan,
      promptVersion = 'prompt-envelope-v2.1',
      botProfileVersion = 'default-profile-v1.0',
      retrievalPolicy = 'retrieval-policy-v1.4',
      selectedDatasetVersions = {},
    } = params;

    // Collect dataset versions from citations if not explicitly passed
    const datasetVersions = { ...selectedDatasetVersions };
    if (result?.citations) {
      for (const cit of result.citations) {
        if (cit.datasetId && cit.version) {
          datasetVersions[cit.datasetId] = cit.version;
        }
      }
    }

    const toolResults = (result?.toolResults || []).map(tr => ({
      toolName: tr.toolName,
      status: tr.status,
      durationMs: tr.durationMs,
    }));

    const rawMetadata = {
      promptVersion,
      botProfileVersion,
      model: result?.model?.model || 'unknown_model',
      provider: result?.model?.provider || 'unknown_provider',
      modelPolicy: result?.model?.policy || plan?.modelStrategy?.policy || 'default',
      contextPlanId: plan?.traceId,
      retrievalPolicy,
      selectedDatasetVersions: datasetVersions,
      toolResults,
      latencyMs: result?.latencyMs,
      validationWarnings: [...(result?.warnings || [])],
    };

    return feedbackTraceBindingMetadataSchema.parse(rawMetadata);
  }
}
