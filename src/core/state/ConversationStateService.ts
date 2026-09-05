/**
 * Canonical Conversation State Service (CRK-P03-T05)
 *
 * Implements IChatStateService for ChatRuntime:
 * - Loads conversation state and merges new variables via Extractor + Reducer.
 * - Commits assistant replies, message history, and variable updates.
 * - Enforces session isolation (§1064, §1095).
 */

import {
  IChatStateService,
  ChatConversationState,
} from '../chat/ChatRuntime';
import {
  NormalizedChatRequest,
  ChatRuntimeResult,
  ChatTraceContext,
} from '../../types/chat-runtime';
import { ConversationStateRepository } from './ConversationStateRepository';
import { ConversationVariableExtractor } from './ConversationVariableExtractor';
import { ConversationStateReducer } from './ConversationStateReducer';
import { ConversationState, ConversationVariable } from '../../types/conversation-state';

export interface ConversationStateServiceConfig {
  repository?: ConversationStateRepository;
  extractor?: ConversationVariableExtractor;
  reducer?: ConversationStateReducer;
  maxHistoryTurns?: number;
}

export class ConversationStateService implements IChatStateService {
  private readonly repository: ConversationStateRepository;
  private readonly extractor: ConversationVariableExtractor;
  private readonly reducer: ConversationStateReducer;
  private readonly maxHistoryTurns: number;

  constructor(config: ConversationStateServiceConfig = {}) {
    this.repository = config.repository || new ConversationStateRepository();
    this.extractor = config.extractor || new ConversationVariableExtractor();
    this.reducer = config.reducer || new ConversationStateReducer();
    this.maxHistoryTurns = config.maxHistoryTurns || 50;
  }

  public async load(request: NormalizedChatRequest): Promise<ChatConversationState> {
    const now = new Date().toISOString();
    let persisted = await this.repository.getState(request.sessionId);

    if (!persisted) {
      persisted = {
        sessionId: request.sessionId,
        variables: {},
        sessionMemory: {
          sessionId: request.sessionId,
          messages: [],
          maxHistoryTurns: this.maxHistoryTurns,
        },
        createdAt: now,
        updatedAt: now,
      };
    }

    // Extract variables from the incoming turn
    const extractedResult = this.extractor.extract(request);

    // Deterministically reduce state
    const updatedState = this.reducer.reduce(persisted, extractedResult.variables, { now });
    await this.repository.saveState(updatedState);

    // Map structured variables to simple dictionary for runtime compatibility
    const simpleVariables: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updatedState.variables)) {
      simpleVariables[k] = v.value;
    }

    // Build message history including current user turn
    const history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      ...updatedState.sessionMemory.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: request.message },
    ];

    return {
      sessionId: request.sessionId,
      messageHistory: history,
      variables: simpleVariables,
      metadata: {
        structuredVariables: updatedState.variables,
        ambiguities: extractedResult.ambiguities,
      },
    };
  }

  public async commit(params: {
    request: NormalizedChatRequest;
    state: ChatConversationState;
    result: ChatRuntimeResult;
    trace: ChatTraceContext;
  }): Promise<void> {
    const now = new Date().toISOString();
    const existing = (await this.repository.getState(params.request.sessionId)) || {
      sessionId: params.request.sessionId,
      variables: {},
      sessionMemory: {
        sessionId: params.request.sessionId,
        messages: [],
        maxHistoryTurns: this.maxHistoryTurns,
      },
      createdAt: now,
      updatedAt: now,
    };

    // Append user message and assistant response
    const messages = [...existing.sessionMemory.messages];
    messages.push({
      role: 'user',
      content: params.request.message,
      turnId: params.request.requestId,
      timestamp: now,
    });
    messages.push({
      role: 'assistant',
      content: params.result.response,
      turnId: params.trace.traceId,
      timestamp: now,
    });

    // Trim history to maxHistoryTurns
    if (messages.length > this.maxHistoryTurns * 2) {
      messages.splice(0, messages.length - this.maxHistoryTurns * 2);
    }

    // Persist structured variables from state metadata if available
    const structuredVars = (params.state.metadata?.structuredVariables as Record<string, ConversationVariable>) || {};

    const newState: ConversationState = {
      ...existing,
      variables: {
        ...existing.variables,
        ...structuredVars,
      },
      sessionMemory: {
        ...existing.sessionMemory,
        messages,
      },
      updatedAt: now,
    };

    await this.repository.saveState(newState);
  }

  public async deleteSession(sessionId: string): Promise<boolean> {
    return this.repository.deleteState(sessionId);
  }

  public getRepository(): ConversationStateRepository {
    return this.repository;
  }
}
