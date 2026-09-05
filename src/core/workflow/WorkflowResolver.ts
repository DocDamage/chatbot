/**
 * Canonical Chat Workflow Resolver (CRK-P04-T05)
 *
 * Implements IChatWorkflowResolver for ChatRuntime:
 * - Selects guided workflows only when explicitly triggered by specialized intents (§1103).
 * - Bypasses workflow engine for ordinary chat, creative writing, and casual Q&A (§1206).
 */

import {
  IChatWorkflowResolver,
  ChatWorkflowDefinition,
} from '../chat/ChatRuntime';
import {
  NormalizedChatRequest,
  TaskClassificationResult,
} from '../../types/chat-runtime';
import { codingBuildWorkflowDefinition } from './definitions/CodingBuildWorkflow';
import { debugWorkflowDefinition } from './definitions/DebugWorkflow';
import { WorkflowDefinition } from '../../types/workflow';

export class WorkflowResolver implements IChatWorkflowResolver {
  private readonly workflows = new Map<string, WorkflowDefinition>();

  constructor() {
    this.workflows.set(codingBuildWorkflowDefinition.id, codingBuildWorkflowDefinition);
    this.workflows.set(debugWorkflowDefinition.id, debugWorkflowDefinition);
  }

  public async resolve(
    analysis: TaskClassificationResult,
    request: NormalizedChatRequest
  ): Promise<ChatWorkflowDefinition | undefined> {
    const text = request.message.toLowerCase();

    // Check if user requested an escape hatch or bypass
    if (text === 'cancel' || text === 'exit workflow' || text === 'chat normally') {
      return undefined;
    }

    // Coding & Build guided workflow trigger
    if (
      request.mode === 'coding_guided' ||
      analysis.intent === 'coding_build' ||
      analysis.intent === 'code_modification' ||
      (analysis.taskType === 'coding' && (text.includes('build feature') || text.includes('implement plan')))
    ) {
      return this.toRuntimeWorkflow(codingBuildWorkflowDefinition);
    }

    // Debug guided workflow trigger
    if (
      request.mode === 'debug_guided' ||
      analysis.intent === 'debug' ||
      analysis.intent === 'bug_fix' ||
      (analysis.taskType === 'coding' && (text.includes('debug error') || text.includes('diagnose bug')))
    ) {
      return this.toRuntimeWorkflow(debugWorkflowDefinition);
    }

    // Ordinary chat, creative writing, research Q&A bypass workflow engine
    return undefined;
  }

  private toRuntimeWorkflow(wf: WorkflowDefinition): ChatWorkflowDefinition {
    return {
      workflowId: wf.id,
      name: wf.name,
      steps: Object.values(wf.steps).map((s) => ({
        id: s.id,
        type: s.type,
        config: s.config,
      })),
    };
  }

  public getWorkflowDefinition(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id);
  }
}
