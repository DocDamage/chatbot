export type WorkMode = 'plan' | 'implement' | 'debug' | 'chat';

export type WorkAction =
  | 'create_plan'
  | 'update_plan'
  | 'read_files'
  | 'search_files'
  | 'write_files'
  | 'run_tests'
  | 'create_patch'
  | 'read_logs'
  | 'inspect_error'
  | 'write_debug_fix'
  | 'chat';

const allowedActions: Record<WorkMode, WorkAction[]> = {
  plan: ['create_plan', 'update_plan', 'read_files', 'search_files'],
  implement: ['read_files', 'write_files', 'run_tests', 'create_patch'],
  debug: ['read_logs', 'run_tests', 'inspect_error', 'write_debug_fix'],
  chat: ['chat']
};

export function normalizeWorkMode(mode?: string): WorkMode {
  if (mode === 'plan' || mode === 'implement' || mode === 'debug' || mode === 'chat') return mode;
  return 'chat';
}

export function isActionAllowed(mode: string | undefined, action: WorkAction): boolean {
  return allowedActions[normalizeWorkMode(mode)].includes(action);
}

export function assertActionAllowed(mode: string | undefined, action: WorkAction): void {
  const normalized = normalizeWorkMode(mode);
  if (!allowedActions[normalized].includes(action)) {
    throw new Error(`Action ${action} is not allowed in ${normalized} mode`);
  }
}

export function modeFromRequest(input: { headerMode?: unknown; bodyMode?: unknown }): WorkMode {
  const headerMode = Array.isArray(input.headerMode) ? input.headerMode[0] : input.headerMode;
  return normalizeWorkMode(String(headerMode || input.bodyMode || 'chat'));
}
