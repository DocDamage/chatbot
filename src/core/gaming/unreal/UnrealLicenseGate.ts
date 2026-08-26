/**
 * Unreal Engine Legal License Gate (PX09-T05)
 *
 * Enforces legal compliance gate on Unreal Engine bridge modules.
 * Ensures that external Unreal adapters remain blocked or clean-room verified
 * unless explicit permission or upstream permissive licenses are verified.
 */

import { GameEngineError } from '../engine/GameEngineTypes';

export type UnrealLegalStatus = 'BLOCKED_PENDING_LICENSE' | 'CLEAN_ROOM_VERIFIED' | 'PERMISSIVE_CLEARED';

export class UnrealLicenseGate {
  private static status: UnrealLegalStatus = 'CLEAN_ROOM_VERIFIED'; // Clean-room read-only active

  /**
   * Get current legal gate status
   */
  public static getStatus(): UnrealLegalStatus {
    return this.status;
  }

  /**
   * Set status (e.g. for testing or when upstream grants clearance)
   */
  public static setStatus(status: UnrealLegalStatus): void {
    this.status = status;
  }

  /**
   * Assert that the license gate is passed before running Unreal operations
   */
  public static assertCleared(): void {
    if (this.status === 'BLOCKED_PENDING_LICENSE') {
      throw new GameEngineError(
        'LICENSE_GATE_BLOCKED',
        'Unreal Engine adapter is blocked pending legal/license clearance. Protocol observation only.'
      );
    }
  }
}
