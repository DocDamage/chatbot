/**
 * Canonical Conversation Context Selector (CRK-P03-T06)
 *
 * Filters conversation variables to only include those relevant to the current task/intent:
 * - Coding/debugging tasks include repository, toolchain, framework, and OS (§1078).
 * - Creative/conversational tasks (e.g. poetry) omit technical environment variables to conserve tokens (§1072).
 * - Research/analysis tasks include knowledge pack, goal, and output format directives.
 */

import { ConversationVariable } from '../../types/conversation-state';

export class ConversationContextSelector {
  private static readonly CODING_KEYS = new Set([
    'userGoal',
    'currentProject',
    'repository',
    'workspaceRoot',
    'programmingLanguage',
    'framework',
    'frameworkVersion',
    'runtimeVersion',
    'operatingSystem',
    'targetPlatform',
    'currentTask',
    'activeArtifact',
    'activePlanId',
    'requestedOutput',
  ]);

  private static readonly CREATIVE_KEYS = new Set([
    'userGoal',
    'requestedOutput',
    'selectedMode',
  ]);

  private static readonly RESEARCH_KEYS = new Set([
    'userGoal',
    'requestedOutput',
    'selectedKnowledgePack',
    'selectedModelPolicy',
    'currentTask',
  ]);

  public selectRelevant(
    taskTypeOrIntent: string,
    variables: Record<string, ConversationVariable>
  ): Record<string, unknown> {
    const norm = taskTypeOrIntent.toLowerCase();

    let allowedKeys: Set<string>;
    if (norm.includes('cod') || norm.includes('debug') || norm.includes('repo') || norm.includes('build') || norm.includes('dev')) {
      allowedKeys = ConversationContextSelector.CODING_KEYS;
    } else if (norm.includes('poem') || norm.includes('creative') || norm.includes('story') || norm.includes('casual')) {
      allowedKeys = ConversationContextSelector.CREATIVE_KEYS;
    } else if (norm.includes('research') || norm.includes('academic') || norm.includes('analysis')) {
      allowedKeys = ConversationContextSelector.RESEARCH_KEYS;
    } else {
      // General QA / default fallback: include goals and output preference, exclude low-level compiler/OS details
      allowedKeys = new Set(['userGoal', 'requestedOutput', 'currentProject', 'repository', 'selectedMode']);
    }

    const result: Record<string, unknown> = {};
    for (const [key, variable] of Object.entries(variables)) {
      if (allowedKeys.has(key)) {
        result[key] = variable.value;
      }
    }
    return result;
  }

  public selectByKeys(
    keys: string[],
    variables: Record<string, ConversationVariable>
  ): Record<string, unknown> {
    const keySet = new Set(keys);
    const result: Record<string, unknown> = {};
    for (const [key, variable] of Object.entries(variables)) {
      if (keySet.has(key)) {
        result[key] = variable.value;
      }
    }
    return result;
  }
}
