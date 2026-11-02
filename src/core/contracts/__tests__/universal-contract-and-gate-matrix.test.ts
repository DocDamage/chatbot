import {
  ContractRegistry,
  createSpec,
  BaseUniversalTool,
  UniversalComponent
} from '../UniversalContract';
import { ContractGate } from '../ContractGate';
import { SpacedRepetitionService } from '../../learning/SpacedRepetitionService';
import { ContentModerator } from '../../moderation/ContentModerator';
import { ScienceIntentClassifier } from '../../agents/science/ScienceIntentClassifier';
import { SixSigmaIndustryAdvisor } from '../../agents/sixsigma/SixSigmaIndustryAdvisor';
import { SixSigmaComplianceAdvisor } from '../../agents/sixsigma/SixSigmaComplianceAdvisor';
import { ControlChartBuilderTool } from '../../tools/sixsigma/ControlChartBuilderTool';
import { PolicyOptimizer } from '../../rl/PolicyOptimizer';
import { AIContract, Capability, CanonWritePolicy, FallbackStrategy, ContentPersistence } from '../../../types/contract';

class SampleTool extends BaseUniversalTool {
  spec = {
    id: 'tool_1',
    name: 'Sample Tool',
    version: '1.0.0',
    type: 'tool' as const,
    description: 'A sample tool',
    inputs: [{ name: 'paramA', type: 'string' as const, description: 'Parameter A', required: true }],
    outputs: [{ name: 'result', type: 'string' as const, description: 'Result', required: true }]
  };
  category = 'utilities';

  async execute(params: Record<string, any>): Promise<any> {
    return `Executed: ${params.paramA}`;
  }
}

describe('B75-08: Universal Contract, Policy Gate, and Core Intelligence Matrix', () => {
  describe('UniversalContract & ContractRegistry', () => {
    it('registers, looks up, lists, unregisters, and clears components', async () => {
      const registry = new ContractRegistry();
      const tool = new SampleTool();

      registry.register(tool);
      expect(registry.get('tool_1')).toBe(tool);
      expect(registry.getSpec('tool_1')?.name).toBe('Sample Tool');
      expect(registry.list('tool').length).toBe(1);
      expect(registry.list('model').length).toBe(0);

      // Execute tool
      const res = await tool.process({ action: 'run', parameters: { paramA: 'test' } });
      expect(res.success).toBe(true);
      expect(res.result).toBe('Executed: test');

      // Validation failure
      const badRes = await tool.process({ action: 'run', parameters: {} });
      expect(badRes.success).toBe(false);

      // Config
      tool.setConfig({ timeout: 5000 });
      expect(tool.getConfig().timeout).toBe(5000);

      // Spec creator
      const spec = createSpec({
        name: 'Model Spec',
        type: 'model',
        description: 'LLM Model'
      });
      expect(spec.id).toBeDefined();
      expect(spec.version).toBe('1.0.0');

      // Unregister and clear
      expect(registry.unregister('tool_1')).toBe(true);
      expect(registry.unregister('nonexistent')).toBe(false);
      registry.clear();
      expect(registry.list().length).toBe(0);
    });
  });

  describe('ContractGate', () => {
    const gate = new ContractGate();
    const contract: AIContract = {
      contract_id: 'contract_1',
      version: '1.0.0',
      allowed_capabilities: ['GENERAL_QUERY', 'DIALOGUE_GENERATE'],
      allowed_tools: ['search', 'calculate'],
      canon_write_policy: CanonWritePolicy.DIRECT,
      required_validators: [],
      max_cost_per_request: 10.0,
      max_latency_ms: 5000,
      fallback_strategy: FallbackStrategy.TEMPLATE,
      content_persistence: ContentPersistence.CANON_ALLOWED
    };

    it('validates capabilities, tools, canon write policies, and cost limits', () => {
      // Capability check
      expect(gate.validateCapability(contract, 'GENERAL_QUERY')).toBe(true);
      expect(gate.validateCapability(contract, 'EXPORT_CONTENT')).toBe(false);

      // Tool check
      expect(gate.validateTool(contract, 'search')).toBe(true);
      expect(gate.validateTool(contract, 'dangerous_shell')).toBe(false);

      // Canon write check
      expect(gate.validateCanonWrite(contract, CanonWritePolicy.DIRECT)).toBe(true);
      const noneContract = { ...contract, canon_write_policy: CanonWritePolicy.NONE };
      expect(gate.validateCanonWrite(noneContract, CanonWritePolicy.DIRECT)).toBe(false);
      const suggestContract = { ...contract, canon_write_policy: CanonWritePolicy.SUGGEST_ONLY };
      expect(gate.validateCanonWrite(suggestContract, CanonWritePolicy.SUGGEST_ONLY)).toBe(true);
      expect(gate.validateCanonWrite(suggestContract, CanonWritePolicy.DIRECT)).toBe(false);

      // Cost check
      expect(gate.validateCost(contract, 5.0)).toBe(true);
      expect(gate.validateCost(contract, 15.0)).toBe(false);

      // Full request validation
      expect(gate.validateRequest(contract, 'GENERAL_QUERY', 'search', 5.0).allowed).toBe(true);
      expect(gate.validateRequest(contract, 'EXPORT_CONTENT').allowed).toBe(false);
      expect(gate.validateRequest(contract, 'GENERAL_QUERY', 'bad_tool').allowed).toBe(false);
      expect(gate.validateRequest(contract, 'GENERAL_QUERY', 'search', 20.0).allowed).toBe(false);
    });
  });

  describe('SpacedRepetitionService', () => {
    it('computes SuperMemo SM-2 intervals and ease factors across quality scores', () => {
      const srs = new SpacedRepetitionService();
      const initial = { easeFactor: 2.5, repetitions: 0, intervalDays: 0 };

      // High quality review (5)
      const review1 = srs.review(initial, 5);
      expect(review1.repetitions).toBe(1);
      expect(review1.intervalDays).toBe(1);

      // Second high quality review (5)
      const review2 = srs.review(review1, 5);
      expect(review2.repetitions).toBe(2);
      expect(review2.intervalDays).toBe(6);

      // Third high quality review (4)
      const review3 = srs.review(review2, 4);
      expect(review3.repetitions).toBe(3);
      expect(review3.intervalDays).toBeGreaterThan(6);

      // Failed review (2) resets repetitions
      const failed = srs.review(review3, 2);
      expect(failed.repetitions).toBe(0);
      expect(failed.intervalDays).toBe(1);
    });
  });

  describe('ContentModerator', () => {
    it('applies default rules and allows custom rule creation and removal', () => {
      const moderator = new ContentModerator();

      // Clean text
      const cleanRes = moderator.moderate('Hello world, this is a friendly message.');
      expect(cleanRes.allowed).toBe(true);
      expect(cleanRes.warnings.length).toBe(0);

      // Profanity detection
      const profanityRes = moderator.moderate('What the hell is this shit?');
      expect(profanityRes.warnings.length).toBeGreaterThan(0);

      // Spam repeated characters
      const spamRes = moderator.moderate('aaaaaaaaaaaaaaa');
      expect(spamRes.flags.length).toBeGreaterThan(0);

      // URL detection
      const urlRes = moderator.moderate('Visit https://example.com today!');
      expect(urlRes.flags.length).toBeGreaterThan(0);

      // Custom rule addition and removal
      const customId = moderator.addRule({
        name: 'Block Secret Keyword',
        pattern: /confidential_internal/i,
        action: 'block',
        severity: 'critical',
        enabled: true
      });

      const blockedRes = moderator.moderate('This is confidential_internal info.');
      expect(blockedRes.blocked).toBe(true);
      expect(blockedRes.allowed).toBe(false);

      expect(moderator.removeRule(customId)).toBe(true);
      expect(moderator.removeRule('nonexistent')).toBe(false);
    });
  });

  describe('ScienceIntentClassifier', () => {
    it('classifies scientific intents across all supported categories', () => {
      const classifier = new ScienceIntentClassifier();
      expect(classifier.classify('Search patent US123456').kind).toBe('patent_lookup');
      expect(classifier.classify('Summarize paper on quantum computing').kind).toBe('paper_summary');
      expect(classifier.classify('Show me the timeline of genetics').kind).toBe('scientific_timeline');
      expect(classifier.classify('Explain the invention of the wheel').kind).toBe('explain_invention');
      expect(classifier.classify('How did theory of relativity evolve?').kind).toBe('theory_evolution');
      expect(classifier.classify('General science questions').kind).toBe('science_context');
    });
  });

  describe('SixSigma Advisors & Tools', () => {
    it('provides industry playbooks and compliance advisories', () => {
      const industryAdvisor = new SixSigmaIndustryAdvisor();
      const sw = industryAdvisor.advise('How to improve software engineering quality');
      expect(sw.industry).toBe('it_software');
      expect(sw.metrics).toContain('defect escape rate');

      const mfg = industryAdvisor.advise('Reduce defects in automotive factory');
      expect(mfg.industry).toBe('manufacturing');
      expect(mfg.metrics).toContain('DPMO');

      const health = industryAdvisor.advise('Healthcare clinic wait time');
      expect(health.industry).toBe('healthcare');

      const finance = industryAdvisor.advise('Finance invoice processing');
      expect(finance.industry).toBe('finance');

      const complianceAdvisor = new SixSigmaComplianceAdvisor();
      expect(complianceAdvisor.advise('Is this material RoHS compliant?').regulation).toBe('RoHS');
      expect(complianceAdvisor.advise('Check Prop 65 warning requirements').regulation).toBe('Prop 65');
      expect(complianceAdvisor.advise('Check TSCA requirements').regulation).toBe('TSCA');
      expect(complianceAdvisor.advise('Check SDS label').regulation).toBe('SDS/labeling');
      expect(complianceAdvisor.advise('General chemical regulatory check').regulation).toBe('REACH');
    });

    it('builds Individuals and Moving Range control charts', async () => {
      const tool = new ControlChartBuilderTool();
      const observations = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 100]; // 100 is way beyond 3 sigma
      const chart = tool.build(observations);

      expect(chart.centerLine).toBeGreaterThan(0);
      expect(chart.ucl).toBeGreaterThan(chart.centerLine);
      expect(chart.lcl).toBeLessThan(chart.centerLine);
      expect(chart.outOfControlPoints.length).toBeGreaterThan(0);

      const execRes = await tool.execute({ values: observations });
      expect(execRes.success).toBe(true);
    });
  });

  describe('PolicyOptimizer', () => {
    it('skips optimization on high reward and optimizes on low reward', async () => {
      const mockRewardModel: any = {
        calculateReward: jest.fn().mockReturnValue({ overall: 0.95, helpfulness: 1.0, coherence: 0.9 })
      };
      const mockLLM: any = {
        generate: jest.fn().mockResolvedValue({ content: 'Improved answer content' })
      };

      const optimizer = new PolicyOptimizer(mockRewardModel, mockLLM);

      // High reward -> skip
      const highRes = await optimizer.optimize('resp-1', 'Good response', { rating: 5 }, 'Context');
      expect(highRes.optimized).toBe(false);
      expect(highRes.reward).toBe(0.95);

      // Low reward -> optimize
      mockRewardModel.calculateReward.mockReturnValueOnce({ overall: 0.4, helpfulness: 0.3, coherence: 0.5 });
      const lowRes = await optimizer.optimize('resp-2', 'Poor response', { rating: 1 }, 'Context');
      expect(lowRes.optimized).toBe(true);
      expect(lowRes.newResponse).toBe('Improved answer content');
    });
  });
});
