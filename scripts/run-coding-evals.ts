import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { CodingBenchmarkRunner } from '../src/core/evaluation/CodingBenchmarkRunner';
import { GeminiAdapter, OpenAIAdapter, OpenAICompatibleAdapter } from '../src/core/providers/LLMAdapter';

const mode = process.argv.includes('--upgraded') ? 'upgraded' : 'baseline';
const root = path.resolve(process.cwd(), 'evals/coding/fixtures');

async function main(): Promise<void> {
  const liveModel = process.argv.includes('--live-model');
  const provider = process.env.CODING_EVAL_PROVIDER || 'openai';
  const providerConfig = {
    openai: { key: process.env.OPENAI_API_KEY, envVar: 'OPENAI_API_KEY', model: process.env.OPENAI_MODEL },
    gemini: { key: process.env.GEMINI_API_KEY, envVar: 'GEMINI_API_KEY', model: process.env.GEMINI_MODEL },
    deepseek: { key: process.env.DEEPSEEK_API_KEY, envVar: 'DEEPSEEK_API_KEY', model: process.env.DEEPSEEK_MODEL }
  }[provider as 'openai' | 'gemini' | 'deepseek'];
  if (!providerConfig) throw new Error(`Unsupported coding evaluation provider: ${provider}`);
  const providerKey = providerConfig.key;
  if (liveModel && !providerKey) throw new Error(`--live-model requires ${providerConfig.envVar}; no provider call was made`);
  const model = process.env.CODING_EVAL_MODEL || providerConfig.model;
  const modelAdapter = liveModel
    ? provider === 'gemini'
      ? new GeminiAdapter(providerKey as string, model || 'gemini-3.6-flash')
      : provider === 'deepseek'
        ? new OpenAICompatibleAdapter('deepseek', providerKey as string, 'https://api.deepseek.com/v1', model || 'deepseek-chat')
        : new OpenAIAdapter(providerKey as string, model)
    : undefined;
  const runner = new CodingBenchmarkRunner(root, modelAdapter ? { modelAdapter, model } : {});
  const report = await runner.run(runner.loadManifest(), mode);
  const outputRoot = path.resolve(process.cwd(), 'docs/implementation/evidence/coding-upgrade', mode);
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(path.join(outputRoot, 'environment.json'), JSON.stringify({
    generatedAt: report.generatedAt,
    implementationSha: safeGitSha(),
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    provider: liveModel ? provider : 'none',
    model: process.env.CODING_EVAL_MODEL || providerConfig.model || (liveModel && provider === 'gemini' ? 'gemini-3.6-flash' : liveModel && provider === 'deepseek' ? 'deepseek-chat' : null),
    networkPolicy: process.argv.includes('--live-model') ? 'explicit-live-model-only' : 'disabled'
  }, null, 2));
  fs.writeFileSync(path.join(outputRoot, 'manifest.json'), JSON.stringify({ suite: report.suite, mode: report.mode, generatedAt: report.generatedAt, fixtureRoot: root, cases: report.cases.map(testCase => ({ id: testCase.id, fixture: testCase.fixture, fixtureHash: testCase.fixtureHash, toolchain: testCase.toolchain, toolchainAvailable: testCase.toolchainAvailable, status: testCase.status, reason: testCase.reason })) }, null, 2));
  fs.writeFileSync(path.join(outputRoot, 'report.json'), JSON.stringify(report, null, 2));
  const sourceManifest = runner.loadManifest();
  for (const result of report.cases) {
    const testCase = sourceManifest.cases.find(candidate => candidate.id === result.id);
    if (!testCase) continue;
    const caseRoot = path.join(outputRoot, 'cases', result.id);
    fs.mkdirSync(caseRoot, { recursive: true });
    fs.writeFileSync(path.join(caseRoot, 'request.json'), JSON.stringify({ id: testCase.id, prompt: testCase.prompt, expectedFiles: testCase.expectedFiles, hiddenChecks: testCase.hiddenChecks, hiddenTests: testCase.hiddenTests || [] }, null, 2));
    fs.writeFileSync(path.join(caseRoot, 'response.json'), JSON.stringify({ mode, status: result.status, reason: result.reason, executor: result.execution?.executor || (result.inspection ? 'repository-controller-inspection' : 'toolchain-preflight-only'), execution: result.execution, inspection: result.inspection, score: result.score }, null, 2));
    fs.writeFileSync(path.join(caseRoot, 'diff.patch'), '');
    fs.writeFileSync(path.join(caseRoot, 'commands.json'), JSON.stringify(result.checks || [], null, 2));
    fs.writeFileSync(path.join(caseRoot, 'diagnostics.json'), JSON.stringify({ parsed: false, reason: 'No generated patch was executed by the preflight runner' }, null, 2));
  }
  writeComparison(outputRoot);
  console.log(JSON.stringify(report, null, 2));
}

function writeComparison(outputRoot: string): void {
  const baselinePath = path.join(path.dirname(outputRoot), 'baseline', 'report.json');
  const upgradedPath = path.join(path.dirname(outputRoot), 'upgraded', 'report.json');
  if (!fs.existsSync(baselinePath) || !fs.existsSync(upgradedPath)) return;
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as { cases: Array<any> };
  const upgraded = JSON.parse(fs.readFileSync(upgradedPath, 'utf8')) as { cases: Array<any> };
  const baselineById = new Map(baseline.cases.map(item => [item.id, item]));
  const upgradedById = new Map(upgraded.cases.map(item => [item.id, item]));
  const ids = [...new Set([...baselineById.keys(), ...upgradedById.keys()])];
  const score = (value: any, metric: string): string => value?.metrics?.[metric] === undefined ? 'n/a' : String(value.metrics[metric]);
  const scorePair = (before: any, after: any, metric: string): string => `${score(before?.score, metric)}→${score(after?.score, metric)}`;
  const status = (item: any): string => item?.status === 'unsupported' ? 'unsupported' : (item?.checks || []).some((check: any) => check.status === 'unsupported') ? 'ready / command unsupported' : (item?.checks || []).some((check: any) => check.status === 'failed') ? 'ready / check failed' : 'ready / check passed';
  const lines = [
    '# Polyglot coding benchmark comparison',
    '',
    `Generated from the executed baseline and upgraded reports. Implementation SHA: \`${safeGitSha()}\`.`,
    '',
    'This is an evidence report: ordinary runs perform toolchain preflight and upgraded repository inspection; an explicit --live-model run can invoke the configured provider and apply its structured patch only in an isolated worktree. Unsupported toolchains remain explicit and are not counted as passes.',
    '',
    '| Case | Baseline | Upgraded | Build/test | Regression | Retrieval | Minimality | API accuracy | Root cause | Security | Review | Honesty | Fixture hash |',
    '|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|'
  ];
  for (const id of ids) {
    const before = baselineById.get(id);
    const after = upgradedById.get(id);
    lines.push(`| ${id} | ${status(before)} | ${status(after)} | ${scorePair(before, after, 'buildTest')} | ${scorePair(before, after, 'regression')} | ${scorePair(before, after, 'retrieval')} | ${scorePair(before, after, 'minimality')} | ${scorePair(before, after, 'apiAccuracy')} | ${scorePair(before, after, 'rootCauseAccuracy')} | ${scorePair(before, after, 'security')} | ${scorePair(before, after, 'reviewQuality')} | ${scorePair(before, after, 'verificationHonesty')} | \`${after?.fixtureHash || before?.fixtureHash || 'missing'}\` |`);
  }
  lines.push('', 'Raw reports: [baseline/report.json](baseline/report.json) and [upgraded/report.json](upgraded/report.json).');
  fs.writeFileSync(path.join(path.dirname(outputRoot), 'comparison.md'), `${lines.join('\n')}\n`);
}

function safeGitSha(): string {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); }
  catch { return 'unavailable'; }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
