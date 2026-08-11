import { CodingKnowledgeEntry, KnowledgeAuthority, ProvenancePolicy } from './ProvenancePolicy';

export class CodingKnowledgeAuthority {
  private readonly policy = new ProvenancePolicy();
  private readonly entries: CodingKnowledgeEntry[] = [];

  add(entry: CodingKnowledgeEntry): void { this.entries.push({ ...entry, tags: [...entry.tags], provenance: [...entry.provenance] }); }

  search(query: string, scope?: string): CodingKnowledgeEntry[] {
    const terms = query.toLowerCase().split(/\W+/).filter(Boolean);
    return this.entries.filter(entry => !scope || !entry.projectScope || entry.projectScope === scope)
      .map(entry => ({ entry, score: terms.filter(term => `${entry.title} ${entry.content} ${entry.tags.join(' ')}`.toLowerCase().includes(term)).length }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || this.policy.authorityRank(b.entry.authority) - this.policy.authorityRank(a.entry.authority))
      .map(item => item.entry);
  }

  promote(id: string, evidence: Parameters<ProvenancePolicy['promote']>[1]): CodingKnowledgeEntry {
    const index = this.entries.findIndex(entry => entry.id === id);
    if (index < 0) throw new Error(`Knowledge entry not found: ${id}`);
    const promoted = this.policy.promote(this.entries[index], evidence);
    this.entries[index] = promoted;
    return promoted;
  }

  classify(entry: CodingKnowledgeEntry): KnowledgeAuthority { return entry.authority; }
  all(): CodingKnowledgeEntry[] { return this.entries.map(entry => ({ ...entry, tags: [...entry.tags], provenance: [...entry.provenance] })); }
}
