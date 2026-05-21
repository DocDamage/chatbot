import { throwApiError } from './errors';

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
