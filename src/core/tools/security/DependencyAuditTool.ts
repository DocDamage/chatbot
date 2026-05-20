export class DependencyAuditTool {
  run(input: Record<string, any> = {}) {
    const packageManager = String(input.packageManager || 'npm');
    return {
      domain: 'security',
      tool: 'DependencyAuditTool',
      packageManager,
      commands: packageManager === 'npm'
        ? ['npm audit --omit=dev', 'npm outdated', 'npm ls --depth=0']
        : [`${packageManager} audit`, `${packageManager} outdated`],
      reviewSteps: [
        'Prioritize reachable critical/high vulnerabilities first.',
        'Check whether the vulnerable package is production or dev-only.',
        'Prefer upgrades that preserve semver compatibility before forced overrides.',
        'Run tests after every dependency bump.',
        'Document accepted risk for anything not immediately fixed.'
      ],
      policy: 'Do not auto-upgrade blindly; verify runtime compatibility and lockfile changes.'
    };
  }
}
