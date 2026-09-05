import { CodeExecutor } from '../CodeExecutor';
import { createRepoTools } from '../RepoTools';
import { ToolRegistry } from '../ToolRegistry';
import { FunctionCaller } from '../FunctionCaller';
import { ToolComposer } from '../ToolComposer';
import { PersonalKnowledgeTool } from '../PersonalKnowledgeTool';
import { KnowledgeSources } from '../../knowledge';
import { FitnessPlanTool } from '../health/FitnessPlanTool';
import { SymPyTool } from '../math/SymPyTool';
import { ValuationTool } from '../market/ValuationTool';
import { UnitEconomicsTool } from '../business/UnitEconomicsTool';
import { ContractClauseExplainerTool } from '../legal/ContractClauseExplainerTool';
import { ToolCategory, Tool } from '../../../types/tools';

describe('B75-05: Tools Execution, Registry, and Composition Matrix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('CodeExecutor', () => {
    it('enforces allowed languages and rejects disallowed languages', async () => {
      const executor = new CodeExecutor(5000, ['python', 'javascript']);

      const unsuppRes = await executor.execute('puts "hello"', 'ruby');
      expect(unsuppRes.success).toBe(false);
      expect(unsuppRes.error).toContain('Language ruby not allowed');

      const bashRes = await executor.execute('echo hi', 'bash');
      expect(bashRes.success).toBe(false);
    });

    it('blocks dangerous code patterns and file system operations', async () => {
      const executor = new CodeExecutor(5000, ['python', 'javascript']);

      const dangerousSnippets = [
        { code: 'import os\nos.system("rm -rf /")', lang: 'python' },
        { code: 'import subprocess', lang: 'python' },
        { code: 'eval("2+2")', lang: 'javascript' },
        { code: 'exec("print(1)")', lang: 'python' },
        { code: 'DROP TABLE users;', lang: 'javascript' },
        { code: 'TRUNCATE table;', lang: 'javascript' },
        { code: 'require("child_process")', lang: 'javascript' },
        { code: 'process.exit(1)', lang: 'javascript' },
        { code: 'const fs = require("fs"); fs.readFile("a")', lang: 'javascript' },
        { code: 'data.writeFile("b", "c")', lang: 'javascript' },
      ];

      for (const { code, lang } of dangerousSnippets) {
        const res = await executor.execute(code, lang);
        expect(res.success).toBe(false);
        expect(res.error).toContain('Security check failed');
      }
    });

    it('creates tool definition that delegates to execute', async () => {
      const executor = new CodeExecutor();
      const tool = executor.createTool();

      expect(tool.id).toBe('code_executor');
      expect(tool.category).toBe(ToolCategory.CODE_EXECUTION);

      const result = await tool.execute({ code: 'import os', language: 'python' });
      expect(result.success).toBe(false);
    });
  });

  describe('ToolRegistry and FunctionCaller', () => {
    it('manages tool registration, duplicate prevention, category filtering, search, and unregistration', () => {
      const registry = new ToolRegistry();
      const sampleTool: Tool = {
        id: 'calc_tool',
        name: 'calculate',
        description: 'Performs arithmetic calculation',
        category: ToolCategory.CALCULATION,
        parameters: [{ name: 'expr', type: 'string', description: 'Expression', required: true }],
        execute: async (params) => ({ success: true, data: params.expr }),
      };

      registry.register(sampleTool);
      expect(registry.get('calc_tool')).toBe(sampleTool);
      expect(registry.getAll()).toContain(sampleTool);
      expect(registry.getByCategory(ToolCategory.CALCULATION)).toContain(sampleTool);

      // Duplicate registration ignored
      registry.register(sampleTool);
      expect(registry.getAll().length).toBe(1);

      // Search
      expect(registry.search('arithmetic')).toContain(sampleTool);
      expect(registry.search('nonexistent').length).toBe(0);

      // Function definitions for LLMs
      const funcDefs = registry.getFunctionDefinitions();
      expect(funcDefs[0].name).toBe('calculate');
      expect(funcDefs[0].parameters.properties.expr).toBeDefined();

      // Stats
      const stats = registry.getStats();
      expect(stats.totalTools).toBe(1);

      // Unregister
      expect(registry.unregister('calc_tool')).toBe(true);
      expect(registry.unregister('calc_tool')).toBe(false);
      expect(registry.get('calc_tool')).toBeUndefined();
    });

    it('validates parameters and executes tools through FunctionCaller', async () => {
      const registry = new ToolRegistry();
      const mathTool: Tool = {
        id: 'add_nums',
        name: 'addNumbers',
        description: 'Add two numbers',
        category: ToolCategory.CALCULATION,
        parameters: [
          { name: 'a', type: 'number', description: 'first', required: true },
          { name: 'b', type: 'number', description: 'second', required: true },
        ],
        execute: async (params) => ({ success: true, data: params.a + params.b }),
      };
      registry.register(mathTool);

      const caller = new FunctionCaller(registry);

      // Missing parameter
      const missingParamRes = await caller.execute({
        toolId: 'add_nums',
        parameters: { a: 10 },
      });
      expect(missingParamRes.success).toBe(false);
      expect(missingParamRes.error).toContain('Missing required parameter');

      // Invalid parameter type
      const wrongTypeRes = await caller.execute({
        toolId: 'add_nums',
        parameters: { a: 10, b: 'invalid_string' },
      });
      expect(wrongTypeRes.success).toBe(false);
      expect(wrongTypeRes.error).toContain('Invalid type');

      // Non-existent tool
      const missingToolRes = await caller.execute({
        toolId: 'not_found',
        parameters: {},
      });
      expect(missingToolRes.success).toBe(false);
      expect(missingToolRes.error).toContain('Tool not found');

      // Successful execution
      const successRes = await caller.execute({
        toolId: 'add_nums',
        parameters: { a: 15, b: 25 },
      });
      expect(successRes.success).toBe(true);
      expect(successRes.data).toBe(40);
      expect(successRes.metadata?.executionTime).toBeDefined();

      // Parallel execution
      const parallelResults = await caller.executeParallel([
        { toolId: 'add_nums', parameters: { a: 1, b: 2 } },
        { toolId: 'add_nums', parameters: { a: 10, b: 20 } },
      ]);
      expect(parallelResults.length).toBe(2);
      expect(parallelResults[0].data).toBe(3);
      expect(parallelResults[1].data).toBe(30);
    });
  });

  describe('ToolComposer', () => {
    it('composes and executes dependent tool chains with parameter injection', async () => {
      const registry = new ToolRegistry();
      registry.register({
        id: 'fetch_data',
        name: 'fetchData',
        description: 'Fetch initial data',
        category: ToolCategory.UTILITY,
        execute: async () => ({ success: true, data: { userId: 'usr_100', score: 95 } }),
      });
      registry.register({
        id: 'format_report',
        name: 'formatReport',
        description: 'Format report with data',
        category: ToolCategory.UTILITY,
        parameters: [{ name: 'input', type: 'string', description: 'input text', required: true }],
        execute: async (p) => ({ success: true, data: `Report generated: ${p.input}` }),
      });

      const caller = new FunctionCaller(registry);
      const composer = new ToolComposer(caller);

      const chain = {
        calls: [
          { toolId: 'fetch_data', parameters: {} },
          { toolId: 'format_report', parameters: { input: '${0}' } },
        ],
        dependencies: new Map([[1, [0]]]),
      };

      const results = await composer.executeChain(chain);
      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[1].data).toContain('usr_100');
    });
  });

  describe('PersonalKnowledgeTool', () => {
    it('manages actions: add_song, add_research, add_snippet, and unknown', async () => {
      const addSong = jest.fn().mockResolvedValue(undefined);
      const addResearchTopic = jest.fn().mockResolvedValue(undefined);
      const addCodeSnippet = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(KnowledgeSources, 'songwriting_style').mockReturnValue({ addSong } as any);
      jest.spyOn(KnowledgeSources, 'personal_research').mockReturnValue({
        addResearchTopic,
        addCodeSnippet,
      } as any);
      const tool = new PersonalKnowledgeTool();

      const songRes = await tool.execute({
        action: 'add_song',
        title: 'Midnight Echoes',
        content: 'Lyrics about starlight',
        metadata: { genre: 'Indie', mood: 'Melancholic' },
      });
      expect(songRes.success).toBe(true);
      expect(addSong).toHaveBeenCalledWith('Midnight Echoes', 'Lyrics about starlight', {
        genre: 'Indie',
        mood: 'Melancholic',
      });

      const researchRes = await tool.execute({
        action: 'add_research',
        title: 'Quantum Computing',
        content: 'Qubits and entanglement',
        metadata: { category: 'Physics' },
      });
      expect(researchRes.success).toBe(true);
      expect(addResearchTopic).toHaveBeenCalledWith(
        'Quantum Computing',
        'Qubits and entanglement',
        'Physics'
      );

      const snippetRes = await tool.execute({
        action: 'add_snippet',
        title: 'Quicksort',
        content: 'Sorting algorithm implementation',
        metadata: { code: 'def quicksort(arr): return arr', language: 'python' },
      });
      expect(snippetRes.success).toBe(true);
      expect(addCodeSnippet).toHaveBeenCalledWith(
        'Quicksort',
        'def quicksort(arr): return arr',
        'python',
        'Sorting algorithm implementation',
        []
      );

      const snippetMissingCode = await tool.execute({
        action: 'add_snippet',
        title: 'No Code',
        content: 'Missing code',
      });
      expect(snippetMissingCode.success).toBe(false);

      const unknownRes = await tool.execute({
        action: 'invalid_action',
        title: 'Test',
        content: 'Test',
      });
      expect(unknownRes.success).toBe(false);
    });
  });

  describe('Specialist Tools Decision Matrices', () => {
    it('FitnessPlanTool covers goals, experience levels, and day counts', () => {
      const tool = new FitnessPlanTool();

      const strengthBeginner = tool.run({ query: 'beginner strength training 3 days a week' });
      expect(strengthBeginner.goal).toBe('strength_and_muscle');
      expect(strengthBeginner.experience).toBe('beginner');
      expect(strengthBeginner.daysPerWeek).toBe(3);
      expect(strengthBeginner.weeklyStructure.length).toBeGreaterThan(0);

      const cardioAdv = tool.run({ query: 'marathon cardio running conditioning 5x per week' });
      expect(cardioAdv.goal).toBe('cardio_endurance');
      expect(cardioAdv.daysPerWeek).toBe(5);

      const mobilityPlan = tool.run({ query: 'lower back pain mobility flexibility 4 days' });
      expect(mobilityPlan.goal).toBe('mobility_and_resilience');

      const defaultPlan = tool.run({});
      expect(defaultPlan.goal).toBe('general_fitness');
    });

    it('SymPyTool handles symbolic fallbacks for differentiation, simplification, and solving', async () => {
      const tool = new SymPyTool({ preferPython: false });

      const diffProd = await tool.differentiate('x^2 * sin(x)', 'x');
      expect(diffProd.success).toBe(true);
      expect(diffProd.result).toContain('2*x*sin(x)');

      const diffPower = await tool.differentiate('x^2', 'x');
      expect(diffPower.success).toBe(true);
      expect(diffPower.result).toBe('2*x');

      const diffUnknown = await tool.differentiate('tan(x)^3', 'x');
      expect(diffUnknown.success).toBe(false);

      const simp = await tool.simplify('2*x + 3*x');
      expect(['5*x', '2*x + 3*x']).toContain(simp.result);

      const solve = await tool.solveEquation('x^2 - 4 = 0');
      expect(solve.success).toBe(false);
    });

    it('ValuationTool computes financial ratios with valid inputs and boundary protection', () => {
      const val = new ValuationTool();

      expect(val.peRatio(100, 5)).toBe(20);
      expect(val.peRatio(100, 0)).toBeNull();
      expect(val.peRatio(100, -2)).toBeNull();

      expect(val.psRatio(1000, 200)).toBe(5);
      expect(val.psRatio(1000, 0)).toBeNull();

      expect(val.evEbitda(500, 50)).toBe(10);
      expect(val.evEbitda(500, 0)).toBeNull();

      expect(val.grossMargin(80, 100)).toBe(0.8);
      expect(val.grossMargin(80, 0)).toBeNull();

      expect(val.freeCashFlowYield(50, 1000)).toBe(0.05);
      expect(val.freeCashFlowYield(50, 0)).toBeNull();

      expect(val.growth(120, 100)).toBe(0.2);
      expect(val.growth(100, 0)).toBeNull();

      expect(val.debtToEquity(300, 600)).toBe(0.5);
      expect(val.debtToEquity(300, 0)).toBeNull();
    });

    it('UnitEconomicsTool computes contribution margin, LTV, payback, and missing fields', () => {
      const unit = new UnitEconomicsTool();

      const full = unit.run({ arpu: 100, grossMargin: 0.8, monthlyChurn: 0.05, cac: 400 });
      expect(full.metrics.contributionMargin).toBe(80);
      expect(full.metrics.ltv).toBe(1600);
      expect(full.metrics.paybackMonths).toBe(5);
      expect(full.metrics.ltvToCac).toBe(4);
      expect(full.missingData.length).toBe(0);

      const partial = unit.run({ arpu: 50 });
      expect(partial.missingData).toContain('monthly churn');
      expect(partial.missingData).toContain('CAC');
    });

    it('ContractClauseExplainerTool classifies legal clauses and generates explanations', () => {
      const explainer = new ContractClauseExplainerTool();

      const indemn = explainer.run({ text: 'Party A shall indemnify and hold harmless Party B' });
      expect(indemn.clauseType).toBe('indemnification');
      expect(indemn.plainEnglish).toContain('cover losses');

      const liab = explainer.run({
        text: 'In no event shall aggregate liability exceed fees paid',
      });
      expect(liab.clauseType).toBe('limitation of liability');

      const nonCompete = explainer.run({ text: 'Employee agrees to non-compete for 12 months' });
      expect(nonCompete.clauseType).toBe('non-compete');

      const conf = explainer.run({
        text: 'Recipient shall keep confidential all proprietary data',
      });
      expect(conf.clauseType).toBe('confidentiality');

      const term = explainer.run({
        text: 'Either party may terminate this agreement on 30 days notice',
      });
      expect(term.clauseType).toBe('termination');

      const gov = explainer.run({
        text: 'This contract is subject to governing law and jurisdiction of Delaware',
      });
      expect(gov.clauseType).toBe('governing law / venue');

      const generic = explainer.run({ text: 'Miscellaneous standard provisions' });
      expect(generic.clauseType).toBe('general contract clause');
    });
  });
});
