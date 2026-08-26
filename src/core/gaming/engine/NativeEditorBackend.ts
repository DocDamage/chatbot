import { EngineAssertion, EngineAssertionReport, EngineExportPreset, EngineExportResult, EngineProfileSnapshot, EngineRuntimeOptions, EngineSceneInfo, EngineType } from './GameEngineTypes';

export interface NativeEditorBackend {
  isAvailable(engine: EngineType): boolean;
  inspectScene?(engine: EngineType, projectRoot: string, scenePath: string): Promise<EngineSceneInfo>;
  runScenario(engine: EngineType, projectRoot: string, options: EngineRuntimeOptions, assertions: EngineAssertion[]): Promise<EngineAssertionReport>;
  profile(engine: EngineType, projectRoot: string, durationMs?: number): Promise<EngineProfileSnapshot>;
  exportProject(engine: EngineType, projectRoot: string, preset: EngineExportPreset): Promise<EngineExportResult>;
}
