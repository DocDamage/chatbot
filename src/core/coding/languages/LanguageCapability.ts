export interface CommandCapability {
  executable: string;
  args: string[];
  purpose: 'format' | 'lint' | 'typecheck' | 'test' | 'build' | 'dependency';
  approval: 'read_only' | 'debug' | 'write';
  requiresFiles?: string[];
}

export interface LanguageDetectionEvidence {
  language: string;
  confidence: number;
  reasons: string[];
  files: string[];
}

export interface LanguageCapability {
  id: string;
  aliases: string[];
  extensions: string[];
  commonFilenames: string[];
  generatedFilePatterns: RegExp[];
  manifestFiles: string[];
  buildSystems: string[];
  commands: CommandCapability[];
  frameworkMarkers?: string[];
  documentationSources?: string[];
  detectFrameworks?: (files: string[], manifests: Record<string, unknown>) => string[];
}

export interface LanguageDetectionResult {
  languages: LanguageDetectionEvidence[];
  frameworks: string[];
  conflicts: string[];
}
