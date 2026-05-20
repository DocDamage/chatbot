import { CommandRunner, CommandRunResult } from '../tools/CommandRunner';

export interface VerificationSummary {
  status: 'passed' | 'failed' | 'not_run';
  commandsRun: string[];
  results: CommandRunResult[];
  remainingRisks: string[];
}

export class VerificationRunner {
  constructor(private readonly commandRunner: Pick<CommandRunner, 'run'> = new CommandRunner()) {}

  async runTypeCheck(): Promise<VerificationSummary> {
    return this.runCommands(['npm run type-check']);
  }

  async runLint(): Promise<VerificationSummary> {
    return this.runCommands(['npm run lint']);
  }

  async runUnitTests(): Promise<VerificationSummary> {
    return this.runCommands(['npm test -- --runInBand']);
  }

  async runBuild(): Promise<VerificationSummary> {
    return this.runCommands(['npm run build']);
  }

  async runTargetedTests(command: string): Promise<VerificationSummary> {
    return this.runCommands([command]);
  }

  async runStandardSuite(): Promise<VerificationSummary> {
    return this.runCommands([
      'npm run type-check',
      'npm run lint',
      'npm test -- --runInBand'
    ]);
  }

  async runCommands(commands: string[]): Promise<VerificationSummary> {
    if (commands.length === 0) {
      return {
        status: 'not_run',
        commandsRun: [],
        results: [],
        remainingRisks: ['No verification commands requested']
      };
    }

    const results: CommandRunResult[] = [];
    for (const command of commands) {
      const result = await this.commandRunner.run(command);
      results.push(result);
      if (!result.success) {
        break;
      }
    }

    const failed = results.some(result => !result.success);
    return {
      status: failed ? 'failed' : 'passed',
      commandsRun: commands,
      results,
      remainingRisks: failed ? ['At least one verification command failed'] : []
    };
  }
}
