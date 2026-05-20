import { ChatMode, UserIntent } from '../../types/modes';

export interface ModeSwitchRequirement {
  required: boolean;
  targetMode?: ChatMode;
  message?: string;
}

const implementationModes = new Set<ChatMode>(['implement']);
const debugModes = new Set<ChatMode>(['debug']);
const planningModes = new Set<ChatMode>(['plan']);

const stackTracePattern = /\b(?:TypeError|ReferenceError|SyntaxError|RangeError|UnhandledPromiseRejection|Exception|Traceback|stack trace|cannot read properties|is not a function|failed|failing test)\b/i;
const implementationPattern = /\b(?:implement|write code|create patch|apply patch|modify|change|add feature|build|code this|save file|edit file)\b/i;
const planPattern = /\b(?:plan|roadmap|implementation plan|design doc|markdown plan)\b/i;

export function normalizeMode(mode?: string): ChatMode {
  return (mode || 'ask') as ChatMode;
}

export function canPlan(mode?: string): boolean {
  return planningModes.has(normalizeMode(mode));
}

export function canImplement(mode?: string): boolean {
  return implementationModes.has(normalizeMode(mode));
}

export function canDebug(mode?: string): boolean {
  return debugModes.has(normalizeMode(mode));
}

export function canRunCommands(mode?: string): boolean {
  return canImplement(mode) || canDebug(mode);
}

export function canGeneratePatch(mode?: string): boolean {
  return canImplement(mode);
}

export function canApplyPatch(mode?: string): boolean {
  return canImplement(mode);
}

export function detectUserIntent(message: string): UserIntent {
  if (stackTracePattern.test(message)) return 'debug';
  if (implementationPattern.test(message)) return 'implement';
  if (planPattern.test(message)) return 'plan';
  if (/\b(?:explain|what does|how does)\b/i.test(message)) return 'explain';
  return 'ask';
}

export function requiresSwitchForIntent(mode: string | undefined, intent: UserIntent): ModeSwitchRequirement {
  const currentMode = normalizeMode(mode);
  if (intent === 'debug' && !canDebug(currentMode)) {
    return {
      required: true,
      targetMode: 'debug',
      message: 'Debugging is only available in Debug mode. Switch to Debug to investigate this issue.'
    };
  }
  if (intent === 'implement' && !canImplement(currentMode)) {
    return {
      required: true,
      targetMode: 'implement',
      message: 'Code changes are only available in Implement mode. Switch to Implement to write or modify files.'
    };
  }
  if (intent === 'plan' && currentMode === 'implement') {
    return {
      required: true,
      targetMode: 'plan',
      message: 'Planning is available in Plan mode. Switch to Plan to save a Markdown implementation plan.'
    };
  }
  return { required: false };
}

export function isDebugLikeCommand(command: string): boolean {
  return /\b(?:test|jest|vitest|tsx|node|npm run dev|npm start|tail|logs?|debug|inspect)\b/i.test(command);
}
