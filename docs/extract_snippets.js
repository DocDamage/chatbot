/**
 * Extract code snippets from cloned repositories
 * Parses markdown files and extracts title, tags, description, and code
 */

const fs = require('fs');
const path = require('path');

const SNIPPETS_DIR = './30-seconds-of-csharp/snippets';
const CSHARP_EXAMPLES_DIR = './C_Sharp_Examples';
const OUTPUT_FILE = './extracted_snippets.json';

function parseMarkdownSnippet(content, filename) {
    const lines = content.split('\n');
    let title = '';
    let tags = [];
    let description = '';
    let code = '';
    let usage = '';

    let inFrontmatter = false;
    let inCode = false;
    let codeBlockCount = 0;
    let descriptionLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.trim() === '---') {
            inFrontmatter = !inFrontmatter;
            continue;
        }

        if (inFrontmatter) {
            if (line.startsWith('title:')) {
                title = line.replace('title:', '').trim();
            } else if (line.startsWith('tags:')) {
                tags = line.replace('tags:', '').trim().split(',').map(t => t.trim());
            }
            continue;
        }

        if (line.startsWith('```csharp')) {
            inCode = true;
            codeBlockCount++;
            continue;
        }

        if (line.startsWith('```') && inCode) {
            inCode = false;
            continue;
        }

        if (inCode) {
            if (codeBlockCount === 1) {
                code += line + '\n';
            } else {
                usage += line + '\n';
            }
            continue;
        }

        if (!inFrontmatter && !inCode && line.trim() && codeBlockCount === 0) {
            descriptionLines.push(line);
        }
    }

    description = descriptionLines.join(' ').trim();

    return {
        title: title || filename.replace('.md', ''),
        tags,
        description,
        code: code.trim(),
        usage: usage.trim(),
        source: '30-seconds-of-csharp',
        language: 'csharp'
    };
}

function extractCSharpExample(dirPath, dirName) {
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.cs'));
    const readmeFile = fs.readdirSync(dirPath).find(f => f.toLowerCase() === 'readme.md');

    let description = '';
    if (readmeFile) {
        description = fs.readFileSync(path.join(dirPath, readmeFile), 'utf8').substring(0, 500);
    }

    const codeFiles = {};
    for (const file of files) {
        const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
        codeFiles[file] = content;
    }

    return {
        title: dirName.replace(/_/g, ' '),
        tags: inferTags(dirName),
        description,
        codeFiles,
        source: 'C_Sharp_Examples',
        language: 'csharp'
    };
}

function inferTags(dirName) {
    const tagMap = {
        'Async': ['async', 'await', 'task'],
        'LINQ': ['linq', 'query', 'enumerable'],
        'SOLID': ['solid', 'design-principles'],
        'Pattern': ['design-pattern'],
        'Delegate': ['delegate', 'events'],
        'Exception': ['error-handling', 'try-catch'],
        'Thread': ['threading', 'concurrency'],
        'ref': ['ref', 'parameters'],
        'out': ['out', 'parameters']
    };

    const tags = [];
    for (const [key, values] of Object.entries(tagMap)) {
        if (dirName.includes(key)) {
            tags.push(...values);
        }
    }
    return tags.length > 0 ? tags : ['csharp', 'example'];
}

function main() {
    const allSnippets = [];

    // Extract 30-seconds-of-csharp snippets
    if (fs.existsSync(SNIPPETS_DIR)) {
        const files = fs.readdirSync(SNIPPETS_DIR).filter(f => f.endsWith('.md'));
        console.log(`Found ${files.length} snippet files`);

        for (const file of files) {
            const content = fs.readFileSync(path.join(SNIPPETS_DIR, file), 'utf8');
            const snippet = parseMarkdownSnippet(content, file);
            allSnippets.push(snippet);
        }
    }

    // Extract C_Sharp_Examples
    if (fs.existsSync(CSHARP_EXAMPLES_DIR)) {
        const dirs = fs.readdirSync(CSHARP_EXAMPLES_DIR, { withFileTypes: true })
            .filter(d => d.isDirectory() && !d.name.startsWith('.'))
            .map(d => d.name);
        console.log(`Found ${dirs.length} example directories`);

        for (const dir of dirs) {
            const example = extractCSharpExample(path.join(CSHARP_EXAMPLES_DIR, dir), dir);
            if (Object.keys(example.codeFiles).length > 0) {
                allSnippets.push(example);
            }
        }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allSnippets, null, 2));
    console.log(`Extracted ${allSnippets.length} snippets to ${OUTPUT_FILE}`);
}

main();
