/**
 * Unit Tests for ChatRuntimeShadowRunner (CRK-P01-T06)
 *
 * Verifies non-mutating shadow execution, divergence detection, and primary response integrity.
 */

import { ChatRuntimeShadowRunner, ShadowComparisonResult } from './ChatRuntimeShadowRunner';
import { ChatRuntimeFactory } from './ChatRuntimeFactory';
import { ChatRequestDto } from '../../types/chat';
import { ChatResponse } from '../orchestrator/Orchestrator';
import fs from 'fs';
import os from 'os';
import path from 'path';

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
      llmAdapter: { generate: async () => ({ content: 'A shadow provider answer.' }) },
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
  it('persists report evidence without prompt or generated answer text', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-evidence-'));
    const previous = process.env.CHAT_SHADOW_REPORT_PATH;
    process.env.CHAT_SHADOW_REPORT_PATH = path.join(root, 'comparisons.jsonl');
    try {
      const runtime = ChatRuntimeFactory.create({ llmAdapter: { generate: async () => ({ content: 'Private shadow answer' }) } });
      const response = await ChatRuntimeShadowRunner.executeWithShadow(async () => mockPrimaryResponse, runtime, sampleRequest, { isShadowEnabled: true });
      expect(response).toBe(mockPrimaryResponse);
      const evidence = fs.readFileSync(process.env.CHAT_SHADOW_REPORT_PATH, 'utf8');
      expect(JSON.parse(evidence)).toMatchObject({ requestId: expect.any(String), divergences: expect.any(Array) });
      expect(evidence).not.toContain('Private shadow answer'); expect(evidence).not.toContain(sampleRequest.message);
    } finally {
      if (previous === undefined) delete process.env.CHAT_SHADOW_REPORT_PATH; else process.env.CHAT_SHADOW_REPORT_PATH = previous;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
