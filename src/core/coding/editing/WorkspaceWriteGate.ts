import { assertActionAllowed, WorkMode } from '../../modes/ExecutionModePolicy';
import { StructuredPatch } from '../types';

export class WorkspaceWriteGate {
  assertCanApply(mode: WorkMode, patch: StructuredPatch): void {
    assertActionAllowed(mode, 'write_files');
    if (patch.conflicts.length) throw new Error('Patch has unresolved conflicts');
    if (!patch.operations.every(operation => operation.authorized)) throw new Error('Every edit requires explicit authorization');
  }
}
