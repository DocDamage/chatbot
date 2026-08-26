import { DeviceAdapter, getDeviceAdapter } from '../DeviceAdapter';
import * as os from 'os';

describe('RT-DEV-001: DeviceAdapter Hardware Profiling & Recommendations Suite', () => {
  let adapter: DeviceAdapter;

  beforeEach(() => {
    adapter = new DeviceAdapter();
  });

  afterEach(() => {
    adapter.stopMemoryMonitoring();
  });

  it('profiles system specs and returns structured device information', () => {
    const info = adapter.getDeviceInfo();

    expect(info.platform).toBe(os.platform());
    expect(info.cpuCores).toBeGreaterThan(0);
    expect(info.totalMemory).toBeGreaterThan(0);
    expect(['low', 'medium', 'high', 'ultra']).toContain(info.deviceClass);
  });

  it('detects GPU availability from environment flags', () => {
    process.env.GPU_AVAILABLE = 'true';
    process.env.GPU_MEMORY_MB = '8192';

    const info = adapter.getDeviceInfo();
    expect(info.gpuAvailable).toBe(true);
    expect(info.gpuMemory).toBe(8192 * 1024 * 1024);

    delete process.env.GPU_AVAILABLE;
    delete process.env.GPU_MEMORY_MB;
  });

  it('classifies device tiers and produces appropriate model recommendations', () => {
    const recommendation = adapter.getModelRecommendation();

    expect(['4bit', '8bit', '16bit', 'full']).toContain(recommendation.quantization);
    expect(recommendation.maxContextLength).toBeGreaterThan(0);
    expect(recommendation.maxBatchSize).toBeGreaterThan(0);
    expect(recommendation.suggestedModels.length).toBeGreaterThan(0);

    // Test device classifications directly
    expect((adapter as any).classifyDevice(34 * 1024 ** 3, 16)).toBe('ultra');
    expect((adapter as any).classifyDevice(18 * 1024 ** 3, 8)).toBe('high');
    expect((adapter as any).classifyDevice(10 * 1024 ** 3, 4)).toBe('medium');
    expect((adapter as any).classifyDevice(4 * 1024 ** 3, 2)).toBe('low');
  });

  it('inspects heap, RSS, and system memory status', () => {
    const memStatus = adapter.getMemoryStatus();

    expect(memStatus.heapUsed).toBeGreaterThan(0);
    expect(memStatus.heapTotal).toBeGreaterThan(0);
    expect(memStatus.rss).toBeGreaterThan(0);
    expect(['healthy', 'warning', 'critical']).toContain(memStatus.status);
  });

  it('calculates optimal batch size, safety thresholds, and context limits', () => {
    const batchSize = adapter.getOptimalBatchSize(1024 * 1024);
    expect(batchSize).toBeGreaterThanOrEqual(1);
    expect(batchSize).toBeLessThanOrEqual(100);

    expect(adapter.isSafeForOperation(1024)).toBe(true);
    expect(adapter.isSafeForOperation(1024 * 1024 * 1024 * 1024)).toBe(false);

    const limit = adapter.getContextLengthLimit();
    expect(limit).toBeGreaterThan(0);
  });

  it('handles fallback chains, byte formatting, and summary string', () => {
    expect(adapter.getFallbackChain('gpt-4')).toContain('gpt-3.5-turbo');
    expect(adapter.getFallbackChain('claude-3-opus')).toContain('claude-3-haiku');
    expect(adapter.getFallbackChain('llama-70b')).toContain('tinyllama');
    expect(adapter.getFallbackChain('mistral-large')).toContain('mistral-7b');
    expect(adapter.getFallbackChain('unknown-model').length).toBeGreaterThan(0);

    expect(adapter.formatBytes(500)).toBe('500.00 B');
    expect(adapter.formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(adapter.formatBytes(1024 * 1024 * 1024 * 2)).toBe('2.00 GB');

    const summary = adapter.getSummary();
    expect(summary).toContain(os.platform());
    expect(summary).toContain('cores');
  });

  it('requests GC safely and provides singleton accessor', async () => {
    await expect(adapter.requestGC()).resolves.toBeUndefined();

    const singleton = getDeviceAdapter();
    expect(singleton).toBeInstanceOf(DeviceAdapter);
    expect(getDeviceAdapter()).toBe(singleton);
  });

  it('supports memory monitoring interval and callback triggers', () => {
    jest.useFakeTimers();
    const onWarning = jest.fn();

    adapter.startMemoryMonitoring(1000, onWarning);
    expect((adapter as any).memoryCheckInterval).toBeDefined();

    jest.advanceTimersByTime(2500);
    adapter.stopMemoryMonitoring();
    expect((adapter as any).memoryCheckInterval).toBeNull();
    jest.useRealTimers();
  });
});
