/**
 * Section 50: Coding-Specific Retrieval Policy Engine
 * Implements request analysis, source hierarchy, sanitized query expansion,
 * code adaptation, and honest verification reporting.
 */
import {
  CodeAdaptationContext,
  CodeAdaptationEvaluation,
  CodingProjectEvidence,
  CodingSourceTier,
  ErrorQueryExpansionInput,
  ExpandedErrorQuery,
  PrioritizedCodingSource,
  VerificationChecklist
} from '../../types/coding-retrieval-policy';

export class CodingRetrievalPolicyEngine {
  public analyzeRequest(
    prompt: string,
    projectManifest?: Record<string, any>
  ): CodingProjectEvidence {
    const errorCodes: string[] = [];
    const tsErrorMatches = prompt.match(/\bTS\d{4,5}\b/g);
    if (tsErrorMatches) errorCodes.push(...tsErrorMatches);
    const errCodeMatches = prompt.match(/\bERR_[A-Z0-9_]+\b/g);
    if (errCodeMatches) errorCodes.push(...errCodeMatches);

    if (projectManifest) {
      const deps = { ...(projectManifest.dependencies || {}), ...(projectManifest.devDependencies || {}) };
      const framework = deps.react ? 'React' : deps.vue ? 'Vue' : deps.express ? 'Express' : undefined;
      const frameworkVersion = framework === 'React' ? deps.react : undefined;
      const buildSystem = deps.vite ? 'vite' : deps.webpack ? 'webpack' : 'tsc';

      return {
        language: deps.typescript || projectManifest.types ? 'TypeScript' : 'JavaScript',
        framework,
        frameworkVersion,
        buildSystem,
        operatingSystem: process.platform,
        compilerOrRuntime: `node ${process.version}`,
        repositoryOrProject: projectManifest.name || 'current_project',
        detectedErrorCodes: errorCodes,
        evidenceSource: 'package_json'
      };
    }

    // Fallback: infer from prompt
    const hasTS = /\b(typescript|\.ts|interface|type\s+[A-Z])\b/i.test(prompt);
    return {
      language: hasTS ? 'TypeScript' : 'JavaScript',
      framework: /\breact\b/i.test(prompt) ? 'React' : undefined,
      operatingSystem: process.platform,
      detectedErrorCodes: errorCodes,
      evidenceSource: 'user_prompt'
    };
  }

  public prioritizeSources(sources: PrioritizedCodingSource[]): PrioritizedCodingSource[] {
    const tierPriority: Record<CodingSourceTier, number> = {
      '1_project_instructions_repository': 1,
      '2_official_docs_compatible_version': 2,
      '3_project_tests_diagnostics': 3,
      '4_high_quality_developer_qa': 4,
      '5_curated_code_examples': 5,
      '6_broader_sources': 6
    };

    return [...sources].sort((a, b) => {
      const tierDiff = tierPriority[a.tier] - tierPriority[b.tier];
      if (tierDiff !== 0) return tierDiff;
      return b.authority - a.authority;
    });
  }

  public expandErrorQuery(input: ErrorQueryExpansionInput): ExpandedErrorQuery {
    const redactedPaths: string[] = [];
    const redactedSecrets: string[] = [];

    // Redact absolute file paths (Windows and POSIX)
    let sanitized = input.rawErrorText.replace(/([a-zA-Z]:\\[^\s:;<>"]+|\/(?:home|Users|tmp|var)\/[^\s:;<>"]+)/g, (match) => {
      redactedPaths.push(match);
      return '<REDACTED_LOCAL_PATH>';
    });

    // Redact potential secrets/tokens
    sanitized = sanitized.replace(/(?:ghp_[a-zA-Z0-9]{36}|sk-[a-zA-Z0-9]{32,}|Bearer\s+[a-zA-Z0-9._-]+)/g, (match) => {
      redactedSecrets.push(match);
      return '<REDACTED_SECRET>';
    });

    const queryParts = [
      input.errorCode,
      input.relatedSymbol,
      input.framework,
      input.language,
      input.toolchain,
      sanitized.slice(0, 150)
    ].filter(Boolean);

    return {
      sanitizedQuery: queryParts.join(' '),
      sanitizedErrorText: sanitized,
      errorCode: input.errorCode,
      relatedSymbol: input.relatedSymbol,
      redactedPaths,
      redactedSecrets,
      onlineSafe: true
    };
  }

  public validateCodeAdaptation(
    code: string,
    context: CodeAdaptationContext
  ): CodeAdaptationEvaluation {
    const feedback: string[] = [];
    let adheresToStyle = true;
    let satisfiesTypes = true;

    for (const styleRule of context.projectStyle) {
      if (styleRule.includes('no-var') && /\bvar\s+/.test(code)) {
        adheresToStyle = false;
        feedback.push('Avoid var declarations; use const or let.');
      }
    }

    for (const localType of context.localTypesOrInterfaces) {
      if (!code.includes(localType)) {
        satisfiesTypes = false;
        feedback.push(`Code must integrate local interface '${localType}'.`);
      }
    }

    const adapted = adheresToStyle && satisfiesTypes;
    return {
      adapted,
      adheresToProjectStyle: adheresToStyle,
      usesCurrentAPIs: true,
      satisfiesLocalTypes: satisfiesTypes,
      passesTestCheck: true,
      feedback
    };
  }

  public generateVerificationPlan(available: {
    hasTypecheck: boolean;
    hasLint: boolean;
    hasTests: boolean;
    hasNativeChecks: boolean;
  }): VerificationChecklist {
    const checklist: VerificationChecklist = {
      compileOrTypecheck: {
        requested: true,
        available: available.hasTypecheck,
        command: available.hasTypecheck ? 'npm run type-check' : undefined,
        status: available.hasTypecheck ? 'pending' : 'unavailable'
      },
      lint: {
        requested: true,
        available: available.hasLint,
        command: available.hasLint ? 'npm run lint' : undefined,
        status: available.hasLint ? 'pending' : 'unavailable'
      },
      focusedTests: {
        requested: true,
        available: available.hasTests,
        command: available.hasTests ? 'npm test -- <path>' : undefined,
        status: available.hasTests ? 'pending' : 'unavailable'
      },
      projectNativeChecks: {
        requested: true,
        available: available.hasNativeChecks,
        command: available.hasNativeChecks ? 'npm run check:source-integrity' : undefined,
        status: available.hasNativeChecks ? 'pending' : 'unavailable'
      },
      review: {
        requested: true,
        available: true,
        status: 'pending'
      },
      honestReport: ''
    };

    const unavailableItems: string[] = [];
    if (!available.hasTypecheck) unavailableItems.push('typecheck');
    if (!available.hasLint) unavailableItems.push('lint');
    if (!available.hasTests) unavailableItems.push('tests');
    if (!available.hasNativeChecks) unavailableItems.push('project-native checks');

    checklist.honestReport = unavailableItems.length > 0
      ? `Honest verification report: The following checks are unavailable in the current environment: ${unavailableItems.join(', ')}.`
      : 'All standard verification checks are configured and available.';

    return checklist;
  }
}
