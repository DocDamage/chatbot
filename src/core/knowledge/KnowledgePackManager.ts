/**
 * Knowledge Pack Manager (CRK-P06-T06)
 *
 * Manages the lifecycle, routing precedence, readiness verification,
 * and enable/disable states for Knowledge Packs.
 */

import { KnowledgePack, INITIAL_KNOWLEDGE_PACKS } from '../../types/knowledge-packs';

export interface PackReadiness {
  packId: string;
  name: string;
  enabled: boolean;
  isReady: boolean;
  installedDatasetIds: string[];
  missingDatasetIds: string[];
}

export class KnowledgePackManager {
  private readonly packs = new Map<string, KnowledgePack>();

  constructor(initialPacks: KnowledgePack[] = INITIAL_KNOWLEDGE_PACKS) {
    for (const pack of initialPacks) {
      this.packs.set(pack.id, { ...pack });
    }
  }

  public get(packId: string): KnowledgePack | undefined {
    return this.packs.get(packId);
  }

  public list(): KnowledgePack[] {
    return Array.from(this.packs.values()).sort((a, b) => a.precedence - b.precedence);
  }

  public listEnabled(): KnowledgePack[] {
    return this.list().filter(p => p.enabled);
  }

  public setEnabled(packId: string, enabled: boolean): boolean {
    const pack = this.packs.get(packId);
    if (!pack) return false;
    pack.enabled = enabled;
    return true;
  }

  /**
   * Determine whether a pack's constituent datasets are installed and ready (§1552)
   */
  public getReadiness(packId: string, installedDatasetIds: string[]): PackReadiness {
    const pack = this.packs.get(packId);
    if (!pack) {
      throw new Error(`Knowledge pack '${packId}' not found`);
    }

    const installedSet = new Set(installedDatasetIds);
    const installed = pack.datasetIds.filter(id => installedSet.has(id));
    const missing = pack.datasetIds.filter(id => !installedSet.has(id));
    const isReady = pack.datasetIds.length > 0 && missing.length === 0;

    return {
      packId: pack.id,
      name: pack.name,
      enabled: pack.enabled,
      isReady,
      installedDatasetIds: installed,
      missingDatasetIds: missing,
    };
  }

  /**
   * Return packs that match a routing domain ordered by precedence
   */
  public resolvePacksForDomain(domain: string): KnowledgePack[] {
    const normDomain = domain.toLowerCase();
    return this.listEnabled().filter(pack =>
      pack.defaultRoutingDomains.some(d => d.toLowerCase() === normDomain)
    );
  }

  /**
   * Cascade disable without deleting underlying data (§1555)
   */
  public cascadeDisable(packId: string): { disabled: boolean; datasetIdsPreserved: string[] } {
    const pack = this.packs.get(packId);
    if (!pack) {
      return { disabled: false, datasetIdsPreserved: [] };
    }
    pack.enabled = false;
    return {
      disabled: true,
      datasetIdsPreserved: [...pack.datasetIds],
    };
  }
}
