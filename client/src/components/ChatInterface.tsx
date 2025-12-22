import React, { useState, useRef, useEffect } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import StatusBar from './StatusBar';
import { ChatMode } from './ModeSelector';
import './ChatInterface.css';

const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
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
  image?: string;
  imageUrl?: string;
  mode?: ChatMode;
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

  const handleSendMessage = async (content: string, mode: ChatMode = 'ask') => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date(),
      mode
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Add loading message with thinking indicator
    const loadingMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: getLoadingText(mode),
      timestamp: new Date(),
      loading: true,
      mode
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      // Build system prompt based on mode
      const systemPrompt = getSystemPrompt(mode);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: content,
          sessionId,
          mode,
          systemPrompt
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
            id: data.artifactId || uuidv4(),
            role: 'assistant',
            content: data.response,
            timestamp: new Date(),
            image: data.image,
            imageUrl: data.imageUrl,
            mode
          }
        ];
      });
    } catch (error: any) {
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

// Mode-specific loading text
function getLoadingText(mode: ChatMode): string {
  switch (mode) {
    case 'ask': return '🤔 Thinking...';
    case 'plan': return '📋 Creating a plan...';
    case 'implement': return '⚡ Writing code...';
    case 'debug': return '🔧 Analyzing the problem...';
    case 'explain': return '📖 Preparing explanation...';
    default: return 'Thinking...';
  }
}

// Mode-specific system prompts
function getSystemPrompt(mode: ChatMode): string {
  switch (mode) {
    case 'ask':
      return `You are a helpful AI assistant. Answer questions clearly and concisely. 
If the user asks about code, provide explanations that a non-programmer can understand.`;

    case 'plan':
      return `You are a project planning assistant. When the user describes what they want to build:
1. Break it down into clear, numbered steps
2. Explain each step in simple terms
3. Identify what files or components need to be created
4. Estimate complexity (simple/medium/complex)
5. Ask clarifying questions if needed

Format your response as a clear plan that anyone can follow.`;

    case 'implement':
      return `You are an expert coding assistant. When the user asks you to implement something:
1. Write clean, working code
2. Create complete files, not just snippets
3. Include helpful comments
4. Explain what the code does after showing it
5. If creating multiple files, clearly label each one

Always provide complete, runnable code. The user is not a programmer, so make it easy to use.`;

    case 'debug':
      return `You are a debugging expert. When the user describes a problem:
1. Identify the likely cause
2. Explain the problem in simple terms
3. Provide a fix with complete code
4. Explain what was wrong and why the fix works
5. Suggest how to prevent similar issues

Be patient and thorough. The user may not understand technical terms.`;

    case 'explain':
      return `You are a coding teacher explaining things to a complete beginner. When explaining code:
1. Use simple, everyday language
2. Avoid jargon - if you must use technical terms, define them
3. Use analogies to explain concepts
4. Break complex things into small, digestible parts
5. Be encouraging and supportive

Remember: the user knows NOTHING about programming. Explain like you're talking to a curious friend.`;

    default:
      return 'You are a helpful AI assistant.';
  }
}

export default ChatInterface;
