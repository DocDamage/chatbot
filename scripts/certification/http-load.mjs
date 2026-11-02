import { performance } from 'node:perf_hooks';

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const target = argument('url', 'http://127.0.0.1:4301/health/ready');
const durationMs = Number(argument('duration-ms', '15000'));
const concurrency = Number(argument('concurrency', '20'));
const p95LimitMs = Number(argument('p95-limit-ms', '500'));

if (!URL.canParse(target) || durationMs < 100 || concurrency < 1 || p95LimitMs < 1) {
  throw new Error('Invalid load-test arguments.');
}

const latencies = [];
const statuses = new Map();
let failures = 0;
const began = performance.now();
const deadline = began + durationMs;

async function worker() {
  while (performance.now() < deadline) {
    const started = performance.now();
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(5_000) });
      await response.arrayBuffer();
      latencies.push(performance.now() - started);
      statuses.set(response.status, (statuses.get(response.status) || 0) + 1);
      if (!response.ok) failures += 1;
    } catch {
      latencies.push(performance.now() - started);
      failures += 1;
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
latencies.sort((left, right) => left - right);
const elapsedMs = performance.now() - began;
const percentile = value => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))] || 0;
const report = {
  target,
  durationMs: Math.round(elapsedMs),
  concurrency,
  requests: latencies.length,
  failures,
  requestsPerSecond: Number((latencies.length / (elapsedMs / 1000)).toFixed(2)),
  latencyMs: {
    p50: Number(percentile(0.5).toFixed(2)),
    p95: Number(percentile(0.95).toFixed(2)),
    p99: Number(percentile(0.99).toFixed(2)),
    max: Number((latencies.at(-1) || 0).toFixed(2))
  },
  statuses: Object.fromEntries([...statuses.entries()].sort(([left], [right]) => left - right)),
  slo: { zeroFailures: failures === 0, p95LimitMs, p95Passed: percentile(0.95) <= p95LimitMs }
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failures > 0 || report.latencyMs.p95 > p95LimitMs) process.exitCode = 1;
