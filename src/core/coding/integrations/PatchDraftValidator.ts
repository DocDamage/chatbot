import fs from 'fs';
import path from 'path';
import { CodingToolConfig } from './CodingToolConfig';
import { ToolFile, materialize } from './ToolWorkspace';
import { EditOperation } from '../types';
import { checkDraft } from './DraftChecks';

/** Validates candidate replacements in a private copy, never in the approved repository. */
export async function validatePatchDraft(config: CodingToolConfig, root: string, files: ToolFile[], operations: EditOperation[], signal?: AbortSignal) {
  fs.mkdirSync(config.dataRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(config.dataRoot, 'validation-'));
  const workspace = materialize(directory, files);
  for (const operation of operations) {
    const file = files.find(file => file.path === operation.path);
    if (!file || operation.operation === 'delete') throw new Error('Static patch validation requires captured create/modify targets.');
    fs.writeFileSync(path.join(workspace, file.path), operation.content || '');
  }
  const result = await checkDraft(config, workspace, files, signal, root);
  fs.writeFileSync(path.join(directory, 'checks.json'), JSON.stringify(result, null, 2));
  return result;
}
