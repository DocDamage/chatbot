/**
 * Canonical Debug Guided Workflow Definition (CRK-P04-T04)
 *
 * Implements the 9-step production debugging workflow (§1166-1179):
 * collect symptom/error -> inspect project evidence -> identify environment/version ->
 * retrieve official docs -> rank hypotheses -> propose minimal repair ->
 * verify -> bounded repair -> report unresolved risks.
 */

import { WorkflowDefinition } from '../../../types/workflow';

export const DEBUG_WORKFLOW_ID = 'wf-debug-v1';

export const debugWorkflowDefinition: WorkflowDefinition = {
  id: DEBUG_WORKFLOW_ID,
  version: 1,
  name: 'Production Debug Guided Workflow',
  description:
    'Structured pipeline for diagnosing defects, isolating reproduction evidence, hypothesis ranking, and verified repair.',
  intents: ['debug', 'bug_fix', 'troubleshoot', 'diagnose_error'],
  startStep: 'step-collect-symptom',
  steps: {
    'step-collect-symptom': {
      id: 'step-collect-symptom',
      type: 'capture-variable',
      name: 'Collect Symptom & Error',
      description: 'Capture error messages, stack traces, and expected versus actual behavior',
      config: { targetVariables: ['userGoal', 'currentTask'] },
      nextStepId: 'step-inspect-evidence',
      transitions: [],
    },
    'step-inspect-evidence': {
      id: 'step-inspect-evidence',
      type: 'call-tool',
      name: 'Inspect Relevant Project Evidence',
      description: 'Read logs, affected files, and test reproduction evidence',
      config: { tool: 'inspect_error_context' },
      nextStepId: 'step-identify-environment',
      transitions: [],
    },
    'step-identify-environment': {
      id: 'step-identify-environment',
      type: 'capture-variable',
      name: 'Identify Environment & Version',
      description: 'Pinpoint exact framework version, dependencies, runtime, and OS',
      config: {
        targetVariables: ['framework', 'frameworkVersion', 'operatingSystem', 'runtimeVersion'],
      },
      nextStepId: 'step-retrieve-docs',
      transitions: [],
    },
    'step-retrieve-docs': {
      id: 'step-retrieve-docs',
      type: 'retrieve-knowledge',
      name: 'Retrieve Official Docs & Known Issues',
      description: 'Query knowledge packs for documented caveats, breaking changes, or deprecations',
      config: { searchScope: 'troubleshooting' },
      nextStepId: 'step-rank-hypotheses',
      transitions: [],
    },
    'step-rank-hypotheses': {
      id: 'step-rank-hypotheses',
      type: 'call-model',
      name: 'Rank Hypotheses',
      description: 'Formulate and rank candidate root causes ordered by plausibility and evidence',
      config: { mode: 'diagnostic_reasoning' },
      nextStepId: 'step-propose-repair',
      transitions: [],
    },
    'step-propose-repair': {
      id: 'step-propose-repair',
      type: 'call-model',
      name: 'Propose Minimal Repair',
      description: 'Synthesize minimal, non-invasive fix to resolve defect without regressions',
      config: { minimizeBlastRadius: true },
      nextStepId: 'step-verify',
      transitions: [],
    },
    'step-verify': {
      id: 'step-verify',
      type: 'verify',
      name: 'Verify Repair',
      description: 'Run reproduction test to verify error resolution',
      config: { testTarget: 'repro' },
      nextStepId: 'step-report-risks',
      transitions: [
        { condition: 'verify.failed == true && verify.retryCount < 2', targetStepId: 'step-bounded-repair' },
      ],
    },
    'step-bounded-repair': {
      id: 'step-bounded-repair',
      type: 'call-model',
      name: 'Bounded Repair Attempt',
      description: 'Adjust patch based on persistent verification error',
      config: { maxAttempts: 2 },
      nextStepId: 'step-verify',
      transitions: [],
    },
    'step-report-risks': {
      id: 'step-report-risks',
      type: 'emit',
      name: 'Report Unresolved Risks & Solution',
      description: 'Deliver verified solution summary, root cause explanation, and remaining risks',
      config: { outputFormat: 'diagnostic_report' },
      nextStepId: 'step-end',
      transitions: [],
    },
    'step-end': {
      id: 'step-end',
      type: 'end',
      name: 'Debug Complete',
      description: 'Terminal workflow state',
      config: {},
      transitions: [],
    },
  },
};
