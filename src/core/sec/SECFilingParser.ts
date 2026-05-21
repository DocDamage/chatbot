import * as crypto from 'crypto';
import * as cheerio from 'cheerio';

export interface ParsedSECDocument {
  sequence: number;
  filename: string;
  description?: string;
  documentType?: string;
  content?: string;
}

export interface ParsedSECSection {
  itemCode: string;
  itemTitle: string;
  sectionOrder: number;
  sectionText: string;
  startOffset: number;
  endOffset: number;
  confidence: number;
}

export interface ParsedSECChunk {
  sectionOrder?: number;
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

export interface ParsedSECFiling {
  text: string;
  contentHash: string;
  documents: ParsedSECDocument[];
  sections: ParsedSECSection[];
  chunks: ParsedSECChunk[];
}

export interface NormalizedXBRLFact {
  taxonomy: string;
  concept: string;
  label?: string;
  description?: string;
  unit?: string;
  valueNumeric?: number;
  valueText?: string;
  periodStart?: string;
  periodEnd?: string;
  fiscalYear?: number;
  fiscalPeriod?: string;
  formType?: string;
  accessionNumber?: string;
  frame?: string;
  filedDate?: string;
  metadata: Record<string, unknown>;
}

const ITEM_PATTERN = /(?:^|\n)\s*(Item\s+(?:1A|1B|1C|1|2|3|4|5|6|7A|7|8|9A|9B|9C|9|10|11|12|13|14|15|16)\.?\s*[-—: ]+[^\n]{0,160})/gi;

export class SECFilingParser {
  parse(rawContent: string, options: { formType?: string } = {}): ParsedSECFiling {
    const text = this.toPlainText(rawContent);
    const documents = this.extractDocuments(rawContent);
    const sections = this.extractSections(text, options.formType);
    const chunks = this.createChunks(sections.length ? sections : [{
      itemCode: 'FULL',
      itemTitle: 'Full filing',
      sectionOrder: 0,
      sectionText: text,
      startOffset: 0,
      endOffset: text.length,
      confidence: 0.25
    }]);

    return {
      text,
      contentHash: crypto.createHash('sha256').update(rawContent).digest('hex'),
      documents,
      sections,
      chunks
    };
  }

  normalizeCompanyFacts(companyFacts: any): NormalizedXBRLFact[] {
    const facts: NormalizedXBRLFact[] = [];
    const factsRoot = companyFacts?.facts || {};

    for (const [taxonomy, concepts] of Object.entries<any>(factsRoot)) {
      for (const [concept, conceptPayload] of Object.entries<any>(concepts || {})) {
        const units = conceptPayload?.units || {};
        for (const [unit, unitFacts] of Object.entries<any[]>(units)) {
          for (const fact of unitFacts || []) {
            facts.push({
              taxonomy,
              concept,
              label: conceptPayload?.label,
              description: conceptPayload?.description,
              unit,
              valueNumeric: typeof fact.val === 'number' ? fact.val : Number.isFinite(Number(fact.val)) ? Number(fact.val) : undefined,
              valueText: typeof fact.val === 'number' ? undefined : fact.val === undefined || fact.val === null ? undefined : String(fact.val),
              periodStart: fact.start,
              periodEnd: fact.end,
              fiscalYear: fact.fy === undefined || fact.fy === null ? undefined : Number(fact.fy),
              fiscalPeriod: fact.fp,
              formType: fact.form,
              accessionNumber: fact.accn,
              frame: fact.frame,
              filedDate: fact.filed,
              metadata: {
                raw: fact,
                decimals: fact.decimals
              }
            });
          }
        }
      }
    }

    return facts;
  }

  private toPlainText(rawContent: string): string {
    const looksHtml = /<html|<body|<document|<table|<div|<p\b|<ix:/i.test(rawContent);
    if (!looksHtml) return this.normalizeWhitespace(rawContent);

    const $ = cheerio.load(rawContent, { xmlMode: false });
    $('style,noscript').remove();
    const bodyText = $('body').text() || $.root().text() || rawContent;
    return this.normalizeWhitespace(bodyText);
  }

  private extractDocuments(rawContent: string): ParsedSECDocument[] {
    const documents: ParsedSECDocument[] = [];
    const documentPattern = /<DOCUMENT>([\s\S]*?)<\/DOCUMENT>/gi;
    let match: RegExpExecArray | null;
    let sequence = 0;

    while ((match = documentPattern.exec(rawContent)) !== null) {
      const block = match[1];
      const filename = this.extractTag(block, 'FILENAME') || `document_${sequence + 1}.txt`;
      const documentType = this.extractTag(block, 'TYPE');
      const description = this.extractTag(block, 'DESCRIPTION');
      const textMatch = block.match(/<TEXT>([\s\S]*?)<\/TEXT>/i);
      documents.push({
        sequence,
        filename: filename.trim(),
        documentType: documentType?.trim(),
        description: description?.trim(),
        content: textMatch?.[1]
      });
      sequence += 1;
    }

    return documents;
  }

  private extractSections(text: string, formType?: string): ParsedSECSection[] {
    if (formType && !['10-K', '10-K/A', '10-Q', '10-Q/A'].includes(formType)) {
      return [];
    }

    const markers: Array<{ title: string; index: number }> = [];
    let match: RegExpExecArray | null;
    const pattern = new RegExp(ITEM_PATTERN);
    while ((match = pattern.exec(text)) !== null) {
      markers.push({ title: match[1].trim(), index: match.index });
    }

    const deduped = markers.filter((marker, index, all) => {
      const previous = all[index - 1];
      return !previous || Math.abs(marker.index - previous.index) > 40 || marker.title !== previous.title;
    });

    return deduped.map((marker, index) => {
      const next = deduped[index + 1];
      const end = next ? next.index : text.length;
      const title = marker.title.replace(/\s+/g, ' ');
      const itemCode = (title.match(/Item\s+([0-9A-Z]+(?:\.[0-9A-Z]+)?)/i)?.[1] || `SECTION_${index + 1}`).toUpperCase();
      return {
        itemCode,
        itemTitle: title,
        sectionOrder: index,
        sectionText: text.slice(marker.index, end).trim(),
        startOffset: marker.index,
        endOffset: end,
        confidence: 0.78
      };
    }).filter(section => section.sectionText.length > 40);
  }

  private createChunks(sections: ParsedSECSection[]): ParsedSECChunk[] {
    const chunks: ParsedSECChunk[] = [];
    let chunkIndex = 0;
    const maxChars = 6000;
    const overlap = 600;

    for (const section of sections) {
      let cursor = 0;
      const text = section.sectionText;
      while (cursor < text.length) {
        const end = Math.min(cursor + maxChars, text.length);
        const content = text.slice(cursor, end).trim();
        if (content) {
          chunks.push({
            sectionOrder: section.sectionOrder,
            chunkIndex,
            content,
            tokenCount: Math.ceil(content.length / 4)
          });
          chunkIndex += 1;
        }
        if (end >= text.length) break;
        cursor = Math.max(end - overlap, cursor + 1);
      }
    }

    return chunks;
  }

  private extractTag(block: string, tag: string): string | undefined {
    const match = block.match(new RegExp(`<${tag}>\\s*([^\\n<]+)`, 'i'));
    return match?.[1];
  }

  private normalizeWhitespace(value: string): string {
    return String(value || '')
      .replace(/\r/g, '\n')
      .replace(/[\t ]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
