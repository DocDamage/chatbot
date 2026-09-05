import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionBarPrimitive,
  AppendMessage,
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadMessageLike,
  ThreadPrimitive,
  useExternalStoreRuntime,
  useMessage,
} from '@assistant-ui/react';
import ModeSelector, { ChatMode } from './ModeSelector';
import StatusBar from './StatusBar';
import FLStudioControlPanel from './FLStudioControlPanel';
import KnowledgeOSPanel from './KnowledgeOSPanel';
import KnowledgeOnlinePanel from './KnowledgeOnlinePanel';
import GamingPlaybookPanel from './GamingPlaybookPanel';
import FileExplorerPanel from './FileExplorerPanel';
import LoadedFilesBar from './LoadedFilesBar';
import AudioPreviewBrowser from './AudioPreviewBrowser';
import CodeWorkflowPanel from './CodeWorkflowPanel';
import ConversationToolsPanel from './ConversationToolsPanel';
import CreativeComposerPanel, { buildCreativeRequestPayload, defaultCreativeComposerState } from './CreativeComposerPanel';
import KnowledgeMissPrompt from './KnowledgeMissPrompt';
import PlanActionBar from './PlanActionBar';
import GISMapPanel from '../features/gis/GISMapPanel';
import { SourcesDrawer } from './SourcesDrawer';
import { WhyThisAnswerModal } from './WhyThisAnswerModal';
import { ResponseFeedbackBar } from './ResponseFeedbackBar';
import type { SourcesDrawerData, WhyThisAnswerDiagnostics } from '../../../src/types/citation';
import { LoadedFileContext } from '../api/files';
import { AudioFileContext } from '../api/audio';
import type { ConversationDetail } from '../api/conversations';
import { deepResearchOnlineKnowledge, ingestOnlineKnowledge } from '../api/knowledge';
import { isStaticPagesBuild } from '../api/runtime';
import { throwApiError } from '../api/errors';
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
  sourcesDrawerData?: SourcesDrawerData;
  diagnostics?: WhyThisAnswerDiagnostics;
};

type ConnectionState = 'connected' | 'degraded' | 'connecting' | 'disconnected';

type KnowledgeMissDetail = {
  knowledgeMiss: true;
  type?: 'knowledge_miss';
  message: string;
  domain: string;
  proposedWebQuery: string;
  recommendedSources: string[];
  canSearchOnline: true;
  suggestedNextAction: 'search_online';
};

export function resolveKnowledgeMissState(
  data: any,
  input: string,
  selectedMode: ChatMode
): { query: string; domain: string; recommendedSources?: string[] } | null {
  const missDetail: KnowledgeMissDetail | undefined = data.knowledgeMissDetail || data.miss;
  if (missDetail?.knowledgeMiss || data.knowledgeMiss === true) {
    return {
      query: missDetail?.proposedWebQuery || data.proposedWebQuery || input,
      domain: missDetail?.domain || data.mode || selectedMode,
      recommendedSources: missDetail?.recommendedSources
    };
  }
  return null;
}

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
  gaming: 'Gaming mode',
  math: 'Math mode',
  market: 'Market mode',
  gamedev: 'Game Dev mode',
  suno: 'Suno prompt mode',
  fl_studio: 'FL Studio mode',
  fl_studio_control: 'FL Studio dry-run control',
  pro_tools: 'Pro Tools mode',
  logic: 'Logic Pro mode',
  mix_master: 'Mix/Master mode',
  story: 'Story mode',
  creative_writing: 'Creative Writing mode',
  roleplay: 'Roleplay mode',
  legal: 'Legal/Civic mode',
  health: 'Health mode',
  security: 'Security mode',
  business: 'Business mode',
  philosophy: 'Philosophy mode',
  language: 'Language mode',
  geography: 'Geography mode',
  gis: 'GIS mapping mode',
  engineering: 'Engineering mode',
  knowledge_os: 'Knowledge OS mode'
};

type TaskArtifact = {
  name: string;
  path: string;
  url: string;
  mimeType: string;
  kind: string;
};

const simpleModeOptions: Array<{ value: ChatMode; label: string }> = [
  { value: 'ask', label: 'Ask' },
  { value: 'plan', label: 'Plan' },
  { value: 'implement', label: 'Build' },
  { value: 'debug', label: 'Debug' },
  { value: 'explain', label: 'Explain' }
];

const categoryOptions: Array<{ value: ChatMode; label: string }> = [
  { value: 'pop_culture', label: 'Pop Culture' },
  { value: 'history', label: 'History' },
  { value: 'science', label: 'Science' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'math', label: 'Math' },
  { value: 'market', label: 'Market' },
  { value: 'gamedev', label: 'Game Dev' },
  { value: 'music', label: 'Music' },
  { value: 'suno', label: 'Suno' },
  { value: 'fl_studio', label: 'FL Studio' },
  { value: 'fl_studio_control', label: 'FL Control' },
  { value: 'pro_tools', label: 'Pro Tools' },
  { value: 'logic', label: 'Logic Pro' },
  { value: 'mix_master', label: 'Mix/Master' },
  { value: 'story', label: 'Story' },
  { value: 'creative_writing', label: 'Creative Writing' },
  { value: 'roleplay', label: 'Roleplay' },
  { value: 'legal', label: 'Legal/Civic' },
  { value: 'health', label: 'Health' },
  { value: 'security', label: 'Security' },
  { value: 'business', label: 'Business' },
  { value: 'philosophy', label: 'Philosophy' },
  { value: 'language', label: 'Language' },
  { value: 'geography', label: 'Geography' },
  { value: 'gis', label: 'GIS' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'knowledge_os', label: 'Knowledge OS' }
];

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
  gaming: 'Ask about games, engines, design, modding, lore, or strategy...',
  math: 'Ask for calculations, symbolic math, or proof help...',
  market: 'Ask about market risks, filings, macro, or scenarios...',
  gamedev: 'Ask about game mechanics, balance, engines, or playtests...',
  suno: 'Describe the Suno prompt, hook, revision, or style blend...',
  fl_studio: 'Ask about Channel Rack, Piano Roll, 808s, mixer, or export...',
  fl_studio_control: 'Ask me to plan FL Studio control actions...',
  pro_tools: 'Ask about recording, playlists, comping, routing, or stems...',
  logic: 'Ask about Logic MIDI, vocals, Session Players, Flex, or bounce...',
  mix_master: 'Describe the mix/master problem or target...',
  story: 'Ask about characters, worlds, scenes, quests, or continuity...',
  creative_writing: 'Draft, revise, outline, or export fiction...',
  roleplay: 'Set the scene, character, action, or out-of-character note...',
  legal: 'Ask a legal/civic question with jurisdiction...',
  health: 'Ask about fitness, nutrition, anatomy, or safety boundaries...',
  security: 'Ask about threat models, auth, privacy, or code risk...',
  business: 'Ask about strategy, pricing, KPIs, or unit economics...',
  philosophy: 'Ask about arguments, ethics, debate, or philosophy history...',
  language: 'Ask for translation, tone, grammar, rhetoric, or speech help...',
  geography: 'Ask about countries, culture, maps, or demographics...',
  gis: 'Ask for geocoding, routing, layer imports, parcels, or spatial analysis...',
  engineering: 'Ask about circuits, robotics, mechanics, or prototypes...',
  knowledge_os: 'Ask about the local DB, graph, wiki, memory, or evidence...'
};

const onlineResearchModes: ChatMode[] = [
  'ask',
  'pop_culture',
  'music',
  'knowledge_os',
  'gaming',
  'gamedev',
  'engineering',
  'science',
  'history',
  'market',
  'legal',
  'health'
];

const convertMessage = (message: ChatMessage): ThreadMessageLike => {
  const baseMessage = {
    role: message.role,
    content: [{ type: 'text' as const, text: message.content }],
    metadata: {
      custom: {
        id: message.id,
        mode: message.mode,
        createdAt: message.createdAt,
        sourcesDrawerData: message.sourcesDrawerData,
        diagnostics: message.diagnostics,
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

interface AssistantChatProps {
  advancedOpen?: boolean;
}

function AssistantChat({ advancedOpen = true }: AssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<ChatMode>('ask');
  const [contextOpen, setContextOpen] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const [isRunning, setIsRunning] = useState(false);
  const [loadedFiles, setLoadedFiles] = useState<LoadedFileContext[]>([]);
  const [loadedAudio, setLoadedAudio] = useState<AudioFileContext[]>([]);
  const [planAction, setPlanAction] = useState<{ planId: string; planPath: string } | null>(null);
  const [knowledgePreview, setKnowledgePreview] = useState<any>(null);
  const [knowledgeMiss, setKnowledgeMiss] = useState<{ query: string; domain: string; recommendedSources?: string[] } | null>(null);
  const [knowledgeActionError, setKnowledgeActionError] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [creativeConfig, setCreativeConfig] = useState(defaultCreativeComposerState);
  const [taskArtifacts, setTaskArtifacts] = useState<TaskArtifact[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const showBackendPanels = !isStaticPagesBuild && advancedOpen;
  const showAudioBrowser = showBackendPanels && ['music', 'fl_studio', 'fl_studio_control', 'pro_tools', 'logic', 'mix_master'].includes(mode);
  const showCodeWorkflows = showBackendPanels && ['ask', 'plan', 'implement', 'debug', 'explain'].includes(mode);
  const showCreativeComposer = advancedOpen && (mode === 'creative_writing' || mode === 'roleplay');
  const showGISPanel = showBackendPanels && mode === 'gis';
  const showGamingPlaybooks = showBackendPanels && (mode === 'gaming' || mode === 'gamedev');
  const showKnowledgeOnlinePanel = showBackendPanels && onlineResearchModes.includes(mode);
  const selectedCategoryLabel = categoryOptions.find(option => option.value === mode)?.label || 'General';

  useEffect(() => {
    let active = true;

    const checkHealth = async () => {
      try {
        const response = await fetch('/health/ready', { cache: 'no-store' });
        if (!active) return;
        setConnectionState(response.ok ? 'connected' : 'degraded');
      } catch {
        if (active) {
          setConnectionState('disconnected');
        }
      }
    };

    void checkHealth();
    const timer = window.setInterval(checkHealth, 10000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const sendToBackend = async (input: string, selectedMode: ChatMode) => {
    setTaskArtifacts([]);
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
          systemPrompt: getSystemPrompt(selectedMode),
          creative: buildCreativeRequest(input, selectedMode, creativeConfig),
          loadedFiles,
          loadedAudio,
          activePlanId: planAction?.planId,
          activeFileBrowserMode: 'workspace'
        })
      });

      if (!response.ok) {
        await throwApiError(response, `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setTaskArtifacts(Array.isArray(data.artifacts) ? data.artifacts : []);
      if (data.planId && data.planPath) {
        setPlanAction({ planId: data.planId, planPath: data.planPath });
      }
      const nextKnowledgeMiss = resolveKnowledgeMissState(data, input, selectedMode);
      if (nextKnowledgeMiss) {
        setKnowledgeMiss(nextKnowledgeMiss);
        setKnowledgeActionError('');
      } else {
        setKnowledgeMiss(null);
        setKnowledgePreview(null);
        setKnowledgeActionError('');
      }
      setMessages(prev => prev.map(message => message.id === assistantId
        ? {
            ...message,
            id: data.artifactId || message.id,
            content: data.response || '',
            status: 'complete',
            sourcesDrawerData: data.sourcesDrawerData,
            diagnostics: data.diagnostics,
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
      setTaskArtifacts([]);
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
  const lastUserMessage = useMemo(
    () => [...messages].reverse().find(message => message.role === 'user')?.content || '',
    [messages]
  );
  const lastAssistantMessage = useMemo(
    () => [...messages].reverse().find(message => message.role === 'assistant' && message.status !== 'running')?.content || '',
    [messages]
  );

  const addLoadedFile = (file: LoadedFileContext) => {
    setLoadedFiles(prev => [file, ...prev.filter(item => item.path !== file.path)].slice(0, 8));
  };

  const addLoadedAudio = (audio: AudioFileContext) => {
    setLoadedAudio(prev => [audio, ...prev.filter(item => item.path !== audio.path)].slice(0, 8));
  };

  const loadConversation = (conversation: ConversationDetail) => {
    setMessages(conversation.messages.map(message => ({
      id: message.id,
      role: message.role,
      content: message.content,
      mode: (message.metadata?.mode as ChatMode | undefined) || mode,
      createdAt: message.timestamp,
      status: 'complete'
    })));
  };

  const runOnlineSearch = async () => {
    if (!knowledgeMiss) return;
    try {
      setKnowledgeActionError('');
      setKnowledgePreview(await deepResearchOnlineKnowledge(knowledgeMiss.query, knowledgeMiss.domain));
    } catch (error: any) {
      setKnowledgeActionError(error.message || 'Online search failed');
    }
  };

  const ingestPreview = async () => {
    if (!knowledgePreview) return;
    try {
      setKnowledgeActionError('');
      await ingestOnlineKnowledge(knowledgePreview, sessionId);
      setKnowledgePreview(null);
      setKnowledgeMiss(null);
    } catch (error: any) {
      setKnowledgeActionError(error.message || 'Knowledge ingestion failed');
    }
  };

  const discardKnowledgePreview = () => {
    setKnowledgePreview(null);
    setKnowledgeActionError('');
  };

  const openPlan = async (planId: string) => {
    try {
      const response = await fetch(`/api/plans/${encodeURIComponent(planId)}`);
      if (!response.ok) {
        await throwApiError(response, 'Unable to open plan');
      }
      const plan = await response.json();
      setMessages(prev => [
        ...prev,
        {
          id: uuidv4(),
          role: 'assistant',
          content: plan.content || plan.summary || `Plan ${planId} loaded.`,
          mode: 'plan',
          createdAt: new Date().toISOString(),
          status: 'complete'
        }
      ]);
    } catch (error: any) {
      setKnowledgeActionError(error.message || 'Unable to open plan');
    }
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="assistant-workspace">
        {showBackendPanels && <FileExplorerPanel onLoadFile={addLoadedFile} />}
        <section className="assistant-chat" aria-label="AI chat">
          <div className="assistant-toolbar">
            <div className="assistant-toolbar-controls">
              {advancedOpen ? (
                <ModeSelector mode={mode} onModeChange={setMode} />
              ) : (
                <label className="simple-mode-picker">
                  <span>Mode</span>
                    <select value={mode} onChange={event => setMode(event.target.value as ChatMode)} aria-label="Chat mode" title="Choose how the assistant should work: ask, plan, build, debug, or explain">
                    {!simpleModeOptions.some(option => option.value === mode) && (
                      <option value={mode}>{modeHints[mode]}</option>
                    )}
                    {simpleModeOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {!advancedOpen && (
                <div className="context-control">
                  <button
                    type="button"
                    className="context-toggle"
                    aria-expanded={contextOpen}
                    aria-controls="chat-context-panel"
                    title="Choose a specialist category without opening the full workspace"
                    onClick={() => setContextOpen(previous => !previous)}
                  >
                    <span>Context</span>
                    <strong>{selectedCategoryLabel}</strong>
                    <span aria-hidden="true">⌄</span>
                  </button>
                  {contextOpen && (
                    <div id="chat-context-panel" className="context-popover" role="dialog" aria-label="Chat context">
                      <div className="context-popover-heading">
                        <strong>Conversation context</strong>
                        <span>Focus the answer without opening developer tools.</span>
                      </div>
                      <label className="context-picker">
                        <span>Specialist category</span>
                        <select
                          value={categoryOptions.some(option => option.value === mode) ? mode : ''}
                          onChange={event => setMode(event.target.value as ChatMode)}
                          aria-label="Chat category"
                          title="Choose the subject area for this conversation"
                        >
                          <option value="">General</option>
                          {categoryOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <p>{modeHints[mode]}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <span className="assistant-mode-hint">{advancedOpen ? modeHints[mode] : 'Focused chat'}</span>
          </div>
          {showBackendPanels && <KnowledgeOSPanel />}
          {showGamingPlaybooks && <GamingPlaybookPanel />}
          {showKnowledgeOnlinePanel && <KnowledgeOnlinePanel />}
          {showBackendPanels && (
            <ConversationToolsPanel
              sessionId={sessionId}
              lastUserMessage={lastUserMessage}
              lastAssistantMessage={lastAssistantMessage}
              onLoadConversation={loadConversation}
              onUseQuickReply={reply => sendUserMessage(reply, mode)}
            />
          )}
          {showCodeWorkflows && <CodeWorkflowPanel mode={mode} />}
          {showCreativeComposer && (
            <CreativeComposerPanel
              mode={mode}
              value={creativeConfig}
              onChange={setCreativeConfig}
              onActionCommand={command => sendUserMessage(command, mode)}
            />
          )}
          {showGISPanel && <GISMapPanel />}
          {showAudioBrowser && <AudioPreviewBrowser onLoadAudio={addLoadedAudio} />}
          {advancedOpen && mode === 'fl_studio_control' && (
            <FLStudioControlPanel onSendCommand={command => sendUserMessage(command, 'fl_studio_control')} />
          )}
          {advancedOpen && planAction && (
            <PlanActionBar
              planId={planAction.planId}
              planPath={planAction.planPath}
              onSwitchToImplement={() => setMode('implement')}
              onOpenPlan={openPlan}
            />
          )}
          {knowledgeMiss && !knowledgePreview && (
            <KnowledgeMissPrompt
              query={knowledgeMiss.query}
              domain={knowledgeMiss.domain}
              recommendedSources={knowledgeMiss.recommendedSources}
              onSearch={runOnlineSearch}
              onCancel={() => setKnowledgeMiss(null)}
            />
          )}
          {knowledgeActionError && (
            <div className="assistant-error-bar" role="alert">{knowledgeActionError}</div>
          )}
          {knowledgePreview && (
            <div className="assistant-knowledge-preview">
              <div className="assistant-knowledge-review-header">
                <div>
                  <strong>{knowledgePreview.researchType === 'deep-dive' ? 'Deep research review' : 'Online research review'}</strong>
                  <span>{knowledgePreview.query}</span>
                </div>
                <span>{knowledgePreview.sourcePolicy?.accepted || knowledgePreview.sources?.length || 0} sources</span>
              </div>
              {knowledgePreview.researchType === 'deep-dive' && (
                <div className="assistant-knowledge-review-meta">
                  <span>Primary: {knowledgePreview.primaryCategory || knowledgePreview.domain}</span>
                  <span>Related: {(knowledgePreview.relatedCategories || []).join(', ') || 'none'}</span>
                </div>
              )}
              <h4>Synthesis</h4>
              <pre>{knowledgePreview.synthesis || knowledgePreview.answerPreview}</pre>
              {knowledgePreview.crossReferences?.length > 0 && (
                <div className="assistant-knowledge-crossrefs">
                  <h4>Cross-category searches</h4>
                  <ul>
                    {knowledgePreview.crossReferences.map((reference: { category: string; reason: string; query: string }) => (
                      <li key={reference.category}>{reference.category}: {reference.query}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="assistant-knowledge-sources">
                <h4>Sources</h4>
                {knowledgePreview.sources?.map((source: { url: string; title: string; snippet: string; category?: string; fetchStatus?: string }) => (
                  <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                    <strong>{source.title}</strong>
                    <span>{source.category || knowledgePreview.domain} · {source.fetchStatus === 'fetched' ? 'page reviewed' : 'search snippet'}</span>
                  </a>
                ))}
              </div>
              <div className="assistant-knowledge-review-actions">
                <button type="button" onClick={discardKnowledgePreview}>Discard</button>
                <button type="button" onClick={ingestPreview}>Save to Knowledge Base</button>
              </div>
            </div>
          )}
          {taskArtifacts.length > 0 && (
            <div className="assistant-task-artifacts" role="region" aria-label="Created files">
              <div>
                <strong>Created files</strong>
                <span>Open or download the artifacts produced by this chat task.</span>
              </div>
              <div className="assistant-task-artifact-links">
                {taskArtifacts.map(artifact => (
                  <a
                    key={artifact.url}
                    href={artifact.url}
                    target={artifact.mimeType === 'text/html' || artifact.mimeType === 'image/svg+xml' ? '_blank' : undefined}
                    rel="noreferrer"
                    download={artifact.mimeType === 'text/csv' || artifact.mimeType === 'application/json' ? artifact.name : undefined}
                  >
                    {artifact.mimeType === 'text/html' ? 'Play' : artifact.mimeType === 'image/svg+xml' ? 'View' : 'Download'} {artifact.name}
                  </a>
                ))}
              </div>
            </div>
          )}
          <ThreadPrimitive.Root className="assistant-thread">
            <ThreadPrimitive.Viewport className="assistant-viewport" tabIndex={0} aria-label="Conversation messages">
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
            <StatusBar connectionState={connectionState} messageCount={completedMessageCount} />
            <LoadedFilesBar
              files={loadedFiles}
              audio={loadedAudio}
              onRemoveFile={path => setLoadedFiles(prev => prev.filter(file => file.path !== path))}
              onRemoveAudio={path => setLoadedAudio(prev => prev.filter(file => file.path !== path))}
            />
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
      </div>
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
  const message = useMessage();
  const custom = (message?.metadata?.custom as any) || {};
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const handleFeedbackSubmit = async (feedback: {
    responseId: string;
    thumbs: 'up' | 'down';
    categories?: any[];
    comment?: string;
  }) => {
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: feedback.responseId,
          reaction: feedback.thumbs === 'up' ? 'like' : 'dislike',
          categories: feedback.categories,
          comment: feedback.comment,
        }),
      });
    } catch {
      // Non-blocking UI feedback error
    }
  };

  return (
    <MessagePrimitive.Root className={`assistant-message assistant-message-${role}`}>
      <div className="assistant-message-shell">
        <MessagePrimitive.Parts components={{ Text: TextPart }} />
        {role === 'assistant' && (
          <>
            {custom.sourcesDrawerData && (
              <SourcesDrawer data={custom.sourcesDrawerData} />
            )}
            <div className="assistant-message-footer">
              <ResponseFeedbackBar
                responseId={custom.id || message.id}
                onFeedbackSubmit={handleFeedbackSubmit}
              />
              {custom.diagnostics && (
                <button
                  type="button"
                  className="assistant-why-answer-btn"
                  onClick={() => setShowDiagnostics(true)}
                  title="Why this answer?"
                >
                  🔍 Why this answer?
                </button>
              )}
            </div>
            {showDiagnostics && custom.diagnostics && (
              <WhyThisAnswerModal
                diagnostics={custom.diagnostics}
                onClose={() => setShowDiagnostics(false)}
              />
            )}
            <ActionBarPrimitive.Root className="assistant-actions">
              <ActionBarPrimitive.Copy className="assistant-action">Copy</ActionBarPrimitive.Copy>
              <ActionBarPrimitive.Reload className="assistant-action">Retry</ActionBarPrimitive.Reload>
            </ActionBarPrimitive.Root>
          </>
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
    case 'gaming':
      return 'You are a broad gaming specialist. Help with games, engines, lore, modding, speedrunning, platform questions, strategy, game analysis, and game development routing.';
    case 'math':
      return 'You are a math specialist. Show the calculation path, define assumptions, and use symbolic or numeric methods when useful.';
    case 'market':
      return 'You are a market specialist. Analyze risks, filings, macro context, valuation scenarios, and uncertainty. Do not provide personalized financial advice.';
    case 'gamedev':
      return 'You are a game development specialist. Help with mechanics, balance, engine choices, implementation plans, playtesting, and production tradeoffs.';
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
    case 'story':
      return 'You are a story specialist. Help with worldbuilding, character arcs, scenes, quests, dialogue, lore, and continuity.';
    case 'creative_writing':
      return 'You are a Creative Writing specialist. Help draft, continue, revise, outline, and export original fiction with explicit continuity, genre, rating, and copyright-safe style boundaries.';
    case 'roleplay':
      return 'You are a Roleplay specialist. Maintain session state, in-character turns, out-of-character controls, scene continuity, and explicit boundaries. Adult-fiction handling requires opt-in and release-safe limits.';
    case 'legal':
      return 'You are a legal and civic information specialist. Require jurisdiction for specific legal framing, explain risks plainly, and avoid acting as a lawyer.';
    case 'health':
      return 'You are a health information specialist. Stay within education, fitness, anatomy, and nutrition boundaries, and escalate urgent red flags.';
    case 'security':
      return 'You are a security specialist. Help with threat modeling, auth, privacy, dependency risk, secure code review, and practical mitigations.';
    case 'business':
      return 'You are a business specialist. Help with strategy, pricing, market research structure, KPIs, unit economics, and startup planning.';
    case 'philosophy':
      return 'You are a philosophy specialist. Map arguments charitably, compare frameworks, avoid dismissive fallacy labels, and provide balanced counterarguments.';
    case 'language':
      return 'You are a language specialist. Help with translation, grammar, tone, rhetoric, speeches, readability, and rewriting.';
    case 'geography':
      return 'You are a geography and culture specialist. Handle maps, countries, demographics, cultural etiquette, and contested claims carefully.';
    case 'gis':
      return 'You are a GIS mapping specialist. Help with geocoding, routing, layers, parcels, spatial analysis, coordinate privacy, provider attribution, and degraded-mode fallbacks.';
    case 'engineering':
      return 'You are an engineering specialist. Help with circuits, robotics, mechanics, BOMs, prototypes, and calculations with safety caveats.';
    case 'knowledge_os':
      return 'You are a Knowledge OS specialist. Answer using local database, graph, wiki, memory, and governance state. Prefer counts, sources, central nodes, schema, and concrete local evidence.';
    default:
      return 'You are a helpful AI assistant.';
  }
}

function buildCreativeRequest(input: string, mode: ChatMode, creativeConfig: typeof defaultCreativeComposerState) {
  if (mode !== 'creative_writing' && mode !== 'roleplay') return undefined;
  return buildCreativeRequestPayload(input, mode, creativeConfig);
}

export default AssistantChat;
