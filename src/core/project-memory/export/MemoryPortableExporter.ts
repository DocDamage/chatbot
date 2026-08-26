/**
 * Transparent Portable Memory Exporter (PX-05 / PX05-T06 & PX05-T09)
 *
 * Generates human-readable MEMORY.md bundles and structured JSON exports
 * with secret redaction and idempotent re-import capabilities.
 */

import { ProjectMemoryStore } from '../capture/ProjectMemoryStore';
import { ProjectMemoryRecord } from '../capture/ProjectMemorySchema';

export interface MemoryExportBundle {
  schemaVersion: string;
  exportedAt: string;
  project?: string;
  branch?: string;
  totalRecords: number;
  markdownDoc: string;
  records: ProjectMemoryRecord[];
}

export class MemoryPortableExporter {
  constructor(private readonly store: ProjectMemoryStore) {}

  /**
   * Export all active project memories into a clean MEMORY.md and JSON bundle.
   */
  public exportBundle(options: { projectId?: string; branch?: string } = {}, requester: { userId: string; isAdmin?: boolean }): MemoryExportBundle {
    const records = this.store.query({
      projectId: options.projectId,
      branch: options.branch
    }, requester);

    const redactedRecords = records.map(r => this.redactSecrets(r));
    const markdownDoc = this.generateMarkdown(redactedRecords, options.branch || 'main');

    return {
      schemaVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      project: options.projectId,
      branch: options.branch,
      totalRecords: redactedRecords.length,
      markdownDoc,
      records: redactedRecords
    };
  }

  /**
   * Idempotently import memory records from an export bundle.
   */
  public importBundle(bundle: MemoryExportBundle, importer: { userId: string; isAdmin?: boolean }): { importedCount: number; skippedCount: number } {
    let importedCount = 0;
    let skippedCount = 0;

    for (const record of bundle.records) {
      try {
        const existing = this.store.get(record.id, importer);
        if (!existing) {
          this.store.save({
            ...record,
            ownerId: importer.userId,
            authorId: importer.userId
          });
          importedCount++;
        } else {
          // Idempotent: update if newer
          if (new Date(record.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
            this.store.save({
              ...record,
              ownerId: importer.userId
            });
            importedCount++;
          } else {
            skippedCount++;
          }
        }
      } catch {
        skippedCount++;
      }
    }

    return { importedCount, skippedCount };
  }

  private generateMarkdown(records: ProjectMemoryRecord[], branch: string): string {
    const lines: string[] = [
      `# Project Memory — Branch: \`${branch}\``,
      '',
      `*Generated on ${new Date().toISOString().split('T')[0]} | Total entries: ${records.length}*`,
      '',
      '---',
      ''
    ];

    const categories: Record<string, ProjectMemoryRecord[]> = {
      Decisions: records.filter(r => r.kind === 'decision'),
      Gotchas: records.filter(r => r.kind === 'gotcha'),
      Conventions: records.filter(r => r.kind === 'convention'),
      'Failure & Fixes': records.filter(r => r.kind === 'fix' || r.kind === 'failure'),
      Other: records.filter(r => !['decision', 'gotcha', 'convention', 'fix', 'failure'].includes(r.kind))
    };

    for (const [catName, catRecords] of Object.entries(categories)) {
      if (catRecords.length === 0) continue;

      lines.push(`## ${catName}`);
      lines.push('');

      for (const r of catRecords) {
        lines.push(`### ${r.title}`);
        lines.push(`- **ID:** \`${r.id}\` | **State:** \`${r.freshnessState}\` | **Confidence:** ${(r.confidence * 100).toFixed(0)}%`);
        if (r.tags.length > 0) {
          lines.push(`- **Tags:** ${r.tags.map(t => `\`${t}\``).join(', ')}`);
        }
        lines.push('');
        lines.push(r.content);
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  private redactSecrets(record: ProjectMemoryRecord): ProjectMemoryRecord {
    const copy = { ...record };
    const secretRegex = /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{8,}['"]?/gi;

    copy.content = copy.content.replace(secretRegex, '[REDACTED_SECRET]');
    copy.title = copy.title.replace(secretRegex, '[REDACTED_SECRET]');

    return copy;
  }
}
