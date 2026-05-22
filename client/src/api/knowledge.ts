import { throwApiError } from './errors';

export interface KnowledgeCheckResult {
  answer: string;
  confidence: number;
  needsOnlineResearch: boolean;
  suggestedQuery: string;
  localAnswer?: unknown;
  miss?: {
    knowledgeMiss?: boolean;
    domain?: string;
    proposedWebQuery?: string;
    recommendedSources?: string[];
  };
}

export interface OnlineKnowledgeSource {
  title: string;
  url: string;
  snippet: string;
}

export interface OnlineKnowledgePreview {
  query: string;
  domain: string;
  retrievedAt: string;
  answerPreview: string;
  sources: OnlineKnowledgeSource[];
  reviewToken: string;
  requiresApproval: true;
  sourcePolicy: {
    accepted: number;
    rejected: Array<{ url: string; reason: string }>;
  };
}

export async function checkOnlineKnowledge(
  question: string,
  domain: string,
  confidenceThreshold?: number
): Promise<KnowledgeCheckResult> {
  const response = await fetch('/api/knowledge-online/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, domain, confidenceThreshold })
  });
  if (!response.ok) await throwApiError(response, 'Knowledge confidence check failed');
  return response.json();
}

export async function searchOnlineKnowledge(query: string, domain: string) {
  const response = await fetch('/api/knowledge-online/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, domain })
  });
  if (!response.ok) await throwApiError(response, 'Online search failed');
  return response.json();
}

export async function ingestOnlineKnowledge(preview: unknown, sessionId: string) {
  const response = await fetch('/api/knowledge-online/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preview, approved: true, approvedBy: sessionId })
  });
  if (!response.ok) await throwApiError(response, 'Knowledge ingestion failed');
  return response.json();
}

export async function searchAndIngestOnlineKnowledge(input: {
  query: string;
  domain: string;
  approved: boolean;
  approvedBy: string;
  notes?: string;
}) {
  const response = await fetch('/api/knowledge-online/search-and-ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!response.ok) await throwApiError(response, 'Knowledge search-and-ingest failed');
  return response.json();
}
