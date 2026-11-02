import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function verificationOptions(
  args,
  { platform = process.platform, home = os.homedir() } = {}
) {
  const options = {
    base: 'http://127.0.0.1:3001',
    output: path.resolve('temp/rea-live-verification.json'),
    native: false,
  };
  const fields = { '--base-url': 'base', '--output': 'output', '--managed-fixture': 'managed' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--native') {
      options.native = true;
      continue;
    }
    if (!fields[args[i]] || !args[i + 1] || args[i + 1].startsWith('--'))
      throw new Error(`Unknown or incomplete verification option: ${args[i]}`);
    options[fields[args[i]]] = args[++i];
  }
  const url = new URL(options.base);
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('REA verification requires an HTTP loopback application origin.');
  options.base = url.origin;
  options.output = path.resolve(options.output);
  if (options.managed && !fs.statSync(options.managed).isFile())
    throw new Error('Managed fixture must be a local file.');
  if (!options.managed && platform === 'win32') {
    options.managed = [
      'C:/Program Files/PowerShell/7/System.Management.Automation.dll',
      path.join(
        home,
        '.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/System.Management.Automation.dll'
      ),
      'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/mscorlib.dll',
    ].find((file) => fs.existsSync(file));
    if (!options.managed)
      throw new Error(
        'Pass --managed-fixture <managed DLL> for Windows managed-analysis verification.'
      );
  }
  return options;
}
