import {
  ProhibitedShortcutCode,
  ProhibitedShortcutViolation,
} from '../../types/program-completion';

export class ProhibitedShortcutsDetector {
  public static readonly SHORTCUT_DEFINITIONS: Record<ProhibitedShortcutCode, { description: string; remediation: string }> = {
    FORWARD_ONLY_SHIM: {
      description: 'Creating a facade or runtime that simply forwards to a legacy orchestrator without real boundaries',
      remediation: 'Implement proper request normalization, state management, and policy stages.',
    },
    HEURISTIC_WITHOUT_BOUNDARY: {
      description: 'Moving heuristic code to a new class without improving testable policy boundaries',
      remediation: 'Structure heuristics into explicit typed rules with testable criteria.',
    },
    DATASET_BEFORE_PROVENANCE: {
      description: 'Adding datasets before provenance, versioning, and license infrastructure',
      remediation: 'Register dataset manifests with license verification and provenance tracking first.',
    },
    UNFILTERED_HUGE_CORPUS: {
      description: 'Downloading an entire corpus because filtering is difficult',
      remediation: 'Apply quality filters, source whitelists, deduplication, and size quotas.',
    },
    SIMILARITY_ONLY_RANKING: {
      description: 'Using vector similarity as the sole retrieval ranking signal',
      remediation: 'Combine similarity with authority, freshness, quality, and version compatibility.',
    },
    FRAMEWORK_WITHOUT_VERSION: {
      description: 'Claiming framework knowledge without recording specific version compatibility',
      remediation: 'Tag all documentation and chunks with exact framework and package versions.',
    },
    GUESSED_MODEL_ATTRIBUTES: {
      description: 'Labeling provider models with guessed quality or pricing metrics',
      remediation: 'Record verified model capability matrices and benchmark results.',
    },
    PROVIDER_FAILURE_MASKING: {
      description: 'Hiding provider failures behind canned text presented as genuine success',
      remediation: 'Report provider health truthfully and record fallback events in diagnostics.',
    },
    INDISCRIMINATE_RAG: {
      description: 'Forcing all requests to retrieve external knowledge regardless of necessity',
      remediation: 'Use ContextPlanner to identify self-contained or general conversational intents.',
    },
    UNFILTERED_MEMORY_DUMP: {
      description: 'Dumping all conversation memory and variables into every prompt',
      remediation: 'Filter and budget context memory according to task relevance and token ceilings.',
    },
    THUMBS_UP_AUTO_TRAINING: {
      description: 'Automatically converting positive user feedback into training or retrieval examples',
      remediation: 'Triage feedback separately into analytical evaluation sets with explicit review.',
    },
    PRIVATE_COT_IN_DIAGNOSTICS: {
      description: 'Storing private reasoning or chain-of-thought in user/developer diagnostics',
      remediation: 'Redact private reasoning and secrets; store only structured stage timings and error codes.',
    },
    CLAIMING_MUTATION_WITHOUT_APPLY: {
      description: 'Claiming a tool changed filesystem contents when it only proposed a patch',
      remediation: 'Verify execution through SideEffectLedger before asserting file state changes.',
    },
    CLAIMING_TESTS_WITHOUT_RUN: {
      description: 'Claiming tests passed without running actual verification commands',
      remediation: 'Execute verification commands and capture exact exit codes and outputs.',
    },
    UNBENCHMARKED_VECTOR_STORE: {
      description: 'Adding a secondary vector store without comparative benchmark or ADR',
      remediation: 'Use the unified storage layer or document necessity via formal architectural review.',
    },
    LOWERED_EVAL_THRESHOLDS: {
      description: 'Lowering evaluation thresholds to fabricate dataset or model improvement',
      remediation: 'Maintain immutable evaluation baselines and release threshold tripwires.',
    },
    EVAL_EXAMPLES_IN_RAG: {
      description: 'Contaminating the retrieval index with evaluation benchmark examples',
      remediation: 'Strictly isolate evaluation sets from RAG and training ingestion pipelines.',
    },
    IMPORT_EQUATED_TO_QUALITY: {
      description: 'Treating successful raw dataset import as evidence of improved answer quality',
      remediation: 'Run comparative A/B evaluation before promoting any pack to default.',
    },
    IN_PLACE_MUTABLE_DATASET: {
      description: 'Mutating dataset chunks in place while allowing concurrent query access',
      remediation: 'Use atomic version activation so only fully indexed READY versions are queryable.',
    },
    FALSE_FRESHNESS_WITHOUT_DISCLOSURE: {
      description: 'Answering time-sensitive queries from stale snapshots without disclosure',
      remediation: 'Provide clear timestamp notices or abstain when current live facts are requested.',
    },
  };

  public detectViolations(
    observedConditions: Partial<Record<ProhibitedShortcutCode, boolean>>,
    componentMap?: Record<string, string>
  ): ProhibitedShortcutViolation[] {
    const violations: ProhibitedShortcutViolation[] = [];

    for (const [code, isViolated] of Object.entries(observedConditions) as [ProhibitedShortcutCode, boolean][]) {
      if (isViolated) {
        const def = ProhibitedShortcutsDetector.SHORTCUT_DEFINITIONS[code];
        violations.push({
          code,
          description: def.description,
          affectedComponent: componentMap?.[code] ?? 'Canonical System Component',
          remediation: def.remediation,
        });
      }
    }

    return violations;
  }
}
