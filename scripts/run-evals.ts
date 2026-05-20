import fs from 'fs';
import path from 'path';
import { EvalCase, EvalHarness } from '../src/core/evaluation/EvalHarness';

const suite = process.argv[2] || 'all';
const targetUrl = process.env.EVAL_TARGET_URL || 'http://localhost:3001';

const suiteFiles: Record<string, string[]> = {
  rag: ['rag_eval_cases.json'],
  safety: ['safety_eval_cases.json'],
  memory: ['memory_eval_cases.json'],
  regression: ['regression_eval_cases.json'],
  all: [
    'rag_eval_cases.json',
    'safety_eval_cases.json',
    'memory_eval_cases.json',
    'regression_eval_cases.json'
  ]
};

async function answerCase(testCase: EvalCase) {
  await seedExpectedSources(testCase);

  const start = Date.now();
  const response = await fetch(`${targetUrl}/api/rag/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: testCase.query,
      generateResponse: testCase.answer_type !== 'grounded'
    })
  });

  if (!response.ok) {
    throw new Error(`Eval request failed: ${response.status} ${response.statusText}`);
  }

  const data: any = await response.json();
  const sources = (data.retrievedChunks || [])
    .map((chunk: any) => chunk.metadata?.source)
    .filter(Boolean);

  return {
    answer: data.response || data.compressedContext || '',
    sources,
    latencyMs: Date.now() - start,
    cost: data.metadata?.cost || 0,
    refused: /cannot|can't|unable|won't|don't have/i.test(data.response || '')
  };
}

async function seedExpectedSources(testCase: EvalCase): Promise<void> {
  for (const source of testCase.expected_sources || []) {
    const fullPath = path.join(process.cwd(), source);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      continue;
    }

    const text = fs.readFileSync(fullPath, 'utf-8');
    await fetch(`${targetUrl}/api/knowledge-base/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        metadata: {
          source,
          title: path.basename(source),
          authority: 'canonical',
          project: 'chatbot',
          visibility: 'private',
          trustScore: 1
        }
      })
    });
  }
}

async function main() {
  const files = suiteFiles[suite];
  if (!files) {
    throw new Error(`Unknown eval suite "${suite}". Use one of: ${Object.keys(suiteFiles).join(', ')}`);
  }

  const cases = files.flatMap(file => {
    const fullPath = path.join(process.cwd(), 'evals', file);
    return JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as EvalCase[];
  });

  const harness = new EvalHarness(answerCase);
  const report = await harness.runCases(cases);
  console.log(JSON.stringify(report, null, 2));

  if (report.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
