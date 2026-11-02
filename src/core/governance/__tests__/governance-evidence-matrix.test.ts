import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { GovernanceEvidenceService } from '../GovernanceEvidenceService';
import { WebhookService } from '../../webhooks/WebhookService';
import { LocalKnowledgeWiki } from '../../wiki/LocalKnowledgeWiki';
import { StyleAdapter } from '../../personalization/StyleAdapter';
import { UserProfiler } from '../../personalization/UserProfiler';
import { QuickRepliesService } from '../../suggestions/QuickReplies';

describe('B75-08: Governance, Webhooks, Wiki, Style, and Quick Replies Matrix', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-matrix-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('GovernanceEvidenceService Operations', () => {
    it('creates structured evidence reports with default and custom checks', async () => {
      const service = new GovernanceEvidenceService();
      const report = await service.createReport({
        request: 'Explain CORS',
        answer: 'CORS is a security mechanism implemented by web browsers to restrict cross-origin requests.',
        sources: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS']
      });

      expect(report.id).toBeDefined();
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.checks.length).toBeGreaterThan(0);
    });

    it('persists reports and lists them using sqlite and postgresql database mocks', async () => {
      const mockSqliteDb = {
        getType: () => 'sqlite',
        query: jest.fn().mockResolvedValue({
          rows: [
            {
              id: 'rep_1',
              request: 'req',
              answer: 'ans',
              sources: '["src1"]',
              checks: '[{"name":"c1","passed":true,"detail":"d1"}]',
              score: 1,
              created_at: '2026-08-26T00:00:00.000Z'
            }
          ]
        })
      };

      const sqliteService = new GovernanceEvidenceService(mockSqliteDb as any);
      await sqliteService.createReport({ request: 'req', answer: 'ans' });
      expect(mockSqliteDb.query).toHaveBeenCalled();

      const sqliteReports = await sqliteService.listReports(10);
      expect(sqliteReports.length).toBe(1);
      expect(sqliteReports[0].score).toBe(1);

      const mockPgDb = {
        getType: () => 'postgresql',
        query: jest.fn().mockResolvedValue({
          rows: [
            {
              id: 'rep_pg_1',
              request: 'req_pg',
              answer: 'ans_pg',
              sources: ['src_arr'],
              checks: [{ name: 'c_obj', passed: true, detail: 'd_obj' }],
              score: '0.9',
              created_at: '2026-08-26T00:00:00.000Z'
            }
          ]
        })
      };

      const pgService = new GovernanceEvidenceService(mockPgDb as any);
      await pgService.createReport({ request: 'req_pg', answer: 'ans_pg', checks: [] });
      expect(mockPgDb.query).toHaveBeenCalled();
      const pgReports = await pgService.listReports(5);
      expect(pgReports.length).toBe(1);
      expect(pgReports[0].score).toBe(0.9);

      // runGoldenTasks with database
      await pgService.runGoldenTasks(
        [{ id: 'g1', query: 'q', mustContain: ['a'] }],
        { g1: 'a answer' }
      );
    });

    it('evaluates golden tasks with mustContain and mustNotContain checks', async () => {
      const service = new GovernanceEvidenceService();

      const goldenTask = {
        id: 'gold_1',
        query: 'What is the speed of light in vacuum?',
        mustContain: ['299,792,458', 'm/s'],
        mustNotContain: ['miles per hour']
      };

      const passingReport = service.runGoldenTask(goldenTask, 'The speed of light is exactly 299,792,458 m/s in vacuum.');
      expect(passingReport.score).toBe(1);

      const failingReport = service.runGoldenTask(goldenTask, 'It is about 186,000 miles per hour.');
      expect(failingReport.score).toBeLessThan(1);

      const batchResult = await service.runGoldenTasks([goldenTask], {
        gold_1: '299,792,458 m/s exactly'
      });
      expect(batchResult.total).toBe(1);
      expect(batchResult.passed).toBe(1);
    });
  });

  describe('WebhookService Operations', () => {
    it('registers, lists, and unregisters webhooks', () => {
      const service = new WebhookService();

      const wh = service.register({
        url: 'https://example.com/webhook',
        events: ['chat.message', 'rag.ingest'],
        active: true
      });

      expect(wh.id).toBeDefined();
      expect(wh.failureCount).toBe(0);

      const unregistered = service.unregister(wh.id);
      expect(unregistered).toBe(true);
      expect(service.unregister(wh.id)).toBe(false);
    });
  });

  describe('LocalKnowledgeWiki Operations', () => {
    it('writes, searches, and reads markdown wiki pages', () => {
      const wikiDir = path.join(tempDir, 'wiki');
      const wiki = new LocalKnowledgeWiki(wikiDir);

      wiki.write({
        slug: 'architecture/rag-system',
        title: 'RAG Architecture Overview',
        content: 'This document explains the RAG ingestion and retrieval architecture in detail.'
      });

      const pages = wiki.list();
      expect(pages.length).toBe(1);
      expect(pages[0].slug).toBe('architecture/rag-system');

      const searchRes = wiki.search('retrieval');
      expect(searchRes.length).toBe(1);

      const readPage = wiki.read('architecture/rag-system');
      expect(readPage.title).toBe('RAG Architecture Overview');

      expect(() => wiki.read('nonexistent-page')).toThrow('Wiki page not found');
    });
  });

  describe('StyleAdapter and QuickReplies Operations', () => {
    it('adapts system prompts to user profile communication styles', () => {
      const profiler = new UserProfiler();
      const mockLLM = { generate: jest.fn() };
      const adapter = new StyleAdapter(profiler, mockLLM as any);

      profiler.getProfile('user_formal').preferences.communicationStyle = 'formal';
      const promptFormal = adapter.adaptSystemPrompt('user_formal', 'Base prompt');
      expect(promptFormal).toContain('formal language');

      profiler.getProfile('user_casual').preferences.communicationStyle = 'casual';
      const promptCasual = adapter.adaptSystemPrompt('user_casual', 'Base prompt');
      expect(promptCasual).toContain('casual');

      profiler.getProfile('user_tech').preferences.communicationStyle = 'technical';
      const promptTech = adapter.adaptSystemPrompt('user_tech', 'Base prompt');
      expect(promptTech).toContain('technical terminology');

      profiler.getProfile('user_friendly').preferences.communicationStyle = 'friendly';
      const promptFriendly = adapter.adaptSystemPrompt('user_friendly', 'Base prompt');
      expect(promptFriendly).toContain('warm and approachable');
    });

    it('generates quick replies and provides fallback default replies on failure', async () => {
      const mockLLM = {
        generate: jest.fn().mockResolvedValue({
          content: '- What are the prerequisites?\n- Can you show an example?\n- How do I deploy this?'
        })
      };

      const repliesService = new QuickRepliesService(mockLLM as any);
      const replies = await repliesService.generateQuickReplies('How to use Docker?', 'Here is an intro to Docker.');
      expect(replies.length).toBeGreaterThan(0);

      // Error path: LLM throws
      mockLLM.generate.mockRejectedValueOnce(new Error('LLM rate limit'));
      const fallbackReplies = await repliesService.generateQuickReplies('New query', 'New response');
      expect(fallbackReplies.length).toBeGreaterThan(0);
    });
  });
});
