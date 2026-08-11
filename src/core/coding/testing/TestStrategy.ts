import { CodingIntent } from '../types';

export interface TestStrategy { framework?: string; commands: string[]; cases: string[]; rationale: string[]; }

export class TestStrategyPlanner {
  plan(input: { intent: CodingIntent; languages: string[]; files: string[]; existingTests: string[]; acceptanceCriteria: string[] }): TestStrategy {
    const languages = new Set(input.languages.map(language => language.toLowerCase()));
    const framework = languages.has('typescript') || languages.has('javascript') ? 'project-test-runner' : languages.has('python') ? 'pytest-or-unittest' : languages.has('go') ? 'go-test' : languages.has('rust') ? 'cargo-test' : undefined;
    const commands = framework === 'go-test' ? ['go test ./...'] : framework === 'cargo-test' ? ['cargo test'] : framework === 'pytest-or-unittest' ? ['pytest'] : input.existingTests.length ? ['project test command from manifest'] : [];
    const cases = ['happy path behavior', 'boundary and empty input', 'expected error handling'];
    if (input.intent === 'debug_error') cases.push('original failure reproduction');
    if (input.intent === 'security_review') cases.push('malicious and authorization-bypass input');
    if (input.intent === 'performance_review') cases.push('large input and resource boundary');
    return { framework, commands, cases, rationale: ['Map each acceptance criterion to observable behavior', 'Preserve existing test conventions', 'Add regression coverage for the reported failure or risk'] };
  }
}
