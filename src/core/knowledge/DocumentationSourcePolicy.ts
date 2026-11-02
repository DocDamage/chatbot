/**
 * Documentation Source Policy (CRK-P07-T01)
 *
 * Enforces authority weighting and domain support rules for official technical documentation.
 * Official docs possess the highest external technical authority (default 0.95).
 */

import {
  SUPPORTED_DOC_LANGUAGES,
  SUPPORTED_DOC_FRAMEWORKS,
} from '../../types/official-docs';

export const OFFICIAL_DOC_AUTHORITY = 0.95;

export type ProductDomainType = 'language' | 'framework' | 'tool' | 'api' | 'unknown';

export class DocumentationSourcePolicy {
  private readonly languages = new Set<string>(SUPPORTED_DOC_LANGUAGES);
  private readonly frameworks = new Set<string>(SUPPORTED_DOC_FRAMEWORKS);
  private readonly supportedApis = new Set<string>([
    'openai',
    'anthropic',
    'google-gemini',
    'ollama',
    'huggingface',
  ]);

  private readonly aliases: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    rb: 'ruby',
    sh: 'bash',
    ps1: 'powershell',
    postgres: 'postgresql',
    pg: 'postgresql',
    node: 'nodejs',
    tailwind: 'tailwindcss',
  };

  /**
   * Resolve an input string to canonical product name
   */
  public canonicalizeProduct(name: string): string {
    const norm = name.trim().toLowerCase().replace(/[\s_]+/g, '-');
    return this.aliases[norm] ?? norm;
  }

  /**
   * Determine domain category for a product
   */
  public getProductCategory(productName: string): ProductDomainType {
    const canonical = this.canonicalizeProduct(productName);
    if (this.languages.has(canonical)) return 'language';
    if (this.frameworks.has(canonical)) return 'framework';
    if (this.supportedApis.has(canonical)) return 'api';
    return 'unknown';
  }

  /**
   * Check if a product is in the official documentation catalog
   */
  public isSupported(productName: string): boolean {
    return this.getProductCategory(productName) !== 'unknown';
  }

  /**
   * Return base authority score for a source type (§1605, §1877)
   */
  public getBaseAuthority(sourceType: string): number {
    switch (sourceType) {
      case 'official-documentation':
      case 'official-docs':
        return OFFICIAL_DOC_AUTHORITY;
      case 'specification':
        return 0.97;
      case 'accepted-qa':
        return 0.78;
      case 'source-code':
        return 0.74;
      case 'encyclopedia':
        return 0.67;
      case 'educational-web':
        return 0.58;
      default:
        return 0.50;
    }
  }

  public listSupportedLanguages(): string[] {
    return Array.from(this.languages);
  }

  public listSupportedFrameworks(): string[] {
    return Array.from(this.frameworks);
  }
}
