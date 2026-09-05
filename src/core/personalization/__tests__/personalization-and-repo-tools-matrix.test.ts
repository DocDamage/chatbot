import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { UserProfiler } from '../UserProfiler';
import { PreferenceLearner } from '../PreferenceLearner';
import { StyleAdapter } from '../StyleAdapter';
import { createRepoTools } from '../../tools/RepoTools';
import { CommandRunner } from '../../tools/CommandRunner';
import { ApprovedRepositoryGateway } from '../../coding/security/ApprovedRepositoryGateway';

describe('B75-08: Personalization Learning, Style Adaptation, and RepoTools Matrix', () => {
  describe('PreferenceLearner & StyleAdapter', () => {
    it('learns explicit and implicit preferences, updates profile, and adapts styles', async () => {
      const profiler = new UserProfiler();
      const learner = new PreferenceLearner(profiler);

      const userId = 'user_pref_test';

      // 1. Explicit feedback: rating and communication style
      learner.learn(userId, {
        explicit: {
          preference: 'communication_style',
          value: 'technical'
        }
      });

      const profile = profiler.getProfile(userId);
      expect(profile.preferences.communicationStyle).toBe('technical');

      // 2. Implicit feedback: skip_response -> responseLength = short
      learner.learn(userId, {
        implicit: {
          action: 'skip_response'
        }
      });
      expect(profile.preferences.responseLength).toBe('short');

      // 3. Implicit feedback: ask_follow_up -> response_detail = more_detail
      learner.learn(userId, {
        implicit: {
          action: 'ask_follow_up'
        }
      });

      // 4. Explicit feedback: responseLength = longer
      learner.learn(userId, {
        explicit: {
          preference: 'response_length',
          value: 'longer'
        }
      });
      expect(profile.preferences.responseLength).toBe('long');

      const signals = learner.getPreferences(userId);
      expect(signals.length).toBe(4);

      // 5. StyleAdapter
      const mockLLM = {
        generate: jest.fn().mockResolvedValue({
          content: 'Adapted technical text response.',
          model: 'mock-llm',
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
        }),
        estimateCost: jest.fn().mockReturnValue(0.001),
        isAvailable: jest.fn().mockResolvedValue(true)
      };

      const adapter = new StyleAdapter(profiler, mockLLM as any);
      const systemPrompt = adapter.adaptSystemPrompt(userId, 'You are a helpful assistant.');
      expect(systemPrompt).toContain('User Communication Preferences');
      expect(systemPrompt).toContain('technical');

      // Response matching
      const matchingRes = await adapter.adaptResponse(userId, 'Precise response.', 'context');
      expect(matchingRes).toBe('Precise response.');

      // Response adapting when style is formal and response has contractions
      profile.preferences.communicationStyle = 'formal';
      const formalAdapted = await adapter.adaptResponse(userId, "I'm gonna solve this now.", 'context');
      expect(formalAdapted).toBe('Adapted technical text response.');

      // Response adaptation error fallback
      mockLLM.generate.mockRejectedValueOnce(new Error('LLM error'));
      const fallbackRes = await adapter.adaptResponse(userId, "I'm gonna solve this now.", 'context');
      expect(fallbackRes).toBe("I'm gonna solve this now.");
    });
  });

  describe('RepoTools Comprehensive Suite', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repotool-test-'));
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-app',
        scripts: { test: 'jest', build: 'tsc' }
      }));
      fs.writeFileSync(path.join(tempDir, 'index.ts'), "import { helper } from './helper';\nexport function main() { helper(); }");
      fs.writeFileSync(path.join(tempDir, 'helper.ts'), 'export function helper() { return 42; }');
    });

    afterEach(() => {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('executes all repo tools safely against approved workspace', async () => {
      const runner = new CommandRunner(tempDir);
      const gateway = new ApprovedRepositoryGateway(tempDir);
      const tools = createRepoTools(tempDir, runner, gateway);

      const findTool = (id: string) => tools.find(t => t.id === id);

      // 1. list_project_files
      const listTool = findTool('list_project_files');
      const listRes = await listTool!.execute({ dir: '.', maxFiles: 10 });
      expect(listRes.success).toBe(true);
      expect(listRes.data.files).toContain('package.json');

      // 2. search_repo
      const searchTool = findTool('search_repo');
      const searchRes = await searchTool!.execute({ query: 'helper', maxResults: 5 });
      expect(searchRes.success).toBe(true);
      expect(searchRes.data.matches.length).toBeGreaterThan(0);

      // 3. read_project_file
      const readTool = findTool('read_project_file');
      const readRes = await readTool!.execute({ path: 'helper.ts' });
      expect(readRes.success).toBe(true);
      expect(readRes.data.content).toContain('export function helper');

      // 4. get_package_scripts
      const scriptsTool = findTool('get_package_scripts');
      const scriptsRes = await scriptsTool!.execute({});
      expect(scriptsRes.success).toBe(true);
      expect(scriptsRes.data.scripts.build).toBe('tsc');

      // 5. git_diff
      const diffTool = findTool('git_diff');
      const diffRes = await diffTool!.execute({});
      expect(diffRes.success).toBe(true);

      // 6. get_file_symbols
      const symbolsTool = findTool('get_file_symbols');
      const symbolsRes = await symbolsTool!.execute({ path: 'index.ts' });
      expect(symbolsRes.success).toBe(true);

      // 7. find_references
      const refsTool = findTool('find_references');
      const refsRes = await refsTool!.execute({ symbol: 'helper' });
      expect(refsRes.success).toBe(true);
      expect(refsRes.data.references.length).toBeGreaterThan(0);

      // 8. get_import_graph
      const graphTool = findTool('get_import_graph');
      const graphRes = await graphTool!.execute({ path: 'index.ts' });
      expect(graphRes.success).toBe(true);
      expect(graphRes.data.graph.length).toBe(1);

      // 9. create_patch & apply_patch
      const patchTool = findTool('create_patch');
      const patchRes = await patchTool!.execute({ diff: '+ new line' });
      expect(patchRes.success).toBe(true);

      const applyTool = findTool('apply_patch');
      const applyRes = await applyTool!.execute({ diff: '+ new line' });
      expect(applyRes.success).toBe(false);
      expect(applyRes.error).toContain('Patch application is disabled');
    });
  });
});
