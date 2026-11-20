import fs from 'node:fs';
import path from 'node:path';
import { EngineTransaction } from './GameEngineTypes';
import { resolveProjectPath } from './ProjectPathGuard';

/** Validate every live path again before any restore; a replaced junction cannot redirect rollback writes. */
export function restoreEngineSnapshots(root: string, snapshots: EngineTransaction['snapshots']): void {
  const prepared = snapshots.map(snapshot => ({ ...snapshot, path: resolveProjectPath(root, snapshot.path) }));
  for (const snapshot of prepared.reverse()) {
    if (snapshot.previousContent === null) {
      if (fs.existsSync(snapshot.path) && fs.statSync(snapshot.path).isFile()) fs.unlinkSync(snapshot.path);
    } else {
      fs.mkdirSync(path.dirname(snapshot.path), { recursive: true });
      fs.writeFileSync(snapshot.path, snapshot.previousContent, 'utf8');
    }
  }
}
