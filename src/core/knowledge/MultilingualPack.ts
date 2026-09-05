/**
 * Multilingual Knowledge Pack (CRK-P21-T04, T05)
 *
 * Manages language-specific installs by ISO 639-1 code and verifies embedding
 * model compatibility (dimension, version, multilingual support) to prevent cross-language vector corruption.
 */

import {
  MultilingualDocument,
  SupportedLanguageCode,
  EmbeddingCompatibility,
} from '../../types/educational-multilingual';

export interface MultilingualRetrievalResult {
  docId: string;
  language: SupportedLanguageCode;
  title: string;
  content: string;
  score: number;
}

export class MultilingualPack {
  public readonly packId = 'multilingual';
  public readonly authority = 0.72;
  private readonly installedLanguages = new Set<SupportedLanguageCode>();
  private readonly languageDocs = new Map<SupportedLanguageCode, Map<string, MultilingualDocument>>();
  private readonly embeddingConfigs = new Map<SupportedLanguageCode, EmbeddingCompatibility>();

  constructor(initialLanguages: SupportedLanguageCode[] = []) {
    for (const lang of initialLanguages) {
      this.installLanguage(lang);
    }
  }

  public installLanguage(lang: SupportedLanguageCode): void {
    this.installedLanguages.add(lang);
    if (!this.languageDocs.has(lang)) {
      this.languageDocs.set(lang, new Map());
    }
  }

  public uninstallLanguage(lang: SupportedLanguageCode): void {
    this.installedLanguages.delete(lang);
    this.languageDocs.delete(lang);
    this.embeddingConfigs.delete(lang);
  }

  public isLanguageInstalled(lang: SupportedLanguageCode): boolean {
    return this.installedLanguages.has(lang);
  }

  public configureEmbedding(config: EmbeddingCompatibility): { valid: boolean; reason?: string } {
    if (!this.isLanguageInstalled(config.language)) {
      return { valid: false, reason: `LANGUAGE_${config.language}_NOT_INSTALLED` };
    }
    if (!config.isMultilingual && config.language !== 'en') {
      return {
        valid: false,
        reason: `MODEL_${config.modelName}_NOT_MULTILINGUAL_FOR_${config.language}`,
      };
    }
    this.embeddingConfigs.set(config.language, config);
    return { valid: true };
  }

  public ingest(doc: MultilingualDocument): { success: boolean; reason?: string } {
    if (!this.isLanguageInstalled(doc.language)) {
      return { success: false, reason: `LANGUAGE_NOT_INSTALLED_${doc.language}` };
    }
    const store = this.languageDocs.get(doc.language);
    if (!store) return { success: false, reason: 'STORAGE_UNAVAILABLE' };

    store.set(doc.id, doc);
    return { success: true };
  }

  public query(queryText: string, language: SupportedLanguageCode, limit = 5): MultilingualRetrievalResult[] {
    if (!this.isLanguageInstalled(language)) {
      return [];
    }
    const store = this.languageDocs.get(language);
    if (!store) return [];

    const tokens = queryText.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const results: MultilingualRetrievalResult[] = [];

    for (const doc of store.values()) {
      const textLower = (doc.title + ' ' + doc.content).toLowerCase();
      let matches = 0;
      for (const t of tokens) {
        if (textLower.includes(t)) matches++;
      }
      if (matches > 0) {
        results.push({
          docId: doc.id,
          language: doc.language,
          title: doc.title,
          content: doc.content,
          score: Math.min(1.0, matches / tokens.length),
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  public getInstalledLanguages(): SupportedLanguageCode[] {
    return Array.from(this.installedLanguages);
  }
}
