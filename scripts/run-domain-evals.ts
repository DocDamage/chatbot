import fs from 'fs';
import path from 'path';

type Domain = 'math' | 'market' | 'gamedev' | 'sixsigma';

interface EvalCase {
  id: string;
  query: string;
  expected_answer?: string;
  must_contain?: string[];
  must_not_contain?: string[];
  requires_tool?: string;
  answer_type?: string;
  must_show_steps?: boolean;
  must_verify?: boolean;
}

const requested = (process.argv[2] || 'all') as Domain | 'all';
const domains: Domain[] = requested === 'all' ? ['math', 'market', 'gamedev', 'sixsigma'] : [requested];

function loadCases(domain: Domain): EvalCase[] {
  const dir = path.join(process.cwd(), 'evals', domain);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.json'))
    .flatMap(file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as EvalCase[]);
}

function scoreCase(testCase: EvalCase): { passed: boolean; reasons: string[] } {
  const haystack = [
    testCase.expected_answer,
    ...(testCase.must_contain || []),
    testCase.requires_tool,
    testCase.answer_type
  ].filter(Boolean).join(' ').toLowerCase();
  const reasons: string[] = [];

  for (const required of testCase.must_contain || []) {
    if (!haystack.includes(required.toLowerCase())) {
      reasons.push(`Missing expected marker "${required}" in eval metadata.`);
    }
  }

  for (const forbidden of testCase.must_not_contain || []) {
    if (haystack.includes(forbidden.toLowerCase())) {
      reasons.push(`Forbidden marker "${forbidden}" appears in eval metadata.`);
    }
  }

  return { passed: reasons.length === 0, reasons };
}

let total = 0;
let passed = 0;

for (const domain of domains) {
  const cases = loadCases(domain);
  for (const testCase of cases) {
    total += 1;
    const result = scoreCase(testCase);
    if (result.passed) {
      passed += 1;
    } else {
      console.error(`[${domain}] ${testCase.id} failed: ${result.reasons.join('; ')}`);
    }
  }
  console.log(`[${domain}] loaded ${cases.length} eval cases`);
}

console.log(`Domain eval metadata: ${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
