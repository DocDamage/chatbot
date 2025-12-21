import React, { useState } from 'react';
import './MessageActions.css';

interface MessageActionsProps {
  messageId: string;
  content: string;
  onCopy?: () => void;
  onRegenerate?: () => void;
}

const MessageActions: React.FC<MessageActionsProps> = ({ 
  messageId, 
  content, 
  onCopy,
  onRegenerate 
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="message-actions">
      <button
        className="action-button"
        onClick={handleCopy}
        title="Copy message"
        aria-label="Copy message"
      >
        {copied ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        )}
      </button>
      {onRegenerate && (
        <button
          className="action-button"
          onClick={onRegenerate}
          title="Regenerate response"
          aria-label="Regenerate response"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>
      )}
    </div>
  );
};

export default MessageActions;

