import { spawnSync } from 'child_process';
import path from 'path';

export class LeanProofTool {
  verify(proofText: string) {
    const lean = spawnSync(this.command(), ['--version'], {
      encoding: 'utf8',
      shell: false,
      env: this.envWithLeanPath()
    });
    if (lean.error || lean.status !== 0) {
      return {
        success: false,
        verified: false,
        method: 'lean',
        error: 'Lean is not installed locally',
        proofText
      };
    }
    return {
      success: false,
      verified: false,
      method: 'lean',
      error: 'Lean executable found, but proof-file execution is not configured yet',
      proofText
    };
  }

  private command(): string {
    if (process.platform !== 'win32') return 'lean';
    return path.join(process.env.USERPROFILE || '', '.elan', 'bin', 'lean.exe');
  }

  private envWithLeanPath() {
    const elanBin = process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.elan', 'bin') : '';
    return {
      ...process.env,
      PATH: elanBin ? `${elanBin}${path.delimiter}${process.env.PATH || ''}` : process.env.PATH
    };
  }
}
