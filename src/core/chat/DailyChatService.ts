import { ChatRuntime } from './ChatRuntime';
import { ChatRuntimeCompatibilityAdapter } from './ChatRuntimeCompatibilityAdapter';
import { ChatRequestDto } from '../../types/chat';
import { ConversationManager } from '../conversation/ConversationManager';

/** Serializes complete turns, including UI history, across every HTTP entry point. */
export class DailyChatService {
  private readonly pending = new Map<string, Promise<unknown>>();

  constructor(
    private readonly runtime: ChatRuntime,
    private readonly conversations: ConversationManager,
    private readonly legacy: { processRequest: (request: ChatRequestDto) => Promise<any> },
    private readonly commandHandler?: (request: ChatRequestDto) => Promise<any | undefined>,
  ) {}

  async processRequest(request: ChatRequestDto): Promise<any> {
    const previous = this.pending.get(request.sessionId) || Promise.resolve();
    const turn = previous.catch(() => {}).then(async () => {
      await this.conversations.addMessage(request.sessionId, 'user', request.message, { userId: request.userId, mode: request.mode });
      const general = !request.mode || ['ask', 'explain'].includes(request.mode);
      const command = await this.commandHandler?.(request);
      const result = command ?? (general
        ? ChatRuntimeCompatibilityAdapter.toLegacyResponse(await this.runtime.execute(
          ChatRuntimeCompatibilityAdapter.toNormalizedRequest(request)
        ))
        : await this.legacy.processRequest(request));
      await this.conversations.addMessage(request.sessionId, 'assistant', result.response, {
        userId: request.userId, mode: request.mode, model: result.model,
        sourcesDrawerData: result.sourcesDrawerData, warnings: result.warnings,
      });
      return result;
    });
    this.pending.set(request.sessionId, turn);
    try { return await turn; }
    finally { if (this.pending.get(request.sessionId) === turn) this.pending.delete(request.sessionId); }
  }
}
