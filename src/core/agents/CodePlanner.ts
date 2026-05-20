export type CodingIntent =
  | 'code_question'
  | 'debug_error'
  | 'write_feature'
  | 'modify_existing_code'
  | 'review_diff'
  | 'explain_code'
  | 'generate_tests'
  | 'refactor'
  | 'security_review'
  | 'performance_review'
  | 'dependency_help';

export interface CodePlan {
  intent: CodingIntent;
  steps: string[];
  requiredEvidence: string[];
}

export class CodePlanner {
  classifyIntent(message: string): CodingIntent {
    const lower = message.toLowerCase();
    if (lower.includes('review') || lower.includes('diff')) return 'review_diff';
    if (lower.includes('stack trace') || lower.includes('error') || lower.includes('failing') || lower.includes('bug')) return 'debug_error';
    if (lower.includes('test') || lower.includes('coverage') || lower.includes('spec')) return 'generate_tests';
    if (lower.includes('refactor')) return 'refactor';
    if (lower.includes('security') || lower.includes('vulnerab')) return 'security_review';
    if (lower.includes('performance') || lower.includes('slow')) return 'performance_review';
    if (lower.includes('dependency') || lower.includes('package')) return 'dependency_help';
    if (lower.includes('add') || lower.includes('implement') || lower.includes('create')) return 'write_feature';
    if (lower.includes('change') || lower.includes('modify') || lower.includes('fix')) return 'modify_existing_code';
    if (lower.includes('explain') || lower.includes('how') || lower.includes('where')) return 'explain_code';
    return 'code_question';
  }

  createPlan(message: string): CodePlan {
    const intent = this.classifyIntent(message);
    const common = ['Inspect likely files before answering', 'Gather package scripts and current git diff'];

    const workflows: Record<CodingIntent, string[]> = {
      code_question: [...common, 'Answer with file references and evidence'],
      debug_error: [...common, 'Search exact error text', 'Propose the smallest fix', 'Run targeted verification when possible'],
      write_feature: [...common, 'Find affected modules and tests', 'Generate a patch-first response', 'Run type-check, lint, and tests'],
      modify_existing_code: [...common, 'Read affected implementation and tests', 'Generate a minimal patch', 'Verify the change'],
      review_diff: ['Review the diff for correctness, security, tests, and regressions', 'Return findings before summary'],
      explain_code: [...common, 'Explain the implementation path with concrete files'],
      generate_tests: [...common, 'Find target behavior', 'Add focused tests', 'Run targeted tests'],
      refactor: [...common, 'Preserve behavior', 'Run tests that cover touched modules'],
      security_review: [...common, 'Look for unsafe execution, auth, injection, and secret handling'],
      performance_review: [...common, 'Find hot paths and avoid speculative changes'],
      dependency_help: [...common, 'Inspect package scripts and dependency usage']
    };

    return {
      intent,
      steps: workflows[intent],
      requiredEvidence: ['relevant source files', 'related tests', 'package scripts', 'git diff']
    };
  }
}
