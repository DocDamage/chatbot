import React, { useState } from 'react';
import { Message as MessageType } from './ChatInterface';
import MessageActions from './MessageActions';
import './Message.css';

interface MessageProps {
  message: MessageType;
}

const Message: React.FC<MessageProps> = ({ message }) => {
  if (message.loading) {
    return (
      <div className="message message-assistant">
        <div className="message-content">
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    );
  }

  const [imageError, setImageError] = useState(false);

  return (
    <div className={`message message-${message.role}`}>
      <div className="message-content">
        {message.image && !imageError && (
          <div className="message-image">
            <img 
              src={message.image.startsWith('data:') ? message.image : `data:image/png;base64,${message.image}`}
              alt="Generated image"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          </div>
        )}
        {message.imageUrl && !imageError && (
          <div className="message-image">
            <img 
              src={message.imageUrl} 
              alt="Generated image"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          </div>
        )}
        {message.content && <p>{message.content}</p>}
        <div className="message-footer">
          <span className="message-timestamp">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.role === 'assistant' && message.content && (
            <MessageActions messageId={message.id} content={message.content} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Message;

