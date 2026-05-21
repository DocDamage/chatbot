import { CreativeOperation } from './CreativeTypes';

export type CreativeRoleplayAction =
  | 'ooc'
  | 'summary'
  | 'scene'
  | 'cast'
  | 'boundary'
  | 'rewind'
  | 'branch'
  | 'fade'
  | 'end'
  | 'regenerate'
  | 'continue'
  | 'help';

export interface CreativeCommandRoute {
  handled: boolean;
  operation?: CreativeOperation;
  revisionOperation?: string;
  roleplayAction?: CreativeRoleplayAction;
  prompt: string;
}

const revisionCommands: Record<string, string> = {
  expand: 'expand',
  condense: 'condense',
  darker: 'make_darker',
  funnier: 'make_funnier',
  tension: 'increase_tension',
  dialogue: 'improve_dialogue',
  show: 'show_dont_tell',
  line: 'line_edit',
  copy: 'copy_edit',
  continuity: 'continuity_fix',
  rating: 'rating_adjustment',
};

const roleplayCommands = new Set<CreativeRoleplayAction>([
  'ooc',
  'summary',
  'scene',
  'cast',
  'boundary',
  'rewind',
  'branch',
  'fade',
  'end',
  'regenerate',
  'continue',
]);

const helpText = [
  'Creative slash commands:',
  '/ooc, /summary, /scene, /cast, /boundary, /rewind, /branch, /fade, /end',
  '/revise expand|condense|darker|funnier|tension|dialogue|show|line|copy|continuity|rating',
].join('\n');

export class CreativeCommandRouter {
  static route(input: string): CreativeCommandRoute {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) {
      return { handled: false, prompt: input };
    }

    const [, command = '', rest = ''] = trimmed.match(/^\/([\w-]+)\s*(.*)$/) || [];
    const normalizedCommand = command.toLowerCase().replace(/-/g, '_');

    if (normalizedCommand === 'revise') {
      return this.routeRevision(rest);
    }

    if (roleplayCommands.has(normalizedCommand as CreativeRoleplayAction)) {
      return {
        handled: true,
        operation: normalizedCommand === 'summary' ? 'summarize_continuity' : 'roleplay_turn',
        roleplayAction: normalizedCommand as CreativeRoleplayAction,
        prompt: rest || normalizedCommand,
      };
    }

    return {
      handled: true,
      operation: 'roleplay_turn',
      roleplayAction: 'help',
      prompt: helpText,
    };
  }

  private static routeRevision(rest: string): CreativeCommandRoute {
    const trimmed = rest.trim();
    if (/^increase\s+tension\b/i.test(trimmed)) {
      return {
        handled: true,
        operation: 'revise_passage',
        revisionOperation: 'increase_tension',
        prompt: trimmed,
      };
    }
    if (/^show\s+don'?t\s+tell\b/i.test(trimmed)) {
      return {
        handled: true,
        operation: 'revise_passage',
        revisionOperation: 'show_dont_tell',
        prompt: trimmed,
      };
    }
    const [first = '', ...remaining] = trimmed.split(/\s+/);
    const key = first.toLowerCase();
    const revisionOperation = revisionCommands[key] || 'line_edit';
    const prompt = revisionCommands[key] ? remaining.join(' ').trim() : trimmed;

    return {
      handled: true,
      operation: 'revise_passage',
      revisionOperation,
      prompt: prompt || 'Revise the current passage.',
    };
  }
}
