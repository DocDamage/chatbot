import { useState } from 'react';
import { ConversationDetail, ConversationSummary, getConversation, listConversations } from '../api/conversations';

interface Props { disabled: boolean; onLoad: (conversation: ConversationDetail) => void; onNew: () => void }

/** Everyday conversation actions stay available without opening the advanced tools. */
export default function ConversationHistory({ disabled, onLoad, onNew }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refresh = async () => {
    setOpen(true);
    setLoading(true);
    setError('');
    try { setItems(await listConversations()); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not load conversations.'); }
    finally { setLoading(false); }
  };
  const load = async (sessionId: string) => {
    setLoading(true);
    setError('');
    try { onLoad(await getConversation(sessionId)); setOpen(false); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not reopen conversation.'); }
    finally { setLoading(false); }
  };
  return <div className="conversation-history">
    <div className="conversation-history-actions">
      <button type="button" disabled={disabled || loading} onClick={() => { onNew(); setOpen(false); }}>New chat</button>
      <button type="button" disabled={disabled || loading} aria-expanded={open} aria-controls="recent-conversations" onClick={() => open ? setOpen(false) : void refresh()}>History</button>
    </div>
    {open && <section id="recent-conversations" aria-label="Recent conversations">
      {loading && <p role="status">Loading conversations…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && items.length === 0 && <p>No saved conversations yet.</p>}
      <ul>{items.map(item => <li key={item.sessionId}>
        <button type="button" disabled={disabled || loading} onClick={() => void load(item.sessionId)}>{item.firstMessage.slice(0, 100) || 'Untitled conversation'}</button>
      </li>)}</ul>
    </section>}
  </div>;
}
