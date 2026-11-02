import { describe, it, expect } from '@jest/globals';
import { TaskDefinitionOfDoneAuditor } from '../TaskDefinitionOfDoneAuditor';
import { ImplementationPromptTemplate } from '../ImplementationPromptTemplate';
import { HandoffAdditionsBuilder } from '../HandoffAdditionsBuilder';

describe('Task DoD Auditor, Prompt Template & Handoff Builder (§59, §60, §61)', () => {
  it('audits task checklist across all 4 DoD dimensions', () => {
    const auditor = new TaskDefinitionOfDoneAuditor();
    const passingChecklist = auditor.createDefaultPassingChecklist();
    const result = auditor.auditTask('CRK-SPEC-59', passingChecklist);

    expect(result.isComplete).toBe(true);
    expect(result.failedGates).toHaveLength(0);

    const failingChecklist = { ...passingChecklist, sourceSizeRuleSatisfied: false, lintPass: false };
    const failingResult = auditor.auditTask('CRK-SPEC-59', failingChecklist);
    expect(failingResult.isComplete).toBe(false);
    expect(failingResult.failedGates).toContain('implementation.sourceSizeRuleSatisfied');
    expect(failingResult.failedGates).toContain('verification.lintPass');
  });

  it('generates thread prompt enforcing §60 rules and pre-edit report', () => {
    const generator = new ImplementationPromptTemplate();
    const prompt = generator.generateThreadPrompt({
      taskId: 'CRK-SPEC-60',
      taskTitle: 'New-Thread Implementation Prompt Template',
      currentBranch: 'codex/cf04-cf10-integration',
      currentCommit: '178224d',
      relevantFiles: ['src/core/governance/ImplementationPromptTemplate.ts'],
      baselineBehavior: 'Templates were ad-hoc',
      implementationApproach: 'Formal template generator class',
      verificationCommands: ['npm run type-check:server'],
    });

    expect(prompt).toContain('AUTHORIZED TASK ONLY:');
    expect(prompt).toContain('CRK-SPEC-60 — New-Thread Implementation Prompt Template');
    expect(prompt).toContain('Keep production source files below 300 lines');
    expect(prompt).toContain('Before editing, report:');
  });

  it('formats and parses §61 handoff additions block', () => {
    const builder = new HandoffAdditionsBuilder();
    const block = builder.formatHandoffBlock({
      runtimeStageAffected: 'ContextPlanning',
      promptVersion: 'v2.1',
      modelPolicyVersion: 'v1.0',
      retrievalPolicyVersion: 'v1.2',
      datasetPackId: 'developer-qa-pack',
      datasetVersion: '2026.09',
      migrationIds: ['001_knowledge', '002_qa'],
      backwardCompatibility: 'Full',
      featureFlag: 'NONE',
      shadowCanaryStatus: 'Certified',
      goldenCasesAddedChanged: '5 added',
      abResult: '+4.2% accuracy',
      rollbackMethod: 'Revert commit',
    });

    expect(block).toContain('Runtime stage affected: ContextPlanning');
    expect(block).toContain('Dataset/pack ID: developer-qa-pack');

    const parsed = builder.parseHandoffBlock(block);
    expect(parsed.runtimeStageAffected).toBe('ContextPlanning');
    expect(parsed.datasetPackId).toBe('developer-qa-pack');
    expect(parsed.migrationIds).toEqual(['001_knowledge', '002_qa']);
  });
});
