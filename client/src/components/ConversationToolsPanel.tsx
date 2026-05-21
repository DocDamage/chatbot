import { useState } from 'react';
import {
  ConversationDetail,
  ConversationSummary,
  DocumentSearchResult,
  deleteConversation,
  getConversation,
  getQuickReplies,
  listConversations,
  searchDocuments,
  shareConversation,
} from '../api/conversations';
import './ConversationToolsPanel.css';

interface ConversationToolsPanelProps {
  sessionId: string;
  lastUserMessage?: string;
  lastAssistantMessage?: string;
  onLoadConversation: (conversation: ConversationDetail) => void;
  onUseQuickReply: (reply: string) => void;
}

function ConversationToolsPanel({
  sessionId,
  lastUserMessage = '',
  lastAssistantMessage = '',
  onLoadConversation,
  onUseQuickReply,
}: ConversationToolsPanelProps) {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [documents, setDocuments] = useState<DocumentSearchResult[]>([]);
  const [documentQuery, setDocumentQuery] = useState('');
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [shareUrl, setShareUrl] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async (task: () => Promise<void>, success?: string) => {
    setLoading(true);
    setError('');
    setStatus('');
    try {
      await task();
      if (success) setStatus(success);
    } catch (error: any) {
      setError(error.message || 'Conversation workflow failed');
    } finally {
      setLoading(false);
    }
  };

  const refreshConversations = async () => {
    await run(async () => {
      setConversations(await listConversations(20));
    }, 'Conversation list refreshed');
  };

  const loadConversation = async (conversationSessionId: string) => {
    await run(async () => {
      const conversation = await getConversation(conversationSessionId);
      onLoadConversation(conversation);
    }, 'Conversation loaded');
  };

  const removeConversation = async (conversationSessionId: string) => {
    await run(async () => {
      await deleteConversation(conversationSessionId);
      setConversations(value => value.filter(item => item.sessionId !== conversationSessionId));
    }, 'Conversation deleted');
  };

  const createShare = async () => {
    await run(async () => {
      const result = await shareConversation(sessionId, 'Shared chat');
      setShareUrl(result.url || result.shareId || '');
    }, 'Share link created');
  };

  const loadQuickReplies = async () => {
    await run(async () => {
      setQuickReplies(await getQuickReplies(lastUserMessage, lastAssistantMessage, { sessionId }));
    }, 'Quick replies refreshed');
  };

  const runDocumentSearch = async () => {
    await run(async () => {
      setDocuments(await searchDocuments(documentQuery, 10));
    }, 'Document search complete');
  };

  return (
    <section className="conversation-tools" aria-label="Conversation tools">
      <button className="conversation-tools-toggle" type="button" onClick={() => setOpen(value => !value)}>
        <span>Conversation Tools</span>
        <span>{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="conversation-tools-body">
          <div className="conversation-tools-actions">
            <button type="button" onClick={refreshConversations} disabled={loading}>Refresh History</button>
            <button type="button" onClick={createShare} disabled={loading}>Share Current Chat</button>
            <button type="button" onClick={loadQuickReplies} disabled={loading || (!lastUserMessage && !lastAssistantMessage)}>Quick Replies</button>
          </div>

          {shareUrl && (
            <output className="conversation-tools-share" aria-label="Share link">{shareUrl}</output>
          )}

          {quickReplies.length > 0 && (
            <div className="conversation-tools-replies" aria-label="Quick replies">
              {quickReplies.map(reply => (
                <button key={reply} type="button" onClick={() => onUseQuickReply(reply)}>{reply}</button>
              ))}
            </div>
          )}

          <div className="conversation-tools-grid">
            <div className="conversation-tools-list">
              <strong>History</strong>
              {conversations.length === 0 && <span className="conversation-tools-muted">No conversations loaded</span>}
              {conversations.map(conversation => (
                <div key={conversation.sessionId} className="conversation-tools-row">
                  <button type="button" onClick={() => loadConversation(conversation.sessionId)} disabled={loading}>
                    <span>{conversation.firstMessage || conversation.sessionId}</span>
                    <small>{conversation.messageCount} messages</small>
                  </button>
                  <button type="button" onClick={() => removeConversation(conversation.sessionId)} disabled={loading} aria-label={`Delete ${conversation.sessionId}`}>
                    Delete
                  </button>
                </div>
              ))}
            </div>

            <div className="conversation-tools-documents">
              <label>
                <span>Document search</span>
                <div>
                  <input value={documentQuery} onChange={event => setDocumentQuery(event.target.value)} placeholder="Search documents" />
                  <button type="button" onClick={runDocumentSearch} disabled={loading || !documentQuery.trim()}>Search</button>
                </div>
              </label>
              {documents.map(document => (
                <article key={document.id || document.source}>
                  <strong>{document.title || document.source}</strong>
                  <small>{document.source}</small>
                </article>
              ))}
            </div>
          </div>

          {status && <div className="conversation-tools-status">{status}</div>}
          {error && <div className="conversation-tools-error">{error}</div>}
        </div>
      )}
    </section>
  );
}

export default ConversationToolsPanel;
