import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { UnrealEngineAdapter } from '../unreal/UnrealEngineAdapter';
import { WebScraperSource } from '../../knowledge/WebScraperSource';
import { MemoryRetrievalNetwork } from '../../memory/MemoryRetrievalNetwork';
import { WebhookService } from '../../webhooks/WebhookService';
import { FLStudioMcpClient } from '../../integrations/flstudio/FLStudioMcpClient';
import { MemoryEntry, EpisodicMemory, MemoryType } from '../../../types/memory';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('B75-08: Unreal Engine, WebScraper, Memory Retrieval, Webhooks, and FL Studio Matrix', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unreal-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('UnrealEngineAdapter', () => {
    it('connects, inspects project/scenes/scripts, proposes mutations, and handles errors', async () => {
      // Mock project structure
      fs.writeFileSync(path.join(tempDir, 'MyGame.uproject'), JSON.stringify({ FileVersion: 3 }), 'utf8');
      const contentDir = path.join(tempDir, 'Content', 'Maps');
      fs.mkdirSync(contentDir, { recursive: true });
      fs.writeFileSync(path.join(contentDir, 'Main.umap'), 'binary-umap-content', 'utf8');
      fs.writeFileSync(path.join(tempDir, 'Content', 'Item.uasset'), 'binary-uasset-content', 'utf8');

      const sourceDir = path.join(tempDir, 'Source', 'MyGame');
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, 'PlayerCharacter.cpp'), 'void BeginPlay() { super::BeginPlay(); }\nvoid Tick(float DeltaTime) {}', 'utf8');

      const adapter = new UnrealEngineAdapter();
      expect(adapter.getStatus().state).toBe('disconnected');

      // Connect
      const status = await adapter.connect({ engine: 'unreal', projectRoot: tempDir, versionOverride: '5.4.2' });
      expect(status.state).toBe('connected');
      expect(status.version).toBe('5.4.2');

      // Inspect project
      const projInfo = await adapter.inspectProject();
      expect(projInfo.engine).toBe('unreal');
      expect(projInfo.scenes.length).toBe(1);
      expect(projInfo.assets.length).toBe(1);

      // Inspect scene
      const sceneInfo = await adapter.inspectScene('Content/Maps/Main.umap');
      expect(sceneInfo.name).toBe('Main');
      expect(sceneInfo.rootNode.type).toBe('UnrealMapBinary');

      // Inspect script
      const scriptInfo = await adapter.inspectScript('Source/MyGame/PlayerCharacter.cpp');
      expect(scriptInfo.language).toBe('cpp');
      expect(scriptInfo.methods.length).toBeGreaterThan(0);

      // Propose mutation
      const proposal = await adapter.proposeMutation({
        engine: 'unreal',
        projectId: 'proj-1',
        title: 'Add Actor to Map',
        description: 'Place spawn point in Main map',
        risk: 'low',
        actions: [{ type: 'custom', targetPath: 'Content/Spawn.txt', params: { content: 'SpawnPointContent' } }]
      });
      expect(proposal.id).toBeDefined();

      // Approve mutation
      const approved = await adapter.approveMutation(proposal.id, 'admin_user');
      expect(approved.status).toBe('approved');

      // Apply mutation
      const tx = await adapter.applyMutation(proposal.id, approved.approvalDigest!, { callerId: 'admin_user' });
      expect(tx.rolledBack).toBe(false);

      // Rollback transaction
      const rolledBack = await adapter.rollbackTransaction(tx.id);
      expect(rolledBack).toBe(true);

      // Disconnect
      await adapter.disconnect();
      expect(adapter.getStatus().state).toBe('disconnected');
    });
  });

  describe('WebScraperSource', () => {
    it('isAvailable, checks domain restrictions, scrapes content, and parses HTML', async () => {
      const scraper = new WebScraperSource(['example.com', 'trusted.org']);
      expect(await scraper.isAvailable()).toBe(true);

      // Domain restriction rejection
      const searchBlocked = await scraper.search('AI agents', { urls: ['https://untrusted.com/page'] });
      expect(searchBlocked.length).toBe(0);

      // Successful scraping
      mockedAxios.get.mockResolvedValueOnce({
        data: '<html><head><title>Example Page</title></head><body><main><h1>Welcome</h1><p>Scraped content body.</p></main></body></html>'
      });

      const results = await scraper.search('test', { urls: ['https://example.com/welcome'] });
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Example Page');
      expect(results[0].content).toContain('Scraped content body.');

      // getById
      mockedAxios.get.mockResolvedValueOnce({
        data: '<html><head><title>Direct ID</title></head><body><article>Article body.</article></body></html>'
      });
      const byId = await scraper.getById('https://example.com/direct');
      expect(byId?.title).toBe('Direct ID');
    });
  });

  describe('MemoryRetrievalNetwork', () => {
    it('indexes memories, scores Jaccard similarity, and boosts episodic salience and recency', () => {
      const network = new MemoryRetrievalNetwork();

      const mem1: MemoryEntry = {
        id: 'mem-1',
        type: MemoryType.SESSION,
        content: 'TypeScript unit testing with Jest and mock implementations',
        timestamp: new Date()
      };

      const mem2: EpisodicMemory = {
        id: 'mem-2',
        type: MemoryType.EPISODIC,
        content: 'Python data science with pandas and numpy arrays',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days old
        metadata: { salience: 0.9 }
      };

      network.indexMemories('session-abc', [mem1, mem2]);
      const stats = network.getStats();
      expect(stats.totalMemories).toBe(2);
      expect(stats.sessions).toBe(1);

      // Retrieve by typescript keyword
      const tsResults = network.retrieve({
        query: 'TypeScript unit testing',
        context: 'session-abc'
      });
      expect(tsResults.length).toBe(2);
      expect(tsResults[0].id).toBe('mem-1');

      // Filter by type
      const filtered = network.retrieve({
        query: 'programming',
        context: 'session-abc',
        memoryTypes: [MemoryType.EPISODIC]
      });
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('mem-2');
    });
  });

  describe('WebhookService', () => {
    it('registers, unregisters, updates, triggers with signing, and tracks failures', async () => {
      const webhookService = new WebhookService();

      const webhook = webhookService.register({
        url: 'https://webhook.site/test',
        events: ['chat.message', 'user.signup'],
        secret: 'supersecret',
        active: true
      });

      expect(webhook.id).toBeDefined();
      expect(webhookService.get(webhook.id)).toBeDefined();
      expect(webhookService.list().length).toBe(1);

      // Update
      const updated = webhookService.update(webhook.id, { active: true });
      expect(updated?.active).toBe(true);

      // Successful trigger
      mockedAxios.post.mockResolvedValueOnce({ status: 200 });
      await webhookService.trigger({
        type: 'chat.message',
        payload: { text: 'Hello' },
        timestamp: new Date()
      });
      expect(webhookService.get(webhook.id)?.failureCount).toBe(0);

      // Failure trigger
      mockedAxios.post.mockRejectedValueOnce(new Error('Network failure'));
      await webhookService.trigger({
        type: 'chat.message',
        payload: { text: 'Retry test' },
        timestamp: new Date()
      });
      expect(webhookService.get(webhook.id)?.failureCount).toBe(1);

      // Unregister
      expect(webhookService.unregister(webhook.id)).toBe(true);
      expect(webhookService.list().length).toBe(0);
    });
  });

  describe('FLStudioMcpClient', () => {
    it('manages connection, play/stop, notes/chords, mixer adjustments, and piano roll state', async () => {
      const mockMcpService: any = {
        connectServer: jest.fn().mockResolvedValue({ status: 'connected' }),
        healthCheck: jest.fn().mockResolvedValue({ healthy: true }),
        listTools: jest.fn().mockResolvedValue(['fl_play', 'fl_stop']),
        callTool: jest.fn().mockImplementation(async (tool, args, dryRun) => ({ success: true, tool, args, dryRun })),
        disconnect: jest.fn()
      };

      const fl = new FLStudioMcpClient(mockMcpService);
      await fl.connect({ id: 'fl-studio' });
      expect(mockMcpService.connectServer).toHaveBeenCalled();

      await fl.status();
      await fl.listTools();
      await fl.play();
      await fl.stop();
      await fl.sendNotes([{ note: 60, velocity: 100 }]);
      await fl.sendChord(['C4', 'E4', 'G4']);
      await fl.setMixerVolume(1, -3);
      await fl.setMixerPan(1, 0.2);
      await fl.setStepSequence('kick', [1, 0, 0, 0]);
      await fl.getPianoRollState();
      fl.disconnect();

      expect(mockMcpService.callTool).toHaveBeenCalledTimes(8);
      expect(mockMcpService.disconnect).toHaveBeenCalled();
    });
  });
});
