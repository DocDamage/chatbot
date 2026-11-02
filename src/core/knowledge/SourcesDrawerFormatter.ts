/**
 * Sources Drawer Formatter (CRK-P15-T03)
 *
 * Formats raw CitationRef instances into display-ready card models for the
 * collapsible Sources Drawer UI, assigning categories, badges, and deep actions.
 */

import {
  CitationRef,
  SourceCard,
  SourceCardCategory,
  SourcesDrawerData,
} from '../../types/citation';

export class SourcesDrawerFormatter {
  /**
   * Formats an array of citations into a SourcesDrawerData payload.
   */
  public format(citations: CitationRef[], unresolvedCitations: string[] = []): SourcesDrawerData {
    if (!citations || citations.length === 0) {
      return {
        totalSources: 0,
        compactLabel: 'Sources (0)',
        cards: [],
        unresolvedCitations,
      };
    }

    const seenKeys = new Set<string>();
    const cards: SourceCard[] = [];

    for (const cit of citations) {
      const dedupKey = cit.sourceUrl || cit.path || `${cit.sourceId}:${cit.chunkId}`;
      if (seenKeys.has(dedupKey)) {
        continue;
      }
      seenKeys.add(dedupKey);

      const category = this.categorize(cit);
      const categoryLabel = this.getCategoryLabel(category);
      const badges: string[] = [categoryLabel];

      if (cit.version) {
        badges.push(cit.version.startsWith('v') ? cit.version : `v${cit.version}`);
      }
      if (cit.authority !== undefined) {
        badges.push(`${cit.authority.toFixed(2)} authority`);
      }

      let action: SourceCard['action'] = { type: 'none', label: 'View details' };
      if (cit.sourceUrl) {
        action = { type: 'open_url', target: cit.sourceUrl, label: 'Open source' };
      } else if (cit.path) {
        action = { type: 'open_file', target: cit.path, label: 'Open file' };
      }

      cards.push({
        id: `sc-${cit.id}`,
        title: cit.title,
        category,
        categoryLabel,
        version: cit.version,
        authority: cit.authority,
        sourceUrl: cit.sourceUrl,
        path: cit.path,
        badges,
        action,
      });
    }

    return {
      totalSources: cards.length,
      compactLabel: `Sources (${cards.length})`,
      cards,
      unresolvedCitations,
    };
  }

  private categorize(cit: CitationRef): SourceCardCategory {
    const sId = (cit.sourceId || '').toLowerCase();
    const dId = (cit.datasetId || '').toLowerCase();
    const url = (cit.sourceUrl || '').toLowerCase();
    const path = (cit.path || '').toLowerCase();

    if (path.length > 0 || sId.includes('repo') || sId.includes('project') || sId.includes('code')) {
      return 'repo_evidence';
    }
    if (sId.includes('doc') || dId.includes('doc') || url.includes('docs.')) {
      return 'official_docs';
    }
    if (sId.includes('stack') || sId.includes('qa') || dId.includes('qa') || url.includes('stackoverflow.com')) {
      return 'developer_qa';
    }
    if (sId.includes('wiki') || dId.includes('wiki') || url.includes('wikipedia.org')) {
      return 'general_knowledge';
    }
    return 'other';
  }

  private getCategoryLabel(category: SourceCardCategory): string {
    switch (category) {
      case 'official_docs':
        return 'Official documentation';
      case 'repo_evidence':
        return 'Repository evidence';
      case 'developer_qa':
        return 'Developer Q&A';
      case 'general_knowledge':
        return 'General knowledge';
      default:
        return 'Knowledge source';
    }
  }
}
