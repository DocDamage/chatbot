import fs from 'fs';
import os from 'os';
import path from 'path';
import { Database } from '../database/Database';
import { ConversationManager } from '../conversation/ConversationManager';
import { ConversationStateRepository } from '../state/ConversationStateRepository';
import { ChatRuntimeFactory } from './ChatRuntimeFactory';
import { DailyChatService } from './DailyChatService';

describe('Daily chat with real persisted state', () => {
  let root: string;
  let database: Database;
  const legacy = { processRequest: jest.fn(async () => ({ response: 'Approved specialist workflow', model: 'specialist' })) };

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-chat-'));
    database = new Database({ type: 'sqlite', filePath: path.join(root, 'chat.db') });
    await database.initialize();
  });
  afterEach(async () => { await database.close(); fs.rmSync(root, { recursive: true, force: true }); });

  function service(generate: jest.Mock, ragService?: any) {
    const conversations = new ConversationManager(database);
    return new DailyChatService(ChatRuntimeFactory.create({ database, conversationManager: conversations, llmAdapter: { generate, getModelName: () => 'ollama:qwen3:8b' }, ragService }), conversations, legacy);
  }

  it('retains ordered history and extracted variables after a real database reconnect', async () => {
    const generate = jest.fn().mockResolvedValue({ content: 'I will remember that.' });
    await service(generate).processRequest({ sessionId: 'saved', userId: 'local-user', message: 'My programming language is TypeScript. My project is called Copper Finch.' });
    await database.close();
    database = new Database({ type: 'sqlite', filePath: path.join(root, 'chat.db') });
    await database.initialize();
    await service(generate).processRequest({ sessionId: 'saved', userId: 'local-user', message: 'What is my project called?' });
    const prompt = generate.mock.calls[1][0].prompt;
    expect(prompt).toContain('Copper Finch');
    expect(prompt).toContain('Assistant: I will remember that.');
    expect(prompt.match(/What is my project called\?/g)).toHaveLength(1);
    expect((await new ConversationStateRepository(database).getState('saved'))?.variables.programmingLanguage).toBeDefined();
    expect((await new ConversationManager(database).listConversations('local-user'))[0].messageCount).toBe(4);
  });

  it('serializes simultaneous turns and keeps other sessions out of the prompt', async () => {
    const generate = jest.fn().mockResolvedValue({ content: 'Acknowledged.' });
    const chat = service(generate);
    await chat.processRequest({ sessionId: 'private', message: 'Secret mango.' });
    await Promise.all([
      chat.processRequest({ sessionId: 'shared', message: 'First message.' }),
      chat.processRequest({ sessionId: 'shared', message: 'Second message.' }),
    ]);
    const lastPrompt = generate.mock.calls[2][0].prompt;
    expect(lastPrompt).toContain('First message.');
    expect(lastPrompt).not.toContain('Secret mango.');
    expect(lastPrompt.indexOf('First message.')).toBeLessThan(lastPrompt.indexOf('Second message.'));
  });

  it('reports a provider failure and permits the next turn without a fake assistant message', async () => {
    const generate = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')).mockResolvedValue({ content: 'Back online.' });
    const chat = service(generate);
    await expect(chat.processRequest({ sessionId: 'retry', message: 'Hello' })).rejects.toMatchObject({ statusCode: 503, code: 'MODEL_UNAVAILABLE' });
    const afterFailure = await new ConversationManager(database).getConversation('retry');
    expect(afterFailure?.messages).toHaveLength(1);
    await expect(chat.processRequest({ sessionId: 'retry', message: 'Try again' })).resolves.toMatchObject({ response: 'Back online.', model: 'ollama:qwen3:8b' });
  });

  it('retrieves once without generating a second answer and exposes only cited evidence', async () => {
    const rag = { retrieveContext: jest.fn().mockResolvedValue([
      { id: 'chunk-a', content: 'The maintenance window is Tuesday.', metadata: { source: 'manual.pdf', title: 'Maintenance Manual' } },
      { id: 'chunk-b', content: 'Other details.', metadata: { source: 'unused.pdf' } },
    ]) };
    const generate = jest.fn().mockResolvedValue({ content: 'The maintenance window is Tuesday [1].' });
    const result = await service(generate, rag).processRequest({ sessionId: 'docs', message: 'When is the maintenance window in my manual?' });
    expect(rag.retrieveContext).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.sources).toEqual(['manual.pdf']);
    expect(result.citations[0].chunkId).toBe('chunk-a');
    expect(generate.mock.calls[0][0].systemPrompt).toContain('[1] Maintenance Manual');
  });

  it('honors no-retrieval and carries attached file evidence into the prompt', async () => {
    const rag = { retrieveContext: jest.fn() };
    const generate = jest.fn().mockResolvedValue({ content: 'The codeword is silver [1].' });
    await service(generate, rag).processRequest({ sessionId: 'attached', message: 'What is the codeword?', useRAG: false, loadedFiles: [{ path: 'note.txt', content: 'The codeword is silver.' }] });
    expect(rag.retrieveContext).not.toHaveBeenCalled();
    expect(generate.mock.calls[0][0].systemPrompt).toContain('The codeword is silver.');
  });

  it('deletes durable canonical state with the visible conversation', async () => {
    await service(jest.fn().mockResolvedValue({ content: 'Hello.' })).processRequest({ sessionId: 'deleted', message: 'Remember this.' });
    await new ConversationManager(database).deleteConversation('deleted');
    expect(await new ConversationStateRepository(database).getState('deleted')).toBeNull();
  });

  it('preserves the existing specialist workflow instead of giving it unaudited tool authority', async () => {
    const generate = jest.fn();
    await service(generate).processRequest({ sessionId: 'special', message: 'Inspect this repository', mode: 'coding' });
    expect(legacy.processRequest).toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });
});
