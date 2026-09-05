export interface MemoryInjectionCheckResult {
  isSafe: boolean;
  sanitizedContent: string;
  flaggedPatternsCount: number;
  detectedWarnings: string[];
}

export class MemoryInjectionDefense {
  private static readonly INJECTION_STRIP_PATTERNS = [
    /<!--\s*#system_instruction:[\s\S]*?-->/gi,
    /\[INST\][\s\S]*?\[\/INST\]/gi,
    /<\|im_start\|>system[\s\S]*?<\|im_end\|>/gi,
    /<system>[\s\S]*?<\/system>/gi,
    /override\s+system\s+prompt\s*:\s*.+/gi,
    /delete\s+all\s+memories\s+and\s+set\s*:\s*.+/gi
  ];

  public static sanitizeContextChunk(rawContent: string): MemoryInjectionCheckResult {
    let sanitizedContent = rawContent;
    let flaggedPatternsCount = 0;
    const detectedWarnings: string[] = [];

    for (const pattern of this.INJECTION_STRIP_PATTERNS) {
      if (pattern.test(sanitizedContent)) {
        flaggedPatternsCount++;
        detectedWarnings.push(`Stripped instruction-tag injection matching ${pattern}`);
        sanitizedContent = sanitizedContent.replace(pattern, '[STRIPPED_UNTRUSTED_INSTRUCTION]');
      }
    }

    return {
      isSafe: flaggedPatternsCount === 0,
      sanitizedContent,
      flaggedPatternsCount,
      detectedWarnings
    };
  }

  public static wrapUntrustedDocument(content: string, documentLabel: string): string {
    const { sanitizedContent } = this.sanitizeContextChunk(content);
    return `<<<UNTRUSTED_DOCUMENT: ${documentLabel}>>>\n${sanitizedContent}\n<<<END_UNTRUSTED_DOCUMENT>>>`;
  }
}
