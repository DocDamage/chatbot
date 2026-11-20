import fs from 'node:fs';
import path from 'node:path';
import { EngineMutationAction, GameEngineError } from './GameEngineTypes';
import { resolveProjectPath } from './ProjectPathGuard';

const textExtensions = new Set(['.txt', '.gd', '.gdshader', '.tscn', '.tres', '.cs', '.cpp', '.c', '.cc', '.h', '.hpp',
  '.json', '.ini', '.cfg', '.asmdef', '.asmref', '.csproj', '.uproject', '.uplugin', '.shader']);

/** Native binary formats require a native/format-aware operation, never UTF-8 replacement. */
export function validateTextTarget(root: string, action: EngineMutationAction): string {
  const target = resolveProjectPath(root, action.targetPath);
  if (!textExtensions.has(path.extname(target).toLowerCase()) && path.basename(target) !== 'project.godot') {
    throw new GameEngineError('SCRIPT_VALIDATION_FAILED', `Native or unknown asset format cannot use a UTF-8 writer: ${action.targetPath}`);
  }
  if (fs.existsSync(target)) {
    if (!fs.statSync(target).isFile()) throw new GameEngineError('SCRIPT_VALIDATION_FAILED', 'Mutation target must be a file.');
    const bytes = fs.readFileSync(target);
    if (bytes.includes(0) || !Buffer.from(bytes.toString('utf8'), 'utf8').equals(bytes)) {
      throw new GameEngineError('SCRIPT_VALIDATION_FAILED', `Binary content cannot use a UTF-8 writer: ${action.targetPath}`);
    }
  }
  return target;
}

export const GODOT_MUTATION_ACTIONS = Object.freeze([
  'create_scene', 'delete_scene', 'add_node', 'set_property', 'connect_signal', 'modify_resource', 'create_script', 'update_script'
] as const);

export function validateGodotAction(root: string, action: EngineMutationAction): void {
  if (!(GODOT_MUTATION_ACTIONS as readonly string[]).includes(action.type)) {
    throw new GameEngineError('SCRIPT_VALIDATION_FAILED', `Godot does not support action type '${action.type}'.`);
  }
  validateTextTarget(root, action);
  const extension = path.extname(action.targetPath).toLowerCase();
  const expectedExtension = action.type.endsWith('_script') ? '.gd' : action.type === 'modify_resource' ? '.tres' : '.tscn';
  if (extension !== expectedExtension) throw new GameEngineError('SCRIPT_VALIDATION_FAILED', `${action.type} requires a ${expectedExtension} target.`);
  if (action.type.endsWith('_script') && typeof action.params.content !== 'string') {
    throw new GameEngineError('SCRIPT_VALIDATION_FAILED', `${action.type} requires params.content.`);
  }
}
