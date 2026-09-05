/**
 * Unit Tests for ChatRuntimeShadowRunner (CRK-P01-T06)
 *
 * Verifies non-mutating shadow execution, divergence detection, and primary response integrity.
 */

import { ChatRuntimeShadowRunner, ShadowComparisonResult } from './ChatRuntimeShadowRunner';
import { ChatRuntimeFactory } from './ChatRuntimeFactory';
import { ChatRequestDto } from '../../types/chat';
import { ChatResponse } from '../orchestrator/Orchestrator';

describe('ChatRuntimeShadowRunner (CRK-P01-T06)', () => {
  const sampleRequest: ChatRequestDto = {
    message: 'What is photosynthesis?',
    sessionId: 'sess-shadow-001',
    mode: 'science',
  };

  const mockPrimaryResponse: ChatResponse = {
    response: 'Photosynthesis is the process by which plants convert light to chemical energy.',
    artifactId: 'art-123',
    contractVersion: '1.0.0',
    latency: 110,
    model: 'gpt-4o-legacy',
  };

  it('returns primary response unchanged when shadow mode is disabled', async () => {
    const shadowRuntime = ChatRuntimeFactory.create();
    let comparisonEmitted = false;

    const res = await ChatRuntimeShadowRunner.executeWithShadow(
      async () => mockPrimaryResponse,
      shadowRuntime,
      sampleRequest,
      {
        isShadowEnabled: false,
        onComparison: () => { comparisonEmitted = true; },
      }
    );

    expect(res).toBe(mockPrimaryResponse);
    expect(comparisonEmitted).toBe(false);
  });

  it('runs shadow evaluation without mutating primary response and emits comparison', async () => {
    const shadowRuntime = ChatRuntimeFactory.create({
      fallbackModel: 'gpt-4o',
    });

    let emittedComparison: ShadowComparisonResult | undefined;

    const res = await ChatRuntimeShadowRunner.executeWithShadow(
      async () => mockPrimaryResponse,
      shadowRuntime,
      sampleRequest,
      {
        isShadowEnabled: true,
        onComparison: (c) => { emittedComparison = c; },
      }
    );

    expect(res).toBe(mockPrimaryResponse);
    expect(emittedComparison).toBeDefined();
    expect(emittedComparison?.legacyModel).toBe('gpt-4o-legacy');
    expect(emittedComparison?.shadowModel).toBe('gpt-4o');
    expect(emittedComparison?.divergences.length).toBeGreaterThan(0);
    expect(emittedComparison?.divergences[0]).toContain("Model route divergence");
  });

  it('never throws or interrupts primary response even if shadow execution fails', async () => {
    const failingShadowRuntime = {
      execute: jest.fn().mockRejectedValue(new Error('Shadow provider exploded')),
    } as any;

    const res = await ChatRuntimeShadowRunner.executeWithShadow(
      async () => mockPrimaryResponse,
      failingShadowRuntime,
      sampleRequest,
      { isShadowEnabled: true }
    );

    expect(res).toBe(mockPrimaryResponse);
  });
});
