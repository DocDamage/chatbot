import fs from 'fs';
import path from 'path';
import { z } from 'zod/v3';
import { singleFileArgument } from './KnowledgeBundleOperations';

const comparisonSchema = z.object({
  requestId: z.string().min(1),
  timestamp: z.string().datetime(),
  legacyLatencyMs: z.number().finite().nonnegative(),
  shadowLatencyMs: z.number().finite().nonnegative(),
  divergences: z.array(z.string()),
});

export function shadowReport(args: string[]): unknown {
  const file = singleFileArgument(
    args.length
      ? args
      : ['--input', process.env.CHAT_SHADOW_REPORT_PATH || path.join('data', 'chat-shadow.jsonl')],
    '--input'
  );
  const comparisons = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => comparisonSchema.parse(JSON.parse(line)));
  if (!comparisons.length)
    throw new Error('No recorded shadow comparisons; runtime parity has not been evaluated.');
  const divergent = comparisons.filter((c) => c.divergences.length > 0).length;
  return {
    scope: 'recorded shadow comparisons',
    input: file,
    comparisons: comparisons.length,
    divergent,
    parityRate: (comparisons.length - divergent) / comparisons.length,
    meanLegacyLatencyMs:
      comparisons.reduce((sum, c) => sum + c.legacyLatencyMs, 0) / comparisons.length,
    meanShadowLatencyMs:
      comparisons.reduce((sum, c) => sum + c.shadowLatencyMs, 0) / comparisons.length,
    divergences: comparisons.flatMap((c) =>
      c.divergences.map((reason) => ({ requestId: c.requestId, reason }))
    ),
  };
}
