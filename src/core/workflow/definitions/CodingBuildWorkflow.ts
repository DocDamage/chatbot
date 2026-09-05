/**
 * Canonical Coding & Build Workflow Definition (CRK-P04-T03)
 *
 * Implements the 12-step production coding/build workflow (§1145-1165):
 * understand goal -> inspect project/repository -> detect stack/toolchains ->
 * retrieve official docs -> build plan -> generate proposed change ->
 * request approval -> apply -> verify -> bounded repair -> review -> report exact result.
 *
 * Enforces the repository's explicit authorization model (§1164).
 */

import { WorkflowDefinition } from '../../../types/workflow';

export const CODING_BUILD_WORKFLOW_ID = 'wf-coding-build-v1';

export const codingBuildWorkflowDefinition: WorkflowDefinition = {
  id: CODING_BUILD_WORKFLOW_ID,
  version: 1,
  name: 'Production Coding & Build Guided Workflow',
  description:
    'Structured pipeline for repository modifications, plan authoring, verified application, and audit reporting.',
  intents: ['coding_build', 'feature_implementation', 'refactoring', 'code_modification'],
  startStep: 'step-understand-goal',
  steps: {
    'step-understand-goal': {
      id: 'step-understand-goal',
      type: 'capture-variable',
      name: 'Understand Goal',
      description: 'Capture user intent and project target parameters',
      config: { targetVariables: ['userGoal', 'currentTask'] },
      nextStepId: 'step-inspect-project',
      transitions: [],
    },
    'step-inspect-project': {
      id: 'step-inspect-project',
      type: 'call-tool',
      name: 'Inspect Project/Repository',
      description: 'Inspect workspace files, manifests, and git status',
      config: { tool: 'inspect_project', paths: ['package.json', 'Cargo.toml', 'project.godot'] },
      nextStepId: 'step-detect-toolchain',
      transitions: [],
    },
    'step-detect-toolchain': {
      id: 'step-detect-toolchain',
      type: 'capture-variable',
      name: 'Detect Stack & Toolchain',
      description: 'Record language, framework, runtime, and version variables',
      config: {
        targetVariables: ['programmingLanguage', 'framework', 'frameworkVersion', 'operatingSystem'],
      },
      nextStepId: 'step-retrieve-docs',
      transitions: [],
    },
    'step-retrieve-docs': {
      id: 'step-retrieve-docs',
      type: 'retrieve-knowledge',
      name: 'Retrieve Current Official Docs',
      description: 'Query official documentation and knowledge packs for version-specific syntax',
      config: { maxPacks: 2, fallbackToOnline: true },
      nextStepId: 'step-build-plan',
      transitions: [],
    },
    'step-build-plan': {
      id: 'step-build-plan',
      type: 'call-model',
      name: 'Build Implementation Plan',
      description: 'Generate structured implementation plan with verification criteria',
      config: { mode: 'planning', requireVerificationPlan: true },
      nextStepId: 'step-generate-change',
      transitions: [],
    },
    'step-generate-change': {
      id: 'step-generate-change',
      type: 'call-model',
      name: 'Generate Proposed Change',
      description: 'Synthesize concrete diffs and target file operations',
      config: { format: 'diff_envelope' },
      nextStepId: 'step-request-approval',
      transitions: [],
    },
    'step-request-approval': {
      id: 'step-request-approval',
      type: 'approval',
      name: 'Request Required Approval',
      description: 'Cryptographically bind user consent to exact file operations and input hash',
      config: { requiresSignature: true, expirySeconds: 300 },
      nextStepId: 'step-apply',
      transitions: [],
    },
    'step-apply': {
      id: 'step-apply',
      type: 'call-tool',
      name: 'Apply Modifications',
      description: 'Execute authorized file edits or write operations',
      config: { enforceApprovalToken: true },
      nextStepId: 'step-verify',
      transitions: [],
    },
    'step-verify': {
      id: 'step-verify',
      type: 'verify',
      name: 'Verify Modifications',
      description: 'Execute automated tests, linters, and type-checks',
      config: { testCommands: ['npm run type-check', 'npm test'] },
      nextStepId: 'step-review',
      transitions: [
        { condition: 'verify.failed == true && verify.retryCount < 2', targetStepId: 'step-bounded-repair' },
      ],
    },
    'step-bounded-repair': {
      id: 'step-bounded-repair',
      type: 'call-model',
      name: 'Bounded Repair',
      description: 'Generate surgical repair patch for compiler or test failure',
      config: { maxAttempts: 2 },
      nextStepId: 'step-apply',
      transitions: [],
    },
    'step-review': {
      id: 'step-review',
      type: 'call-model',
      name: 'Review Implementation',
      description: 'Review final changes against original user goal and quality requirements',
      config: { mode: 'review' },
      nextStepId: 'step-report-result',
      transitions: [],
    },
    'step-report-result': {
      id: 'step-report-result',
      type: 'emit',
      name: 'Report Exact Result',
      description: 'Deliver structured summary of modified files, verification results, and diffs',
      config: { outputFormat: 'summary_and_evidence' },
      nextStepId: 'step-end',
      transitions: [],
    },
    'step-end': {
      id: 'step-end',
      type: 'end',
      name: 'Workflow Complete',
      description: 'Terminal workflow state',
      config: {},
      transitions: [],
    },
  },
};
