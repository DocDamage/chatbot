/**
 * Encyclopedia Extractor - Properly sections the encyclopedia into individual entries
 * Reads from the extracted markdown and creates properly structured JSON entries
 */

import * as fs from 'fs';
import * as path from 'path';

interface StaticKnowledgeEntry {
    id: string;
    category: string;
    title: string;
    content: string;
    tags: string[];
    source: string;
}

// Category mapping based on section titles
const CATEGORY_MAP: Record<string, string> = {
    'ai in react apps': 'ai',
    'cssbible': 'frontend',
    'database management bible': 'database',
    'deploymentcloud bible': 'deployment',
    'django backend frameworksbible': 'backend',
    'fastapi backend frameworksbible': 'backend',
    'geminigeminstructions': 'core',
    'helpful snippets': 'snippets',
    'javascriptbible': 'frontend',
    'next jsbible': 'frontend',
    'professional code verification': 'verification',
    'reactappbible': 'frontend',
    'state management bible': 'state',
    'theblackbookofpython': 'backend',
    'three jsbible': '3d'
};

function extractEncyclopedia(): StaticKnowledgeEntry[] {
    const mdPath = path.resolve(process.cwd(), 'docs/encyclopedia_full_text.md');
    const content = fs.readFileSync(mdPath, 'utf-8');

    // Clean up escaped characters
    const cleanContent = content
        .replace(/\\\\/g, '')
        .replace(/\\#/g, '#')
        .replace(/\\-/g, '-')
        .replace(/\\./g, '.')
        .replace(/\\(/g, '(')
        .replace(/\\)/g, ')')
        .replace(/\\[/g, '[')
            .replace(/\\]/g, ']')
            .replace(/\\{/g, '{')
            .replace(/\\}/g, '}')
            .replace(/\\_/g, '_')
            .replace(/\\`/g, '`')
            .replace(/\\&/g, '&')
            .replace(/\\\*/g, '*');

    const entries: StaticKnowledgeEntry[] = [];
    let entryCount = 0;

    // Split by major sections (## headers represent Bible sections)
    const sectionPattern = /## ([A-Za-z\s]+(?:Bible|Apps|Snippets|Verification|Instructions)?)\s*(?:Source:|$)/gi;
    const sections: { title: string; startIndex: number }[] = [];

    let match;
    while ((match = sectionPattern.exec(cleanContent)) !== null) {
        sections.push({
            title: match[1].trim(),
            startIndex: match.index
        });
    }

    console.log(`Found ${sections.length} major sections`);

    // Process each major section
    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const nextIndex = i + 1 < sections.length ? sections[i + 1].startIndex : cleanContent.length;
        const sectionContent = cleanContent.substring(section.startIndex, nextIndex);

        // Determine category
        const normalizedTitle = section.title.toLowerCase().trim();
        const category = CATEGORY_MAP[normalizedTitle] || 'encyclopedia';

        // Split into subsections by chapter/book headings
        const subsectionPattern = /(?:Chapter \d+|Book [IVXL]+|[IVXL]+\.|^A\.|^B\.|^C\.)\s*[:.]?\s*([^\n]+)/gm;
        const subsections: { title: string; startIndex: number }[] = [];

        let subMatch;
        while ((subMatch = subsectionPattern.exec(sectionContent)) !== null) {
            subsections.push({
                title: subMatch[1]?.trim() || subMatch[0].trim(),
                startIndex: subMatch.index
            });
        }

        if (subsections.length > 0) {
            // Create entries for each subsection
            for (let j = 0; j < subsections.length; j++) {
                const sub = subsections[j];
                const nextSubIndex = j + 1 < subsections.length ? subsections[j + 1].startIndex : sectionContent.length;
                let subContent = sectionContent.substring(sub.startIndex, nextSubIndex).trim();

                // Skip very short entries
                if (subContent.length < 100) continue;

                // Truncate very long entries
                if (subContent.length > 8000) {
                    subContent = subContent.substring(0, 8000) + '\n\n[Content truncated...]';
                }

                const tags = [category, 'encyclopedia', section.title.toLowerCase().replace(/\s+/g, '_')];
                if (subContent.includes('function')) tags.push('code');
                if (subContent.includes('import ')) tags.push('import');

                entries.push({
                    id: `enc_${category}_${entryCount++}`,
                    category,
                    title: `${section.title} - ${sub.title}`,
                    content: subContent,
                    tags,
                    source: 'Code_Encyclopedia_Master'
                });
            }
        } else {
            // No subsections found, split by paragraphs (every 2000 chars approx)
            const paragraphs = sectionContent.split(/\n\n+/);
            let currentChunk = '';
            let chunkNum = 0;

            for (const para of paragraphs) {
                if (para.trim().length < 20) continue;

                if (currentChunk.length + para.length > 3000) {
                    // Save current chunk
                    if (currentChunk.trim().length > 100) {
                        entries.push({
                            id: `enc_${category}_${entryCount++}`,
                            category,
                            title: `${section.title} (Part ${++chunkNum})`,
                            content: currentChunk.trim(),
                            tags: [category, 'encyclopedia'],
                            source: 'Code_Encyclopedia_Master'
                        });
                    }
                    currentChunk = para;
                } else {
                    currentChunk += '\n\n' + para;
                }
            }

            // Save final chunk
            if (currentChunk.trim().length > 100) {
                entries.push({
                    id: `enc_${category}_${entryCount++}`,
                    category,
                    title: `${section.title} (Part ${++chunkNum})`,
                    content: currentChunk.trim(),
                    tags: [category, 'encyclopedia'],
                    source: 'Code_Encyclopedia_Master'
                });
            }
        }
    }

    console.log(`Created ${entries.length} encyclopedia entries`);
    return entries;
}

function main() {
    // Load existing entries from gemini_md
    const existingPath = path.resolve(process.cwd(), 'src/data/coding_knowledge_static.json');
    let existingEntries: StaticKnowledgeEntry[] = [];

    if (fs.existsSync(existingPath)) {
        const data = JSON.parse(fs.readFileSync(existingPath, 'utf-8'));
        // Keep only gemini_md entries, remove old encyclopedia entries
        existingEntries = data.filter((e: StaticKnowledgeEntry) =>
            e.source === 'gemini_md' || e.tags?.includes('gemini_md')
        );
        console.log(`Kept ${existingEntries.length} entries from gemini_md`);
    }

    // Extract new encyclopedia entries
    const newEntries = extractEncyclopedia();

    // Combine and save
    const allEntries = [...existingEntries, ...newEntries];
    fs.writeFileSync(existingPath, JSON.stringify(allEntries, null, 2));

    console.log(`\n✅ Total entries saved: ${allEntries.length}`);
    console.log(`   - Gemini MD entries: ${existingEntries.length}`);
    console.log(`   - Encyclopedia entries: ${newEntries.length}`);
}

main();
