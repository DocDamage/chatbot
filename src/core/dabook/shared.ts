import { DabookBridge } from './DabookBridge';

let sharedBridge: DabookBridge | undefined;

/**
 * Process-wide bridge. Sharing one instance matters: it owns the call queue that serializes
 * access to DABOOK's single-writer workspace, and the interpreter probe cache.
 */
export function getDabookBridge(): DabookBridge {
  sharedBridge ??= new DabookBridge();
  return sharedBridge;
}

export function resetDabookBridgeForTests(): void {
  sharedBridge = undefined;
}
