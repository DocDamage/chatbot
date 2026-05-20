import { useMemo, useRef, useState } from 'react';
import {
  ActionBarPrimitive,
  AppendMessage,
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadMessageLike,
  ThreadPrimitive,
  useExternalStoreRuntime
} from '@assistant-ui/react';
import ModeSelector, { ChatMode } from './ModeSelector';
import StatusBar from './StatusBar';
import FLStudioControlPanel from './FLStudioControlPanel';
import KnowledgeOSPanel from './KnowledgeOSPanel';
import './AssistantChat.css';

const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: ChatMode;
  createdAt: string;
  status?: 'running' | 'complete' | 'error';
};

const modeHints: Record<ChatMode, string> = {
  ask: 'General Q&A',
  plan: 'Planning mode',
  implement: 'Implementation mode',
  debug: 'Debug mode',
  explain: 'Explain mode',
  pop_culture: 'Pop Culture mode',
  history: 'History mode',
  science: 'Science & Inventions mode',
  music: 'Music Production mode',
  suno: 'Suno prompt mode',
  fl_studio: 'FL Studio mode',
  fl_studio_control: 'FL Studio dry-run control',
  pro_tools: 'Pro Tools mode',
  logic: 'Logic Pro mode',
  mix_master: 'Mix/Master mode',
  knowledge_os: 'Knowledge OS mode'
};

const placeholders: Record<ChatMode, string> = {
  ask: 'Ask a question...',
  plan: 'Describe what you want to build...',
  implement: 'Tell me what code to write...',
  debug: 'Paste an error or describe the bug...',
  explain: 'What should I explain?',
  pop_culture: 'Ask about eras, works, influence, or franchises...',
  history: 'Ask about periods, causes, timelines, or sources...',
  science: 'Ask about inventions, discoveries, papers, or patents...',
  music: 'Ask about beats, chords, arrangements, vocals, or DAWs...',
  suno: 'Describe the Suno prompt, hook, revision, or style blend...',
  fl_studio: 'Ask about Channel Rack, Piano Roll, 808s, mixer, or export...',
  fl_studio_control: 'Ask me to plan FL Studio control actions...',
  pro_tools: 'Ask about recording, playlists, comping, routing, or stems...',
  logic: 'Ask about Logic MIDI, vocals, Session Players, Flex, or bounce...',
  mix_master: 'Describe the mix/master problem or target...',
  knowledge_os: 'Ask about the local DB, graph, wiki, memory, or evidence...'
};

const convertMessage = (message: ChatMessage): ThreadMessageLike => {
  const baseMessage = {
    role: message.role,
    content: [{ type: 'text' as const, text: message.content }],
    metadata: {
      custom: {
        id: message.id,
        mode: message.mode,
        createdAt: message.createdAt
      }
    }
  };

  if (message.role === 'assistant') {
    return {
      ...baseMessage,
      role: 'assistant',
      status: message.status === 'running'
        ? { type: 'running' }
        : message.status === 'error'
          ? { type: 'incomplete', reason: 'error' }
          : { type: 'complete', reason: 'stop' }
    };
  }

  return {
    ...baseMessage,
    role: 'user'
  };
};

function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<ChatMode>('ask');
  const [sessionId] = useState(() => uuidv4());
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendToBackend = async (input: string, selectedMode: ChatMode) => {
    const controller = new AbortController();
    abortRef.current = controller;

    const assistantId = uuidv4();
    setMessages(prev => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: 'Thinking...',
        mode: selectedMode,
        createdAt: new Date().toISOString(),
        status: 'running'
      }
    ]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: input,
          sessionId,
          mode: selectedMode,
          systemPrompt: getSystemPrompt(selectedMode)
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setMessages(prev => prev.map(message => message.id === assistantId
        ? {
            ...message,
            id: data.artifactId || message.id,
            content: data.response || '',
            status: 'complete'
          }
        : message
      ));
    } catch (error: any) {
      const content = error.name === 'AbortError'
        ? 'Response stopped.'
        : `Sorry, I encountered an error: ${error.message || 'Unknown error'}. Please try again.`;

      setMessages(prev => prev.map(message => message.id === assistantId
        ? { ...message, content, status: 'error' }
        : message
      ));
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  };

  const sendUserMessage = async (text: string, selectedMode: ChatMode) => {
    if (!text || isRunning) return;

    setMessages(prev => [
      ...prev,
      {
        id: uuidv4(),
        role: 'user',
        content: text,
        mode: selectedMode,
        createdAt: new Date().toISOString(),
        status: 'complete'
      }
    ]);
    setIsRunning(true);
    await sendToBackend(text, selectedMode);
  };

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    isSendDisabled: isRunning,
    convertMessage,
    setMessages: nextMessages => setMessages([...nextMessages]),
    onNew: async (message: AppendMessage) => {
      const text = message.content.find(part => part.type === 'text')?.text?.trim();
      if (!text || isRunning) return;

      await sendUserMessage(text, mode);
    },
    onCancel: async () => {
      abortRef.current?.abort();
    },
    unstable_capabilities: {
      copy: true
    }
  });

  const completedMessageCount = useMemo(
    () => messages.filter(message => message.status !== 'running').length,
    [messages]
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <section className="assistant-chat" aria-label="AI chat">
        <div className="assistant-toolbar">
          <ModeSelector mode={mode} onModeChange={setMode} />
          <span className="assistant-mode-hint">{modeHints[mode]}</span>
        </div>
        <KnowledgeOSPanel />
        {mode === 'fl_studio_control' && (
          <FLStudioControlPanel onSendCommand={command => sendUserMessage(command, 'fl_studio_control')} />
        )}
        <ThreadPrimitive.Root className="assistant-thread">
          <ThreadPrimitive.Viewport className="assistant-viewport">
            <ThreadPrimitive.Empty>
              <div className="assistant-empty">
                <div className="assistant-empty-icon">AI</div>
                <h2>Start a conversation</h2>
                <p>Ask a question, plan a feature, debug an issue, or explain code.</p>
              </div>
            </ThreadPrimitive.Empty>
            <ThreadPrimitive.Messages
              components={{
                UserMessage: UserBubble,
                AssistantMessage: AssistantBubble
              }}
            />
          </ThreadPrimitive.Viewport>
          <StatusBar isConnected={true} messageCount={completedMessageCount} />
          <ComposerPrimitive.Root className="assistant-composer">
            <ComposerPrimitive.Input
              className="assistant-input"
              placeholder={placeholders[mode]}
              submitMode="enter"
              rows={1}
            />
            {isRunning && (
              <ComposerPrimitive.Cancel className="assistant-stop-button">
                Stop
              </ComposerPrimitive.Cancel>
            )}
            <ComposerPrimitive.Send className="assistant-send-button" aria-label="Send message">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3.6 20.4 21 12 3.6 3.6l2.2 7.1L14 12l-8.2 1.3-2.2 7.1Z" />
              </svg>
            </ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.Root>
      </section>
    </AssistantRuntimeProvider>
  );
}

function UserBubble() {
  return <ChatBubble role="user" />;
}

function AssistantBubble() {
  return <ChatBubble role="assistant" />;
}

function ChatBubble({ role }: { role: 'user' | 'assistant' }) {
  return (
    <MessagePrimitive.Root className={`assistant-message assistant-message-${role}`}>
      <div className="assistant-message-shell">
        <MessagePrimitive.Parts components={{ Text: TextPart }} />
        {role === 'assistant' && (
          <ActionBarPrimitive.Root className="assistant-actions">
            <ActionBarPrimitive.Copy className="assistant-action">Copy</ActionBarPrimitive.Copy>
            <ActionBarPrimitive.Reload className="assistant-action">Retry</ActionBarPrimitive.Reload>
          </ActionBarPrimitive.Root>
        )}
      </div>
    </MessagePrimitive.Root>
  );
}

function TextPart() {
  return <MessagePartPrimitive.Text component="p" className="assistant-message-text" />;
}

function getSystemPrompt(mode: ChatMode): string {
  switch (mode) {
    case 'ask':
      return 'You are a helpful AI assistant. Answer questions clearly and concisely.';
    case 'plan':
      return 'You are a project planning assistant. Break work into clear, numbered implementation steps.';
    case 'implement':
      return 'You are an expert coding assistant. Prefer concrete implementation details and complete code.';
    case 'debug':
      return 'You are a debugging expert. Identify likely causes, evidence, minimal fixes, and verification steps.';
    case 'explain':
      return 'You are a coding teacher. Explain concepts in simple language with clear examples.';
    case 'pop_culture':
      return 'You are a pop culture specialist. Use time-aware retrieval, separate facts from subjective ranking, avoid copyrighted lyrics/scripts, and include era, key works, context, influence, legacy, disputes, and sources.';
    case 'history':
      return 'You are a history specialist. Use approximate dates when appropriate, separate primary/secondary/reference evidence, flag disputes, and include period/place, timeline, actors, causes, consequences, evidence quality, disputes, and sources.';
    case 'science':
      return 'You are a science and inventions specialist. Separate invention, discovery, popularization, commercialization, and prior art; flag uncertainty and obsolete theories; include dates, contributors, predecessors, principles, impact, disputes, and sources.';
    case 'music':
      return 'You are a Music Production Genius. Help with original beats, song structure, music theory, vocals, mixing, mastering, DAW workflows, and collaboration. Avoid copyrighted lyric continuation and artist cloning.';
    case 'suno':
      return 'You are a Suno prompt specialist. Return safe prompts with style tags, structure, vocal direction, revision guidance, avoid list, and rights/copyright note. Do not impersonate living artists or continue copyrighted lyrics.';
    case 'fl_studio':
      return 'You are an FL Studio specialist. Give Channel Rack, Piano Roll, Playlist, Mixer, automation, stock plugin, 808 tuning, sidechain, and export guidance.';
    case 'fl_studio_control':
      return 'You are an FL Studio MCP control specialist. Default to dry-run plans, list exact planned MCP actions, require confirmation for risky DAW changes, and never promise full FLP/VST automation.';
    case 'pro_tools':
      return 'You are a Pro Tools specialist. Give recording, session setup, low-latency monitoring, playlists, vocal comping, editing, signal flow, bus routing, mix prep, and stem export guidance.';
    case 'logic':
      return 'You are a Logic Pro specialist. Give project setup, MIDI/Piano Roll, Session Players, Flex Pitch/Time, stock instruments/effects, vocal production, arrangement, and bounce/export guidance.';
    case 'mix_master':
      return 'You are a mix and mastering specialist. Diagnose likely causes, provide a fix order, plugin chain suggestions, metering targets, reference checks, and safety/copyright boundaries.';
    case 'knowledge_os':
      return 'You are a Knowledge OS specialist. Answer using local database, graph, wiki, memory, and governance state. Prefer counts, sources, central nodes, schema, and concrete local evidence.';
    default:
      return 'You are a helpful AI assistant.';
  }
}

export default AssistantChat;
