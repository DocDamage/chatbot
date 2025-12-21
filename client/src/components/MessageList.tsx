import React from 'react';
import Message from './Message';
import { Message as MessageType } from './ChatInterface';
import './MessageList.css';

interface MessageListProps {
  messages: MessageType[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  return (
    <div className="message-list">
      {messages.length === 0 ? (
        <div className="empty-state">
          <p>Start a conversation by typing a message below</p>
        </div>
      ) : (
        messages.map(message => (
          <Message key={message.id} message={message} />
        ))
      )}
    </div>
  );
};

export default MessageList;

