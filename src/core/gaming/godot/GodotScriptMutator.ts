/**
 * Godot Script Mutator (PX08-T06)
 *
 * Implements safe, validated GDScript creation and updates, running ClassDB
 * preflight validation before saving to disk.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EngineMutationAction, GameEngineError } from '../engine/GameEngineTypes';
import { GodotClassDbValidator } from './GodotClassDbValidator';
import { resolveProjectPath } from '../engine/ProjectPathGuard';
import { validateGodotAction } from '../engine/EngineTextMutationPolicy';

export class GodotScriptMutator {
  /**
   * Apply script mutations with ClassDB validation
   */
  public static async applyAction(action: EngineMutationAction, projectRoot: string): Promise<void> {
    validateGodotAction(projectRoot, action);
    if (action.type !== 'create_script' && action.type !== 'update_script') {
      throw new GameEngineError('SCRIPT_VALIDATION_FAILED', `Godot script mutator does not support action type '${action.type}'.`);
    }
    const fullPath = resolveProjectPath(projectRoot, action.targetPath);

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (action.type === 'create_script' || action.type === 'update_script') {
      const code = action.params.content || '';
      const validation = GodotClassDbValidator.validateScript(code);

      if (!validation.valid && !action.params.skipValidation) {
        throw new GameEngineError(
          'SCRIPT_VALIDATION_FAILED',
          `GDScript validation failed: ${validation.errors.join('; ')}`,
          { errors: validation.errors, warnings: validation.warnings }
        );
      }

      fs.writeFileSync(fullPath, code, 'utf8');
    }
  }
}
