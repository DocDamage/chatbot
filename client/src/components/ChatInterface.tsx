import React, { useState, useRef, useEffect } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import StatusBar from './StatusBar';
import './ChatInterface.css';

const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  loading?: boolean;
  image?: string; // Base64 encoded image
  imageUrl?: string;
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId] = useState(() => uuidv4());
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Add loading message
    const loadingMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      loading: true
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: content,
          sessionId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Remove loading message and add response
      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.loading);
        return [
          ...filtered,
          {
            id: data.artifactId,
            role: 'assistant',
            content: data.response,
            timestamp: new Date(),
            image: data.image,
            imageUrl: data.imageUrl
          }
        ];
      });
    } catch (error: any) {
      // Remove loading message and add error
      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.loading);
        const errorMessage = error.message?.includes('Rate limit') 
          ? 'Too many requests. Please wait a moment and try again.'
          : error.message?.includes('Network') || error.message?.includes('Failed to fetch')
          ? 'Network error. Please check your connection and try again.'
          : `Sorry, I encountered an error: ${error.message || 'Unknown error'}. Please try again.`;
        
        return [
          ...filtered,
          {
            id: uuidv4(),
            role: 'assistant',
            content: errorMessage,
            timestamp: new Date()
          }
        ];
      });
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-interface">
      <MessageList messages={messages} />
      <div ref={messagesEndRef} />
      <StatusBar isConnected={true} messageCount={messages.filter(m => !m.loading).length} />
      <MessageInput onSendMessage={handleSendMessage} disabled={isLoading} />
    </div>
  );
};

export default ChatInterface;

