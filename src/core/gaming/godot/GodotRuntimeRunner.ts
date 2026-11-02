/**
 * Godot Runtime Runner & Scenario Assertions (PX08-T07)
 *
 * Runs Godot scene simulations (headless or windowed), captures structured logs,
 * captures screenshot artifacts, and verifies runtime assertions.
 */

import {
  EngineRuntimeOptions,
  EngineAssertion,
  EngineAssertionReport,
  GameEngineError,
  EngineProfileSnapshot
} from '../engine/GameEngineTypes';

export class GodotRuntimeRunner {
  constructor(private readonly projectRoot: string, private readonly backend?: GodotRuntimeBackend) {}

  /**
   * Execute a runtime scenario and verify assertions against captured state
   */
  public async runScenario(
    options: EngineRuntimeOptions,
    assertions: EngineAssertion[] = []
  ): Promise<EngineAssertionReport> {
    if (!this.backend) {
      throw new GameEngineError('RUNTIME_EXECUTION_FAILED', 'GODOT_RUNTIME_BACKEND_UNAVAILABLE: configure a verified Godot runtime backend.');
    }
    return this.backend.runScenario(this.projectRoot, options, assertions);
  }
}

export interface GodotRuntimeBackend {
  runScenario(projectRoot: string, options: EngineRuntimeOptions, assertions: EngineAssertion[]): Promise<EngineAssertionReport>;
  profileProject?(projectRoot: string, durationMs?: number): Promise<EngineProfileSnapshot>;
}
