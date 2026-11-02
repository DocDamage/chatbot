/**
 * Project Context Planner (CRK-P05-T05)
 *
 * Structurally plans context extraction for coding and repository work,
 * identifying relevant files, manifests, symbols, diagnostics, and test evidence.
 */

import { ProjectRequirement } from '../../types/context-plan';

export interface ProjectPlanOptions {
  message: string;
  loadedFilePaths?: string[];
  detectedLanguages?: string[];
  hasTestFailure?: boolean;
}

export class ProjectContextPlanner {
  public static plan(options: ProjectPlanOptions): ProjectRequirement {
    const { message, loadedFilePaths = [], detectedLanguages = [], hasTestFailure } = options;
    const paths: string[] = [...loadedFilePaths];
    const focusSymbols: string[] = [];

    // 1. Identify named files in message (e.g., src/index.ts, package.json, test.ts)
    const fileMatches = message.match(/[\w\-./\\]+\.(ts|js|py|rs|cpp|json|md|yaml|yml|html|css)/gi);
    if (fileMatches) {
      for (const match of fileMatches) {
        if (!paths.includes(match)) {
          paths.push(match);
        }
      }
    }

    // 2. Select manifests based on detected languages if none named
    if (detectedLanguages.includes('typescript') || detectedLanguages.includes('javascript')) {
      if (!paths.some(p => p.includes('tsconfig') || p.includes('package.json'))) {
        paths.push('package.json');
      }
    } else if (detectedLanguages.includes('rust')) {
      paths.push('Cargo.toml');
    } else if (detectedLanguages.includes('python')) {
      paths.push('pyproject.toml');
    }

    // 3. Extract focus symbols (e.g., TS error codes, identifiers)
    const symbolMatches = message.match(/\b([A-Z][a-zA-Z0-9_]+|TS\d{4,5})\b/g);
    if (symbolMatches) {
      for (const sym of symbolMatches) {
        if (!['Write', 'Fix', 'Explain', 'Prove', 'What', 'The', 'In'].includes(sym)) {
          focusSymbols.push(sym);
        }
      }
    }

    const isTargeted = paths.length > 0 || focusSymbols.length > 0;

    return {
      type: 'project',
      paths: paths.length > 0 ? paths : undefined,
      strategy: isTargeted ? 'targeted' : 'structural',
      focusSymbols: focusSymbols.length > 0 ? focusSymbols : undefined,
      includeDiagnostics: true,
      includeTests: Boolean(hasTestFailure || /test/i.test(message)),
    };
  }
}
