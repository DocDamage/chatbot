export interface LocalToolPolicyResult {
  allowed: boolean;
  reason?: string;
}

const allowedFlagsByTool: Record<string, string[]> = {
  aseprite: [
    '-b',
    '--sheet',
    '--data',
    '--format',
    '--sheet-type',
    '--list-tags',
    '--list-slices',
    '--list-layers',
    '--save-as',
    '--trim',
    '--trim-sprite',
    '--ignore-empty',
    '--merge-duplicates',
    '--split-tags',
    '--split-slices',
    '--split-grid',
    '--all-layers',
    '--split-layers',
    '--layer',
    '--ignore-layer',
    '--tag',
    '--frame-range',
    '--extrude',
    '--script-param',
    '--script'
  ],
  libresprite: [
    '-b',
    '--sheet',
    '--data',
    '--format',
    '--sheet-type',
    '--save-as',
    '--trim',
    '--trim-sprite',
    '--ignore-empty',
    '--merge-duplicates'
  ]
};

export function validateLocalToolArgs(toolSlug: string | undefined, args: string[]): LocalToolPolicyResult {
  if (!toolSlug) return { allowed: true };
  const allowed = allowedFlagsByTool[toolSlug];
  if (!allowed) return { allowed: true };

  for (const arg of args) {
    if (arg.startsWith('-') && !allowed.includes(arg)) {
      return {
        allowed: false,
        reason: `Flag is not allowed for ${toolSlug}: ${arg}`
      };
    }
  }

  return { allowed: true };
}
