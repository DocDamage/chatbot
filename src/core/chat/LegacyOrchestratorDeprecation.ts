/**
 * Legacy Orchestrator Deprecation & Compatibility Wrapper (CRK-P26-T09)
 *
 * Provides backward-compatible routing for legacy caller paths into the
 * Canonical ChatRuntime while logging deprecation notices and tracking telemetry.
 */

import { ChatRuntime } from './ChatRuntime';
import { NormalizedChatRequest, ChatRuntimeResult } from '../../types/chat-runtime';

export interface LegacyDeprecationTelemetry {
  invocations: number;
  lastCaller?: string;
  deprecatedPathsRouted: string[];
}

export class LegacyOrchestratorDeprecation {
  private readonly runtime: ChatRuntime;
  private invocationCount = 0;
  private readonly routedPaths = new Set<string>();

  constructor(runtime: ChatRuntime) {
    this.runtime = runtime;
  }

  /**
   * Compatibility wrapper forwarding legacy dispatch requests to Canonical ChatRuntime
   */
  public async dispatchLegacyRequest(
    request: NormalizedChatRequest,
    callerOrigin = 'legacy-orchestrator-shim'
  ): Promise<ChatRuntimeResult> {
    this.invocationCount++;
    this.routedPaths.add(callerOrigin);

    // Route directly through canonical ChatRuntime
    return await this.runtime.execute(request);
  }

  /**
   * Check telemetry to verify migration progress
   */
  public getDeprecationTelemetry(): LegacyDeprecationTelemetry {
    return {
      invocations: this.invocationCount,
      deprecatedPathsRouted: Array.from(this.routedPaths),
    };
  }
}
