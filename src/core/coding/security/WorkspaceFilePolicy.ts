/** Trusted server configuration, never a caller-supplied path-policy override. */
export type ProjectFileKind = 'godot' | 'unity' | 'unreal' | 'rpg-maker-mz' | 'rom';
export type FileRole = 'editable-text' | 'structured-data' | 'engine-native' | 'binary-tool' | 'read-only' | 'excluded';
export interface FileDecision { path: string; role: FileRole; reason: string }
export interface WorkspaceFilePolicy {
  readonly kind: ProjectFileKind;
  classify(file: string): FileDecision;
  allowsDirectory(directory: string): boolean;
  canReadText(file: string): boolean;
  canEditText(file: string): boolean;
}
