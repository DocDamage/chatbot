import {
  InformationStorageClass,
  InformationPayload,
  ArbitrationDecision,
  DecisionTableEntry,
  StorageClassRule,
} from '../../types/memory-knowledge-table';

export class MemoryKnowledgeArbiter {
  private static readonly RULES: Record<InformationStorageClass, StorageClassRule> = {
    conversation_variable: {
      storageClass: 'conversation_variable',
      description: 'Session-specific runtime parameters or ephemeral facts (e.g. current project versions)',
      isCanonicalKnowledge: false,
      persistsAcrossSessions: false,
      requiresUserConsent: false,
      allowedSourceTypes: ['user_turn', 'extracted_variable', 'session_param'],
    },
    user_memory: {
      storageClass: 'user_memory',
      description: 'Explicit long-term user preferences that persist across sessions when allowed by policy',
      isCanonicalKnowledge: false,
      persistsAcrossSessions: true,
      requiresUserConsent: true,
      allowedSourceTypes: ['user_explicit_preference', 'user_setting'],
    },
    project_evidence: {
      storageClass: 'project_evidence',
      description: 'Repository facts, build commands, file structure, and local environment state',
      isCanonicalKnowledge: false,
      persistsAcrossSessions: true,
      requiresUserConsent: false,
      allowedSourceTypes: ['repo_scan', 'config_file', 'build_manifest'],
    },
    knowledge_pack: {
      storageClass: 'knowledge_pack',
      description: 'Curated, versioned canonical documentation, API references, and language specs',
      isCanonicalKnowledge: true,
      persistsAcrossSessions: true,
      requiresUserConsent: false,
      allowedSourceTypes: ['official_docs', 'language_spec', 'curated_library'],
    },
    conversation_history: {
      storageClass: 'conversation_history',
      description: 'Chronological message logs between user and assistant; not canonical truth',
      isCanonicalKnowledge: false,
      persistsAcrossSessions: false,
      requiresUserConsent: false,
      allowedSourceTypes: ['user_message', 'assistant_message', 'system_prompt'],
    },
    project_memory: {
      storageClass: 'project_memory',
      description: 'User-approved architectural decisions and design agreements for this project',
      isCanonicalKnowledge: false,
      persistsAcrossSessions: true,
      requiresUserConsent: true,
      allowedSourceTypes: ['approved_design_decision', 'architecture_decision_record'],
    },
    developer_qa: {
      storageClass: 'developer_qa',
      description: 'Curated developer Q&A datasets (e.g. Stack Overflow answers with provenance)',
      isCanonicalKnowledge: true,
      persistsAcrossSessions: true,
      requiresUserConsent: false,
      allowedSourceTypes: ['stack_exchange', 'github_discussion', 'developer_forum'],
    },
    tool_ledger: {
      storageClass: 'tool_ledger',
      description: 'Auditable log of executed and failed tool invocations and side effects',
      isCanonicalKnowledge: false,
      persistsAcrossSessions: true,
      requiresUserConsent: false,
      allowedSourceTypes: ['tool_execution_success', 'tool_execution_failure', 'tool_reversion'],
    },
    feedback_store: {
      storageClass: 'feedback_store',
      description: 'User evaluation feedback (ratings, comments, issue reports) strictly partitioned',
      isCanonicalKnowledge: false,
      persistsAcrossSessions: true,
      requiresUserConsent: false,
      allowedSourceTypes: ['thumbs_up', 'thumbs_down', 'user_feedback_comment'],
    },
  };

  public static readonly CANONICAL_DECISION_TABLE: DecisionTableEntry[] = [
    {
      example: "user says 'I\\'m using Godot 4.7' for current project",
      storageClass: 'conversation_variable',
      governingRule: 'Session/task scope only; must not overwrite global user preferences.',
    },
    {
      example: 'user explicitly wants preference remembered',
      storageClass: 'user_memory',
      governingRule: 'Requires policy allowance and explicit user consent.',
    },
    {
      example: 'repository build command',
      storageClass: 'project_evidence',
      governingRule: 'Tied directly to repository scope; not a global user preference.',
    },
    {
      example: 'official Godot API',
      storageClass: 'knowledge_pack',
      governingRule: 'Versioned, authoritative knowledge base; never mutable by user chat turn.',
    },
    {
      example: 'previous assistant answer',
      storageClass: 'conversation_history',
      governingRule: 'Conversation context only; strictly excluded from canonical knowledge.',
    },
    {
      example: 'user-approved project design decision',
      storageClass: 'project_memory',
      governingRule: 'Episodic/canonical project memory; requires user approval.',
    },
    {
      example: 'Stack Overflow accepted answer',
      storageClass: 'developer_qa',
      governingRule: 'Separate dataset tier with provenance and license compliance.',
    },
    {
      example: 'a failed tool result',
      storageClass: 'tool_ledger',
      governingRule: 'Execution diagnostics ledger; never mixed with conversation memory.',
    },
    {
      example: 'thumbs-down feedback',
      storageClass: 'feedback_store',
      governingRule: 'Feedback telemetry store; never directly added as training or knowledge.',
    },
  ];

  public getRule(storageClass: InformationStorageClass): StorageClassRule {
    return MemoryKnowledgeArbiter.RULES[storageClass];
  }

  public arbitrate(payload: InformationPayload): ArbitrationDecision {
    const targetRule = MemoryKnowledgeArbiter.RULES[payload.targetStorageClass];
    const timestamp = new Date().toISOString();

    if (!targetRule) {
      return {
        payloadId: payload.id,
        requestedStorageClass: payload.targetStorageClass,
        approvedStorageClass: payload.targetStorageClass,
        isAuthorized: false,
        rejectionReason: `Unknown storage class: ${payload.targetStorageClass}`,
        timestamp,
      };
    }

    // Check if source type is permitted for this destination
    if (!targetRule.allowedSourceTypes.includes(payload.sourceType)) {
      // Check for illegal boundary violations
      if (
        payload.sourceType === 'assistant_message' &&
        payload.targetStorageClass === 'knowledge_pack'
      ) {
        return {
          payloadId: payload.id,
          requestedStorageClass: payload.targetStorageClass,
          approvedStorageClass: 'conversation_history',
          isAuthorized: false,
          rejectionReason: 'Violation of §52: Assistant responses must not be stored as canonical knowledge packs.',
          timestamp,
        };
      }

      if (
        payload.sourceType === 'tool_execution_failure' &&
        payload.targetStorageClass === 'user_memory'
      ) {
        return {
          payloadId: payload.id,
          requestedStorageClass: payload.targetStorageClass,
          approvedStorageClass: 'tool_ledger',
          isAuthorized: false,
          rejectionReason: 'Violation of §52: Tool execution failures must be recorded in tool ledger, not user memory.',
          timestamp,
        };
      }

      if (
        (payload.sourceType === 'thumbs_down' || payload.sourceType === 'thumbs_up') &&
        payload.targetStorageClass === 'knowledge_pack'
      ) {
        return {
          payloadId: payload.id,
          requestedStorageClass: payload.targetStorageClass,
          approvedStorageClass: 'feedback_store',
          isAuthorized: false,
          rejectionReason: 'Violation of §52: Feedback ratings must be stored in feedback_store, not knowledge packs.',
          timestamp,
        };
      }

      return {
        payloadId: payload.id,
        requestedStorageClass: payload.targetStorageClass,
        approvedStorageClass: payload.targetStorageClass,
        isAuthorized: false,
        rejectionReason: `Source type '${payload.sourceType}' is not allowed in storage class '${payload.targetStorageClass}'. Allowed: ${targetRule.allowedSourceTypes.join(', ')}`,
        timestamp,
      };
    }

    // Check user consent requirement if needed
    if (targetRule.requiresUserConsent && !payload.metadata?.userConsented) {
      return {
        payloadId: payload.id,
        requestedStorageClass: payload.targetStorageClass,
        approvedStorageClass: payload.targetStorageClass,
        isAuthorized: false,
        rejectionReason: `Storage class '${payload.targetStorageClass}' requires explicit user consent.`,
        timestamp,
      };
    }

    return {
      payloadId: payload.id,
      requestedStorageClass: payload.targetStorageClass,
      approvedStorageClass: payload.targetStorageClass,
      isAuthorized: true,
      timestamp,
    };
  }
}
