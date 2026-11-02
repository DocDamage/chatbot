/**
 * Developer QA Version Extractor (CRK Phase 13: CRK-P13-T06)
 * Extracts product and version signals from tags, title, text, and code.
 */

export interface ExtractedProductVersion {
  product: string;
  version?: string;
  confidence: number;
}

export class DeveloperQAVersionExtractor {
  private static readonly VERSION_TAG_REGEX =
    /^([a-z0-9_-]+)[-v]([0-9]+(?:\.[0-9]+)*(?:-?[a-z0-9]+)?)$/i;

  private static readonly KNOWN_FRAMEWORKS = [
    'react', 'nextjs', 'vue', 'angular', 'svelte', 'godot', 'unreal', 'unity',
    'python', 'typescript', 'javascript', 'rust', 'go', 'node', 'django', 'fastapi'
  ];

  public extract(tags: string[], title: string, body: string): ExtractedProductVersion[] {
    const results: ExtractedProductVersion[] = [];
    const seen = new Set<string>();

    // 1. Tag extraction (High confidence: 0.95 for versioned tags, 0.85 for unversioned)
    for (const tag of tags) {
      const lowerTag = tag.toLowerCase();
      const match = DeveloperQAVersionExtractor.VERSION_TAG_REGEX.exec(lowerTag);
      if (match) {
        const product = match[1];
        const version = match[2];
        const key = `${product}@${version}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ product, version, confidence: 0.95 });
        }
      } else if (DeveloperQAVersionExtractor.KNOWN_FRAMEWORKS.includes(lowerTag)) {
        if (!seen.has(lowerTag)) {
          seen.add(lowerTag);
          results.push({ product: lowerTag, confidence: 0.85 });
        }
      }
    }

    // 2. Title and body regex extraction (Medium/lower confidence: 0.65 - 0.70)
    const combinedText = `${title} ${body}`;
    for (const framework of DeveloperQAVersionExtractor.KNOWN_FRAMEWORKS) {
      const regex = new RegExp(`\\b${framework}\\s+(?:v|version\\s+)?([0-9]+(?:\\.[0-9]+)*)\\b`, 'i');
      const textMatch = regex.exec(combinedText);
      if (textMatch) {
        const version = textMatch[1];
        const key = `${framework}@${version}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ product: framework, version, confidence: 0.7 });
        }
      }
    }

    return results;
  }
}
