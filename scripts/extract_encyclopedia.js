/**
 * Encyclopedia Extractor - Properly sections the encyclopedia into individual entries
 */

const fs = require('fs');
const path = require('path');

// Category mapping based on section titles
const CATEGORY_MAP = {
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

function getCategory(title) {
    const normalized = title.toLowerCase().trim();
    for (const key of Object.keys(CATEGORY_MAP)) {
        if (normalized.includes(key) || key.includes(normalized.replace(/\s+/g, ''))) {
            return CATEGORY_MAP[key];
        }
    }
    // Try partial matches
    if (normalized.includes('css')) return 'frontend';
    if (normalized.includes('react')) return 'frontend';
    if (normalized.includes('javascript') || normalized.includes('js')) return 'frontend';
    if (normalized.includes('python')) return 'backend';
    if (normalized.includes('django') || normalized.includes('fastapi')) return 'backend';
    if (normalized.includes('database') || normalized.includes('sql')) return 'database';
    if (normalized.includes('deploy') || normalized.includes('cloud')) return 'deployment';
    if (normalized.includes('three') || normalized.includes('3d')) return '3d';
    if (normalized.includes('state')) return 'state';
    if (normalized.includes('ai') || normalized.includes('react apps')) return 'ai';
    return 'encyclopedia';
}

function extractEncyclopedia() {
    const mdPath = path.resolve(process.cwd(), 'docs/encyclopedia_full_text.md');
    const content = fs.readFileSync(mdPath, 'utf-8');

    // Clean up escaped characters using split/join
    let cleanContent = content;
    const replacements = [
        ['\\\\', ''],
        ['\\#', '#'],
        ['\\-', '-'],
        ['\\.', '.'],
        ['\\(', '('],
        ['\\)', ')'],
        ['\\[', '['],
        ['\\]', ']'],
        ['\\{', '{'],
        ['\\}', '}'],
        ['\\_', '_'],
        ['\\`', '`'],
        ['\\&', '&'],
        ['\\*', '*']
    ];

    for (const [from, to] of replacements) {
        cleanContent = cleanContent.split(from).join(to);
    }

    const entries = [];
    let entryCount = 0;

    // Split by "---" which separates major sections
    const majorSections = cleanContent.split('---');
    console.log('Found ' + majorSections.length + ' major sections by --- delimiter');

    for (let i = 0; i < majorSections.length; i++) {
        const section = majorSections[i].trim();
        if (section.length < 200) continue;  // Skip tiny sections

        // Try to extract section title from first line or ## header
        let title = 'Encyclopedia Section ' + i;
        const lines = section.split('\n');

        for (const line of lines.slice(0, 10)) {
            // Look for ## Header Source: pattern
            if (line.includes('##') && line.length > 5) {
                title = line.replace(/##/g, '').replace(/Source:.*$/, '').trim();
                if (title.length > 3) break;
            }
            // Look for Source: `filename.md` pattern
            if (line.includes('Source:') && line.includes('.md')) {
                const match = line.match(/`([^`]+)\.md`/);
                if (match) {
                    title = match[1].replace(/_/g, ' ').replace(/bible/gi, ' Bible').trim();
                    break;
                }
            }
        }

        const category = getCategory(title);
        console.log('  Section ' + i + ': "' + title.substring(0, 50) + '..." -> category: ' + category);

        // Split this section into chunks of ~3500 chars
        const chunkSize = 3500;
        let chunkNum = 0;
        let remaining = section;

        while (remaining.length > 100) {
            let chunk = remaining.substring(0, chunkSize);

            // Try to end at a paragraph or sentence break
            if (remaining.length > chunkSize) {
                const lastParagraph = chunk.lastIndexOf('\n\n');
                const lastSentence = Math.max(
                    chunk.lastIndexOf('. '),
                    chunk.lastIndexOf('.\n')
                );

                if (lastParagraph > chunkSize * 0.5) {
                    chunk = chunk.substring(0, lastParagraph);
                } else if (lastSentence > chunkSize * 0.5) {
                    chunk = chunk.substring(0, lastSentence + 1);
                }
            }

            remaining = remaining.substring(chunk.length).trim();

            if (chunk.trim().length < 100) continue;

            chunkNum++;
            entries.push({
                id: 'enc_' + category + '_' + entryCount++,
                category: category,
                title: title + ' (Part ' + chunkNum + ')',
                content: chunk.trim(),
                tags: [category, 'encyclopedia', title.toLowerCase().replace(/\s+/g, '_').substring(0, 30)],
                source: 'Code_Encyclopedia_Master'
            });
        }

        console.log('    Created ' + chunkNum + ' entries');
    }

    console.log('\nTotal encyclopedia entries: ' + entries.length);
    return entries;
}

function main() {
    // Load existing entries
    const existingPath = path.resolve(process.cwd(), 'src/data/coding_knowledge_static.json');
    let existingEntries = [];

    if (fs.existsSync(existingPath)) {
        const data = JSON.parse(fs.readFileSync(existingPath, 'utf-8'));
        // Keep only gemini_md entries, remove old encyclopedia entries
        existingEntries = data.filter(function (e) {
            return e.source === 'gemini_md' || (e.tags && e.tags.includes('gemini_md'));
        });
        console.log('Kept ' + existingEntries.length + ' entries from gemini_md\n');
    }

    // Extract new encyclopedia entries
    const newEntries = extractEncyclopedia();

    // Combine and save
    const allEntries = existingEntries.concat(newEntries);
    fs.writeFileSync(existingPath, JSON.stringify(allEntries, null, 2));

    console.log('\n✅ EXTRACTION COMPLETE');
    console.log('   Total entries saved: ' + allEntries.length);
    console.log('   - Gemini MD entries: ' + existingEntries.length);
    console.log('   - Encyclopedia entries: ' + newEntries.length);
}

main();
