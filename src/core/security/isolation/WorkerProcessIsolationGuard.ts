import * as path from 'path';

export interface ProcessExecutionSpec {
  binaryPath: string;
  args: string[];
  workingDirectory: string;
  allowedWorkingDirectoryRoot: string;
  environmentVariables: Record<string, string>;
  timeoutMs: number;
  maxOutputBytes: number;
}

export interface ProcessIsolationResult {
  isAllowed: boolean;
  sanitizedArgs: string[];
  sanitizedEnv: Record<string, string>;
  rejectionReason?: string;
}

export class WorkerProcessIsolationGuard {
  private static readonly ALLOWLISTED_BINARY_NAMES = [
    'ffmpeg',
    'ffmpeg.exe',
    'ffprobe',
    'ffprobe.exe',
    'godot',
    'godot.exe',
    'aseprite',
    'aseprite.exe',
    'python',
    'python.exe',
    'node',
    'node.exe'
  ];

  private static readonly DANGEROUS_ARG_CHARACTERS = /[;&|`$><]/;
  private static readonly FORBIDDEN_ENV_KEYS = [
    /TOKEN/i,
    /SECRET/i,
    /API_KEY/i,
    /PASSWORD/i,
    /AWS_/i,
    /AZURE_/i,
    /GCP_/i,
    /OPENAI_/i,
    /ANTHROPIC_/i
  ];

  public static validateExecution(spec: ProcessExecutionSpec): ProcessIsolationResult {
    const cleanBinaryPath = spec.binaryPath.replace(/\\/g, '/');
    const binaryBaseName = path.posix.basename(cleanBinaryPath).toLowerCase();

    // 1. Check binary name allowlist
    if (!this.ALLOWLISTED_BINARY_NAMES.includes(binaryBaseName)) {
      return {
        isAllowed: false,
        sanitizedArgs: [],
        sanitizedEnv: {},
        rejectionReason: `Binary ${binaryBaseName} is not in the approved worker execution allowlist.`
      };
    }

    // 2. Check working directory confinement (platform-safe boundary check)
    const normalizedWorkDir = path.resolve(spec.workingDirectory);
    const normalizedRoot = path.resolve(spec.allowedWorkingDirectoryRoot);
    const relative = path.relative(normalizedRoot, normalizedWorkDir);
    const isEscaping = relative.startsWith('..') || path.isAbsolute(relative);
    if (isEscaping) {
      return {
        isAllowed: false,
        sanitizedArgs: [],
        sanitizedEnv: {},
        rejectionReason: `Working directory ${normalizedWorkDir} escapes allowed root ${normalizedRoot}.`
      };
    }

    // 3. Check arguments for shell injection / operators
    for (const arg of spec.args) {
      if (this.DANGEROUS_ARG_CHARACTERS.test(arg)) {
        return {
          isAllowed: false,
          sanitizedArgs: [],
          sanitizedEnv: {},
          rejectionReason: `Argument "${arg}" contains dangerous shell metacharacters.`
        };
      }
    }

    // 4. Scrub environment variables (strip secrets)
    const sanitizedEnv: Record<string, string> = {};
    for (const [key, val] of Object.entries(spec.environmentVariables)) {
      let isSecret = false;
      for (const pattern of this.FORBIDDEN_ENV_KEYS) {
        if (pattern.test(key)) {
          isSecret = true;
          break;
        }
      }
      if (!isSecret) {
        sanitizedEnv[key] = val;
      }
    }

    return {
      isAllowed: true,
      sanitizedArgs: [...spec.args],
      sanitizedEnv
    };
  }
}
