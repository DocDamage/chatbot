/**
 * Entrypoint for Canonical Chat Runtime CLI commands.
 */
import { CanonicalCliRegistry } from '../src/core/governance/CanonicalCliRegistry';
import { CanonicalCliCommandName, CanonicalCliCommandNameSchema } from '../src/types/cli-scripts';

async function main() {
  const rawCommand = process.argv[2];
  const args = process.argv.slice(3);

  const parseResult = CanonicalCliCommandNameSchema.safeParse(rawCommand);
  if (!parseResult.success) {
    console.error(`Unknown canonical command: "${rawCommand}".`);
    console.error(`Available commands: ${CanonicalCliCommandNameSchema.options.join(', ')}`);
    process.exit(1);
  }

  const command = parseResult.data as CanonicalCliCommandName;
  const env = (process.env.NODE_ENV as 'development' | 'test' | 'staging' | 'production') || 'development';
  const authenticated = Boolean(process.env.CANONICAL_CLI_AUTH_TOKEN || process.env.CI);

  const registry = new CanonicalCliRegistry();
  const result = await registry.execute(command, {
    environment: env,
    authenticated,
    operatorRole: process.env.OPERATOR_ROLE,
    bypassAuthRequested: args.includes('--bypass-auth'),
    args
  });

  if (result.stdout) {
    console.log(result.stdout);
  }
  if (result.stderr) {
    console.error(result.stderr);
  }
  process.exit(result.exitCode);
}

if (require.main === module) {
  void main();
}
