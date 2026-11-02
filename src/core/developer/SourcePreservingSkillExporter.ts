/**
 * Phase PX-17: Source-Preserving Skill Exporter
 * PX17-T05
 */

import crypto from 'node:crypto';
import {
  SkillExportBundle,
  SkillChapter,
  SourceDocumentReference
} from './DeveloperTypes';

export interface ExportSkillInput {
  skillId: string;
  displayName: string;
  description: string;
  sourceDocuments: Array<{
    name: string;
    content: string;
  }>;
  customChapters?: Array<{ title: string; content: string }>;
  customGlossary?: Array<{ term: string; definition: string }>;
}

export class SourcePreservingSkillExporter {
  public generateSkillBundle(input: ExportSkillInput): SkillExportBundle {
    const sourceDigests: Record<string, string> = {};
    const chapters: SkillChapter[] = [];
    const glossary: SkillExportBundle['glossary'] = [];

    // Calculate cryptographic SHA-256 digests for all source documents
    for (const doc of input.sourceDocuments) {
      const digest = crypto.createHash('sha256').update(doc.content, 'utf8').digest('hex');
      sourceDigests[doc.name] = digest;

      // Extract sections / chapters from markdown headings
      const extractedChapters = this.extractChaptersFromDocument(doc.name, doc.content, digest);
      chapters.push(...extractedChapters);

      // Extract bold terminology for glossary
      const extractedTerms = this.extractGlossaryFromDocument(doc.name, doc.content);
      glossary.push(...extractedTerms);
    }

    // Append custom chapters if provided
    if (input.customChapters) {
      for (let i = 0; i < input.customChapters.length; i++) {
        const c = input.customChapters[i];
        chapters.push({
          id: `custom-ch-${i + 1}`,
          title: c.title,
          content: c.content,
          sourceReferences: []
        });
      }
    }

    if (input.customGlossary) {
      for (const g of input.customGlossary) {
        glossary.push({
          term: g.term,
          definition: g.definition,
          source: 'User Defined'
        });
      }
    }

    // Generate SKILL.md with YAML frontmatter
    const skillMarkdown = this.formatSkillMarkdown(input, sourceDigests, chapters);
    const cheatsheet = this.generateCheatsheet(input.displayName, chapters, glossary);

    return {
      skillId: input.skillId.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      displayName: input.displayName,
      version: '1.0.0',
      description: input.description,
      sourceDigests,
      skillMarkdown,
      chapters,
      glossary,
      cheatsheet,
      exportedAt: new Date().toISOString()
    };
  }

  private extractChaptersFromDocument(docName: string, content: string, digest: string): SkillChapter[] {
    const chapters: SkillChapter[] = [];
    const lines = content.split(/\r?\n/);
    let currentTitle = 'Overview';
    let currentBuffer: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
      if (headingMatch) {
        if (currentBuffer.length > 0) {
          chapters.push({
            id: `ch-${chapters.length + 1}`,
            title: currentTitle,
            content: currentBuffer.join('\n').trim(),
            sourceReferences: [
              {
                documentName: docName,
                sourceDigest: digest,
                pageOrChapter: currentTitle
              }
            ]
          });
          currentBuffer = [];
        }
        currentTitle = headingMatch[1].trim();
      } else {
        currentBuffer.push(line);
      }
    }

    if (currentBuffer.length > 0) {
      chapters.push({
        id: `ch-${chapters.length + 1}`,
        title: currentTitle,
        content: currentBuffer.join('\n').trim(),
        sourceReferences: [
          {
            documentName: docName,
            sourceDigest: digest,
            pageOrChapter: currentTitle
          }
        ]
      });
    }

    return chapters;
  }

  private extractGlossaryFromDocument(docName: string, content: string): Array<{ term: string; definition: string; source: string }> {
    const terms: Array<{ term: string; definition: string; source: string }> = [];
    const boldMatches = Array.from(content.matchAll(/\*\*([^*]+)\*\*:\s*([^\n.]+)/g));

    for (const match of boldMatches) {
      terms.push({
        term: match[1].trim(),
        definition: match[2].trim(),
        source: docName
      });
    }
    return terms;
  }

  private formatSkillMarkdown(
    input: ExportSkillInput,
    digests: Record<string, string>,
    chapters: SkillChapter[]
  ): string {
    const sourcesYaml = Object.entries(digests)
      .map(([name, hash]) => `  - name: "${name}"\n    sha256: "${hash}"`)
      .join('\n');

    return `---
name: ${input.displayName}
id: ${input.skillId}
version: 1.0.0
description: ${input.description}
sources:
${sourcesYaml}
---

# ${input.displayName}

${input.description}

## Sources and Provenance
This skill was generated preserving the following authoritative sources:
${Object.entries(digests).map(([name, hash]) => `- **${name}** (SHA-256: \`${hash.slice(0, 16)}...\`)`).join('\n')}

## Core Workflow & Instructions
${chapters.slice(0, 3).map(c => `### ${c.title}\n${c.content.slice(0, 300)}...`).join('\n\n')}

## Chapters On-Demand
${chapters.map(c => `- \`${c.id}\`: **${c.title}**`).join('\n')}
`;
  }

  private generateCheatsheet(
    skillName: string,
    chapters: SkillChapter[],
    glossary: Array<{ term: string; definition: string }>
  ): string {
    return `# ${skillName} — Quick Reference Cheatsheet

## Key Concepts
${glossary.slice(0, 10).map(g => `- **${g.term}**: ${g.definition}`).join('\n')}

## Quick Rules
1. Refer to source documents when uncertain.
2. Validate inputs before triggering actions.
3. Keep operations deterministic and auditable.
`;
  }
}
