/**
 * Section 45: Observability Specification Types & Schemas
 * Defines the 27 canonical telemetry metrics, labels, and cardinality guardrails.
 */
import { z } from 'zod';

export const CANONICAL_METRIC_NAMES = [
  'chat_requests_total',
  'chat_request_duration_ms',
  'chat_stage_duration_ms',
  'chat_failures_total',
  'chat_fallback_total',
  'context_plan_total',
  'context_source_selected_total',
  'unnecessary_retrieval_rate',
  'rag_queries_total',
  'rag_query_duration_ms',
  'rag_candidates_total',
  'rag_selected_chunks_total',
  'rag_grounding_insufficient_total',
  'knowledge_dataset_jobs_total',
  'knowledge_dataset_job_duration',
  'knowledge_documents_ingested_total',
  'knowledge_documents_filtered_total',
  'knowledge_embedding_failures_total',
  'knowledge_dataset_stale_total',
  'model_routes_total',
  'model_route_fallback_total',
  'model_generation_duration_ms',
  'model_errors_total',
  'feedback_total',
  'feedback_negative_total',
  'tool_calls_total',
  'tool_call_failures_total',
  'tool_claim_validation_failures_total',
] as const;

export type CanonicalMetricName = (typeof CANONICAL_METRIC_NAMES)[number];

export const CanonicalMetricNameSchema = z.enum(CANONICAL_METRIC_NAMES);

export type MetricType = 'counter' | 'histogram' | 'gauge' | 'derived';

export interface MetricDefinition {
  name: CanonicalMetricName;
  type: MetricType;
  description: string;
  allowedLabels: string[];
}

export interface MetricSample {
  metricName: CanonicalMetricName;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

export const PROHIBITED_HIGH_CARDINALITY_LABELS = [
  'userId',
  'user_id',
  'sessionId',
  'session_id',
  'conversationId',
  'prompt',
  'query',
  'rawSql',
  'response',
  'documentText',
];
