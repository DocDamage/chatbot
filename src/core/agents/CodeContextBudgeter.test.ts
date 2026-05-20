import { CodeContextBudgeter } from './CodeContextBudgeter';

describe('CodeContextBudgeter', () => {
  it('orders coding context by usefulness and respects the token budget', () => {
    const budgeter = new CodeContextBudgeter(60);

    const result = budgeter.build({
      userRequest: 'Fix the route bug',
      fileExcerpts: [{ path: 'src/route.ts', content: 'route implementation '.repeat(20) }],
      relatedTests: [{ path: 'src/route.test.ts', content: 'route test' }],
      typeDefinitions: [{ path: 'src/types.ts', content: 'type Route = string' }],
      packageScripts: { test: 'jest' },
      architectureNotes: ['Express route mounting'],
      pastFixes: ['Mounted missing router'],
      generalKnowledge: ['Prefer focused route tests']
    });

    expect(result.items.map(item => item.kind)).toEqual([
      'user_request',
      'source_file',
      'related_test',
      'type_definition',
      'package_script',
      'architecture_note',
      'past_fix',
      'general_knowledge'
    ]);
    expect(result.estimatedTokens).toBeLessThanOrEqual(60);
  });
});
