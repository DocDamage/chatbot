/**
 * Session Discovery Adapters (PX-06 / PX06-T02)
 * Opt-in observer for external and internal agent session stores (Codex, Claude Code, OpenCode, internal agents).
 * Enforces approved root confinement, bounded file reading, parser versioning, and zero credential leakage.
 */

import * as fs from 'fs';
import * as path from 'path';
import { AgentSession, AgentProviderClient } from '../contracts/AgentOperationsSchema';
import { AgentPrivacyRedactor } from '../privacy/AgentPrivacyRedactor';

export interface DiscoveryRootConfig {
  provider: AgentProviderClient;
  approvedRootPath: string;
  maxFilesToInspect?: number;
  maxFileSizeKiloBytes?: number;
  enabled: boolean;
}

export interface DiscoveredSessionSummary {
  sessionId: string;
  provider: AgentProviderClient;
  agentId: string;
  role: string;
  state: string;
  startedAt: string;
  lastActivityAt: string;
  parsedVersion: string;
  isSupportedVersion: boolean;
  filePath: string;
  metadata?: Record<string, any>;
}

export class SessionDiscoveryAdapter {
  private static readonly SUPPORTED_PARSER_VERSIONS: Record<AgentProviderClient, string[]> = {
    codex: ['1.0.0', '1.1.0', '2.0.0'],
    claude_code: ['0.1.0', '1.0.0'],
    opencode: ['1.0.0'],
    internal_agent: ['1.0.0', '2.0.0'],
    custom_client: ['1.0.0']
  };

  private watchedRoots: Map<string, DiscoveryRootConfig> = new Map();
  private activeWatchers: Map<string, fs.FSWatcher> = new Map();

  /**
   * Register an approved discovery root
   */
  public registerRoot(config: DiscoveryRootConfig): void {
    if (!config.enabled) return;
    if (!path.isAbsolute(config.approvedRootPath)) {
      throw new Error(`Approved root must be an absolute path: ${config.approvedRootPath}`);
    }
    this.watchedRoots.set(config.approvedRootPath, {
      ...config,
      maxFilesToInspect: config.maxFilesToInspect ?? 50,
      maxFileSizeKiloBytes: config.maxFileSizeKiloBytes ?? 512
    });
  }

  /**
   * Discover sessions in all registered roots without executing unapproved crawls
   */
  public discoverSessions(): DiscoveredSessionSummary[] {
    const results: DiscoveredSessionSummary[] = [];

    for (const [rootPath, config] of this.watchedRoots.entries()) {
      if (!fs.existsSync(rootPath)) continue;

      try {
        const stat = fs.statSync(rootPath);
        if (!stat.isDirectory()) continue;

        const files = fs.readdirSync(rootPath);
        const candidateFiles = files
          .filter(f => f.endsWith('.json') || f.endsWith('.jsonl') || f.endsWith('.session'))
          .slice(0, config.maxFilesToInspect);

        for (const file of candidateFiles) {
          const fullPath = path.join(rootPath, file);
          const fileStat = fs.statSync(fullPath);
          const maxBytes = (config.maxFileSizeKiloBytes || 512) * 1024;
          if (fileStat.size > maxBytes) continue;

          const sessionSummary = this.parseSessionFile(fullPath, config.provider);
          if (sessionSummary) {
            results.push(sessionSummary);
          }
        }
      } catch {
        // Safe read failure: continue to next root
      }
    }

    return results;
  }

  /**
   * Parse a single session file safely
   */
  private parseSessionFile(filePath: string, provider: AgentProviderClient): DiscoveredSessionSummary | null {
    try {
      const rawContent = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(rawContent);

      const parsedVersion = String(parsed.version || parsed.schemaVersion || '1.0.0');
      const supportedVersions = SessionDiscoveryAdapter.SUPPORTED_PARSER_VERSIONS[provider] || ['1.0.0'];
      const isSupportedVersion = supportedVersions.includes(parsedVersion);

      const sessionId = parsed.sessionId || parsed.id || path.basename(filePath, path.extname(filePath));
      const agentId = parsed.agentId || parsed.agent_name || 'external_agent';
      const role = parsed.role || 'implementer';
      const state = parsed.state || parsed.status || 'active';
      const startedAt = parsed.startedAt || parsed.created_at || new Date().toISOString();
      const lastActivityAt = parsed.lastActivityAt || parsed.updated_at || startedAt;

      // Extract metadata with strict redaction
      const rawMeta = parsed.metadata || parsed.context || {};
      const metadata = AgentPrivacyRedactor.redactObject(rawMeta);

      return {
        sessionId,
        provider,
        agentId,
        role,
        state,
        startedAt,
        lastActivityAt,
        parsedVersion,
        isSupportedVersion,
        filePath: AgentPrivacyRedactor.redactString(filePath),
        metadata
      };
    } catch {
      return null;
    }
  }

  /**
   * Stop watching and clean up watchers
   */
  public stopAll(): void {
    for (const [key, watcher] of this.activeWatchers.entries()) {
      try {
        watcher.close();
      } catch {
        // Ignore close errors
      }
      this.activeWatchers.delete(key);
    }
    this.watchedRoots.clear();
  }
}
