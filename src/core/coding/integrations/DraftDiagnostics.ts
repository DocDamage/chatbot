export interface DraftDiagnostic { tool: 'typescript' | 'eslint' | 'node'; file: string; line?: number; column?: number; code: string; message: string; anchor?: string }
/** Counts occurrences so moving an existing issue is allowed but duplicating it is not. */
export function introducedDiagnostics(before: DraftDiagnostic[], after: DraftDiagnostic[]): DraftDiagnostic[] {
  const key = (item: DraftDiagnostic) => JSON.stringify([item.tool, item.file, item.code, item.message, item.anchor || '']);
  const remaining = new Map<string, number>();
  for (const item of before) remaining.set(key(item), (remaining.get(key(item)) || 0) + 1);
  return after.filter(item => {
    const count = remaining.get(key(item)) || 0;
    if (!count) return true;
    remaining.set(key(item), count - 1); return false;
  });
}
export const formatDraftDiagnostic = (item: DraftDiagnostic) => `${item.file}${item.line ? `:${item.line}:${item.column || 1}` : ''} ${item.tool} ${item.code}: ${item.message}`;
