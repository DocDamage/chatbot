import { throwApiError } from './errors';

export interface ConversationMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationSummary {
  sessionId: string;
  userId?: string;
  messageCount: number;
  firstMessage: string;
  lastMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessage[];
}

export interface DocumentSearchResult {
  id: string;
  title: string;
  source: string;
  description?: string;
  tags?: string[];
  category?: string;
  updatedAt?: string;
}

export async function listConversations(limit = 20): Promise<ConversationSummary[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const response = await fetch(`/api/conversations?${params.toString()}`);
  if (!response.ok) await throwApiError(response, 'Unable to load conversations');
  const data = await response.json();
  return data.conversations || [];
}

export async function getConversation(sessionId: string): Promise<ConversationDetail> {
  const response = await fetch(`/api/conversations/${encodeURIComponent(sessionId)}`);
  if (!response.ok) await throwApiError(response, 'Unable to load conversation');
  const data = await response.json();
  return data.conversation;
}

export async function deleteConversation(sessionId: string): Promise<boolean> {
  const response = await fetch(`/api/conversations/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
  if (!response.ok) await throwApiError(response, 'Unable to delete conversation');
  const data = await response.json();
  return data.success === true;
}

export async function shareConversation(sessionId: string, title?: string) {
  const response = await fetch(`/api/conversations/${encodeURIComponent(sessionId)}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, public: true, expiresInDays: 7 }),
  });
  if (!response.ok) await throwApiError(response, 'Unable to share conversation');
  return response.json();
}

export async function getSharedConversation(shareId: string, password?: string) {
  const params = new URLSearchParams();
  if (password) params.set('password', password);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`/api/share/${encodeURIComponent(shareId)}${suffix}`);
  if (!response.ok) await throwApiError(response, 'Unable to load shared conversation');
  return response.json();
}

export async function getQuickReplies(lastMessage: string, lastResponse: string, context?: Record<string, unknown>): Promise<string[]> {
  const params = new URLSearchParams({ lastMessage, lastResponse });
  if (context) params.set('context', JSON.stringify(context));
  const response = await fetch(`/api/chat/quick-replies?${params.toString()}`);
  if (!response.ok) await throwApiError(response, 'Unable to load quick replies');
  const data = await response.json();
  return data.replies || [];
}

export async function searchDocuments(q: string, limit = 10): Promise<DocumentSearchResult[]> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  const response = await fetch(`/api/documents/search?${params.toString()}`);
  if (!response.ok) await throwApiError(response, 'Unable to search documents');
  const data = await response.json();
  return data.documents || [];
}
