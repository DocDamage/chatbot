export interface NormalizedInput {
  original: string;
  normalized: string;
  aliasesDetected: string[];
}

const aliasReplacements: Array<{ pattern: RegExp; replacement: string; alias: string }> = [
  { pattern: /\bflstuduo\b/gi, replacement: 'fl studio', alias: 'flstuduo' },
  { pattern: /\bfruity loops\b/gi, replacement: 'fl studio', alias: 'fruity loops' },
  { pattern: /\bflp\b/gi, replacement: 'fl studio project', alias: 'flp' },
  { pattern: /\bprotool\b/gi, replacement: 'pro tools', alias: 'protool' },
  { pattern: /\bprotools\b/gi, replacement: 'pro tools', alias: 'protools' },
  { pattern: /\bpt\b/gi, replacement: 'pro tools', alias: 'pt' },
  { pattern: /\blogicc\b/gi, replacement: 'logic pro', alias: 'logicc' },
  { pattern: /\blogic pro x\b/gi, replacement: 'logic pro', alias: 'logic pro x' },
  { pattern: /\blogic x\b/gi, replacement: 'logic pro', alias: 'logic x' },
  { pattern: /\bmastr\b/gi, replacement: 'master', alias: 'mastr' },
  { pattern: /\bpromptt\b/gi, replacement: 'prompt', alias: 'promptt' },
  { pattern: /\beattin\b/gi, replacement: 'eating', alias: 'eattin' },
  { pattern: /\baint\b/gi, replacement: 'ain’t', alias: 'aint' },
  { pattern: /\blil\b/gi, replacement: 'little', alias: 'lil' },
  { pattern: /\bfr\b/gi, replacement: 'for real', alias: 'fr' }
];

export class SlangNormalizer {
  normalize(message: string): NormalizedInput {
    let normalized = message;
    const aliasesDetected: string[] = [];

    for (const alias of aliasReplacements) {
      if (alias.pattern.test(normalized)) {
        aliasesDetected.push(alias.alias);
        normalized = normalized.replace(alias.pattern, alias.replacement);
      }
    }

    normalized = normalized
      .replace(/[“”]/g, '"')
      .replace(/[’]/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    return {
      original: message,
      normalized,
      aliasesDetected
    };
  }
}
