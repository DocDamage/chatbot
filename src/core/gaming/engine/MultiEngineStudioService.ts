/**
 * Multi-Engine Studio Service (PX09-T08)
 *
 * Coordinates multi-engine sessions, certification summaries, active transactions,
 * and capability pack exports for Godot, Unity, Unreal, and AssetCooker.
 */

import { GameEngineBridge } from './GameEngineBridge';
import { EngineType, EngineStatus } from './GameEngineTypes';
import { ENGINE_CERTIFICATION_PROFILES, EngineCertificationProfile } from './EngineCertificationProfile';

export interface StudioSessionSummary {
  activeEngines: EngineStatus[];
  certificationProfiles: EngineCertificationProfile[];
  supportedTools: string[];
}

export class MultiEngineStudioService {
  constructor(private readonly bridge: GameEngineBridge) {}

  /**
   * Get an aggregated status summary across all supported engines
   */
  public getStudioSummary(): StudioSessionSummary {
    const activeEngines = this.bridge.listActiveConnections();
    const profiles = Object.values(ENGINE_CERTIFICATION_PROFILES);

    const supportedTools = [
      'engine_connect',
      'engine_inspect_project',
      'engine_inspect_scene',
      'engine_inspect_script',
      'engine_propose_mutation',
      'engine_apply_mutation',
      'engine_rollback_transaction',
      'engine_run_scenario',
      'engine_profile',
      'engine_export',
      'mast_analyze_occupancy',
      'sprite_slice_detect',
      'asset_cook_batch'
    ];

    return {
      activeEngines,
      certificationProfiles: profiles,
      supportedTools
    };
  }

  /**
   * Get the underlying engine bridge
   */
  public getBridge(): GameEngineBridge {
    return this.bridge;
  }
}
