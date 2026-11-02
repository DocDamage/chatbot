/**
 * Context Checkpoints & Cache Alignment Manager (PX-03 / PX03-T06)
 * Creates stable prompt prefixes for provider prompt caching, manages turn checkpoints,
 * tracks file deltas ("what changed since turn N"), and deduplicates repeated tool calls.
 */

import { createHash } from 'crypto';

export interface PromptCachePrefix {
  systemInstructionsHash: string;
  toolsSchemaHash: string;
  combinedPrefixText: string;
  cachedAt: string;
}

export interface ConversationCheckpoint {
  turnIndex: number;
  checkpointId: string;
  timestamp: string;
  contextDigest: string;
  activeFileSnapshots: Map<string, string>; // filePath -> contentHash
}

export class ContextCheckpointManager {
  private static instance: ContextCheckpointManager;
  private checkpoints = new Map<string, ConversationCheckpoint>();
  private toolResultCache = new Map<string, { result: string; timestamp: string; hash: string }>();

  public static getInstance(): ContextCheckpointManager {
    if (!ContextCheckpointManager.instance) {
      ContextCheckpointManager.instance = new ContextCheckpointManager();
    }
    return ContextCheckpointManager.instance;
  }

  /**
   * Constructs a stable, deterministic system + tool schema prefix to maximize prompt cache hits.
   */
  public constructCacheAlignedPrefix(systemPrompt: string, toolSchemas: Array<Record<string, unknown>>): PromptCachePrefix {
    const sortedSchemas = toolSchemas
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    const schemasJson = JSON.stringify(sortedSchemas);
    const systemHash = createHash('sha256').update(systemPrompt, 'utf8').digest('hex');
    const toolsHash = createHash('sha256').update(schemasJson, 'utf8').digest('hex');

    const combined = `${systemPrompt}\n\n[AVAILABLE_TOOLS_SCHEMA]\n${schemasJson}`;

    return {
      systemInstructionsHash: systemHash,
      toolsSchemaHash: toolsHash,
      combinedPrefixText: combined,
      cachedAt: new Date().toISOString()
    };
  }

  /**
   * Records a conversation turn checkpoint with current file hashes.
   */
  public createCheckpoint(sessionId: string, turnIndex: number, fileSnapshots: Record<string, string>): ConversationCheckpoint {
    const activeMap = new Map<string, string>();
    for (const [f, content] of Object.entries(fileSnapshots)) {
      const hash = createHash('sha256').update(content, 'utf8').digest('hex');
      activeMap.set(f, hash);
    }

    const digest = createHash('sha256')
      .update(`${sessionId}:${turnIndex}:${Array.from(activeMap.entries()).join(',')}`)
      .digest('hex');

    const checkpoint: ConversationCheckpoint = {
      turnIndex,
      checkpointId: `chk_${sessionId}_t${turnIndex}`,
      timestamp: new Date().toISOString(),
      contextDigest: digest,
      activeFileSnapshots: activeMap
    };

    this.checkpoints.set(checkpoint.checkpointId, checkpoint);
    return checkpoint;
  }

  /**
   * Computes what changed in files since a given turn checkpoint.
   */
  public computeDeltaSinceCheckpoint(checkpointId: string, currentFiles: Record<string, string>): {
    modifiedFiles: string[];
    addedFiles: string[];
    deletedFiles: string[];
  } {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      return {
        modifiedFiles: Object.keys(currentFiles),
        addedFiles: [],
        deletedFiles: []
      };
    }

    const modifiedFiles: string[] = [];
    const addedFiles: string[] = [];
    const deletedFiles: string[] = [];

    const currentMap = new Map<string, string>();
    for (const [f, content] of Object.entries(currentFiles)) {
      const hash = createHash('sha256').update(content, 'utf8').digest('hex');
      currentMap.set(f, hash);
    }

    for (const [file, currentHash] of currentMap.entries()) {
      const oldHash = checkpoint.activeFileSnapshots.get(file);
      if (!oldHash) {
        addedFiles.push(file);
      } else if (oldHash !== currentHash) {
        modifiedFiles.push(file);
      }
    }

    for (const file of checkpoint.activeFileSnapshots.keys()) {
      if (!currentMap.has(file)) {
        deletedFiles.push(file);
      }
    }

    return { modifiedFiles, addedFiles, deletedFiles };
  }

  /**
   * Deduplicates identical tool calls within a session.
   */
  public deduplicateToolCall(toolName: string, args: Record<string, unknown>, execute: () => string): string {
    const key = `${toolName}:${JSON.stringify(args)}`;
    const cached = this.toolResultCache.get(key);

    if (cached && Date.now() - new Date(cached.timestamp).getTime() < 300000) { // 5 min TTL
      return `${cached.result}  [cached tool output from ${cached.timestamp}]`;
    }

    const result = execute();
    const hash = createHash('sha256').update(result, 'utf8').digest('hex');
    this.toolResultCache.set(key, {
      result,
      timestamp: new Date().toISOString(),
      hash
    });

    return result;
  }

  public clear(): void {
    this.checkpoints.clear();
    this.toolResultCache.clear();
  }
}
