import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import ModeSelector, { ChatMode } from './ModeSelector';
import './MessageInput.css';

interface MessageInputProps {
  onSendMessage: (message: string, mode: ChatMode) => void;
  disabled?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, disabled }) => {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ChatMode>('ask');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSendMessage(input.trim(), mode);
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter to send
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  // Mode-specific placeholders
  const placeholders: Record<ChatMode, string> = {
    ask: 'Ask a question...',
    plan: 'Describe what you want to build...',
    implement: 'Tell me what code to write...',
    debug: 'Describe the problem or paste error...',
    explain: 'What code do you want me to explain?',
    pop_culture: 'Ask about eras, works, influence, or franchises...',
    history: 'Ask about periods, causes, timelines, or sources...',
    science: 'Ask about inventions, discoveries, papers, or patents...',
    gaming: 'Ask about games, engines, design, modding, lore, or strategy...',
    music: 'Ask about beats, chords, arrangements, vocals, or DAWs...',
    suno: 'Describe the Suno prompt, hook, revision, or style blend...',
    fl_studio: 'Ask about Channel Rack, Piano Roll, 808s, mixer, or export...',
    fl_studio_control: 'Ask me to plan FL Studio control actions...',
    pro_tools: 'Ask about recording, playlists, comping, routing, or stems...',
    logic: 'Ask about Logic MIDI, vocals, Session Players, Flex, or bounce...',
    mix_master: 'Describe the mix/master problem or target...',
    knowledge_os: 'Ask about local DB, graph, wiki, memory, or evidence...'
  };

  return (
    <div className="message-input-container">
      <div className="message-input-header">
        <ModeSelector mode={mode} onModeChange={setMode} />
        <div className="mode-hint">
          {mode === 'ask' && '💡 I\'ll answer your questions'}
          {mode === 'plan' && '📋 I\'ll create a step-by-step plan'}
          {mode === 'implement' && '⚡ I\'ll write code and create files'}
          {mode === 'debug' && '🔧 I\'ll find and fix the problem'}
          {mode === 'explain' && '📖 I\'ll explain in simple terms'}
          {mode === 'pop_culture' && '🎬 I\'ll map culture through time'}
          {mode === 'history' && '🏛️ I\'ll handle dates and sources carefully'}
          {mode === 'science' && '🔬 I\'ll trace inventions and discoveries'}
          {mode === 'gaming' && '🎮 I\'ll cover games, engines, lore, modding, speedruns, and strategy'}
          {mode === 'music' && '🎛️ I\'ll help produce, arrange, mix, and translate DAW workflows'}
          {mode === 'suno' && '🎤 I\'ll build safe Suno prompts and revision plans'}
          {mode === 'fl_studio' && '🎹 I\'ll guide FL Studio patterns, 808s, mixer, and export'}
          {mode === 'fl_studio_control' && '🎛️ I\'ll dry-run FL Studio MCP control actions before touching the DAW'}
          {mode === 'pro_tools' && '🎚️ I\'ll guide Pro Tools recording, comping, routing, and stems'}
          {mode === 'logic' && '🎼 I\'ll guide Logic MIDI, vocals, Session Players, and bounce'}
          {mode === 'mix_master' && '📊 I\'ll diagnose mix/master issues and metering targets'}
          {mode === 'knowledge_os' && '🧠 I\'ll inspect the local DB, graph, wiki, memory, and evidence'}
        </div>
      </div>
      <div className="message-input-wrapper">
        <textarea
          ref={textareaRef}
          className="message-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          onKeyDown={handleKeyDown}
          placeholder={placeholders[mode]}
          rows={1}
          disabled={disabled}
          maxLength={10000}
        />
        <button
          className="send-button"
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          title={`Send (${mode} mode)`}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
