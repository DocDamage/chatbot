/**
 * Engine Certification Profile (PX09-T01)
 *
 * Defines the certification contract for each supported or experimental
 * game engine adapter (Godot, Unity, Unreal, AssetCooker).
 */

import { EngineType } from './GameEngineTypes';

export interface EngineCertificationProfile {
  engine: EngineType;
  displayName: string;
  adapterVersion: string;
  supportedEngineVersions: string[];
  supportedOS: Array<'windows' | 'linux' | 'macos'>;
  transport: 'mcp' | 'cli' | 'websocket' | 'ipc';
  readOnlyCapabilities: string[];
  mutationCapabilities: string[];
  undoSupport: 'native_editor' | 'transaction_snapshot' | 'none';
  projectRootModel: 'approved_root_confinement';
  externalBinaryRequirements: string[];
  licenseStatus: 'permissive_cleared' | 'mpl_isolated' | 'clean_room_verified' | 'blocked_pending_license';
  knownLimitations: string[];
  canaryMatrixHardware: string[];
}

export const ENGINE_CERTIFICATION_PROFILES: Record<EngineType, EngineCertificationProfile> = {
  godot: {
    engine: 'godot',
    displayName: 'Godot Engine (Local CLI Bridge)',
    adapterVersion: '1.0.0',
    supportedEngineVersions: ['4.2.x', '4.3.x', '3.5.x'],
    supportedOS: ['windows', 'linux', 'macos'],
    transport: 'cli',
    readOnlyCapabilities: [
      'inspect_project_settings',
      'inspect_scene_tree',
      'inspect_scripts',
      'inspect_resources',
      'inspect_classdb',
      'inspect_input_map'
    ],
    mutationCapabilities: [
      'create_scene',
      'modify_nodes',
      'set_properties',
      'connect_signals',
      'edit_gdscript',
      'create_resources',
      'headless_export'
    ],
    undoSupport: 'transaction_snapshot',
    projectRootModel: 'approved_root_confinement',
    externalBinaryRequirements: ['godot'],
    licenseStatus: 'permissive_cleared',
    knownLimitations: [
      'C# script compilation requires dotnet CLI',
      'Advanced 3D viewport rendering requires active display driver'
    ],
    canaryMatrixHardware: ['Windows 11 x64', 'Ubuntu 22.04 LTS']
  },
  unity: {
    engine: 'unity',
    displayName: 'Unity Engine (MAST & Editor Bridge)',
    adapterVersion: '1.0.0',
    supportedEngineVersions: ['2022.3 LTS', '6000.x (Unity 6)'],
    supportedOS: ['windows', 'macos'],
    transport: 'cli',
    readOnlyCapabilities: [
      'inspect_project_structure',
      'inspect_prefab_palette',
      'inspect_grid_occupancy',
      'inspect_hierarchy',
      'inspect_materials'
    ],
    mutationCapabilities: [
      'propose_modular_placement',
      'propose_material_paint',
      'assemble_prefab_layout'
    ],
    undoSupport: 'native_editor',
    projectRootModel: 'approved_root_confinement',
    externalBinaryRequirements: ['Unity Editor', 'MAST package (optional)'],
    licenseStatus: 'clean_room_verified',
    knownLimitations: [
      'Batch execution requires an activated Unity Editor license',
      'Gameplay assertions and profiler metrics require a reviewed project-side instrumentation bridge',
      'Sample assets must not be distributed without independent license clearance'
    ],
    canaryMatrixHardware: ['Windows 11 x64']
  },
  unreal: {
    engine: 'unreal',
    displayName: 'Unreal Engine 5 (Clean-room CLI Adapter)',
    adapterVersion: '1.0.0',
    supportedEngineVersions: ['5.5.x', '5.8.x'],
    supportedOS: ['windows'],
    transport: 'cli',
    readOnlyCapabilities: [
      'inspect_editor_installation',
      'inspect_project_descriptor',
      'inspect_binary_map_metadata',
      'validate_project_commandlet'
    ],
    mutationCapabilities: [
      'propose_source_edit',
      'apply_exact_digest_file_transaction',
      'rollback_file_transaction',
      'package_with_automation_tool'
    ],
    undoSupport: 'transaction_snapshot',
    projectRootModel: 'approved_root_confinement',
    externalBinaryRequirements: ['UnrealEditor.exe'],
    licenseStatus: 'clean_room_verified',
    knownLimitations: [
      'No unlicensed upstream MCP bridge code is used',
      'Gameplay assertions and profiler metrics require a reviewed project-side instrumentation bridge'
    ],
    canaryMatrixHardware: ['Windows 11 x64 RTX']
  },
  custom: {
    engine: 'custom',
    displayName: 'Custom Engine Adapter',
    adapterVersion: '0.1.0',
    supportedEngineVersions: ['any'],
    supportedOS: ['windows', 'linux', 'macos'],
    transport: 'cli',
    readOnlyCapabilities: ['inspect_files'],
    mutationCapabilities: ['propose_patch'],
    undoSupport: 'transaction_snapshot',
    projectRootModel: 'approved_root_confinement',
    externalBinaryRequirements: [],
    licenseStatus: 'permissive_cleared',
    knownLimitations: ['Generic CLI adapter only'],
    canaryMatrixHardware: ['Generic']
  }
};
