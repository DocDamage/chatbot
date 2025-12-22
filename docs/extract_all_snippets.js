/**
 * Comprehensive snippet extraction from ALL cloned repositories
 * Extracts code snippets with descriptions from multiple sources
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = './all_extracted_snippets.json';
const allSnippets = [];

// 1. 30-seconds-of-csharp snippets (markdown with frontmatter)
function extract30SecondsCSharp() {
    const dir = './30-seconds-of-csharp/snippets';
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    console.log(`[30-seconds-of-csharp] Found ${files.length} snippets`);

    for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        const snippet = parseMarkdownSnippet(content, file, '30-seconds-of-csharp', 'csharp');
        if (snippet.code) allSnippets.push(snippet);
    }
}

// 2. 30-seconds-of-code snippets (JS, CSS, Python, React, Git, HTML)
function extract30SecondsOfCode() {
    const baseDir = './30-seconds-of-code/content/snippets';
    if (!fs.existsSync(baseDir)) return;

    const langDirs = ['js', 'css', 'python', 'react', 'git', 'html'];

    for (const lang of langDirs) {
        // Check for nested s/ directory (new structure)
        let langDir = path.join(baseDir, lang, 's');
        if (!fs.existsSync(langDir)) {
            langDir = path.join(baseDir, lang); // Fall back to old structure
        }
        if (!fs.existsSync(langDir)) continue;

        const files = fs.readdirSync(langDir).filter(f => f.endsWith('.md'));
        console.log(`[30-seconds-of-code/${lang}] Found ${files.length} snippets`);

        for (const file of files) {
            try {
                const content = fs.readFileSync(path.join(langDir, file), 'utf8');
                const snippet = parseMarkdownSnippet(content, file, `30-seconds-of-code/${lang}`, lang);
                if (snippet.code || snippet.description) allSnippets.push(snippet);
            } catch (e) {
                // Skip unreadable files
            }
        }
    }
}

// 3. C# Examples (full project examples)
function extractCSharpExamples() {
    const dir = './C_Sharp_Examples';
    if (!fs.existsSync(dir)) return;

    const dirs = fs.readdirSync(dir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('.'))
        .map(d => d.name);

    console.log(`[C_Sharp_Examples] Found ${dirs.length} example directories`);

    for (const exampleDir of dirs) {
        const examplePath = path.join(dir, exampleDir);
        const csFiles = fs.readdirSync(examplePath).filter(f => f.endsWith('.cs'));

        if (csFiles.length === 0) continue;

        const codeFiles = {};
        let totalCode = '';
        for (const file of csFiles.slice(0, 5)) { // Limit to 5 files per example
            const content = fs.readFileSync(path.join(examplePath, file), 'utf8');
            codeFiles[file] = content.substring(0, 5000); // Limit size
            totalCode += content.substring(0, 2000);
        }

        allSnippets.push({
            title: exampleDir.replace(/_/g, ' '),
            tags: inferTagsFromName(exampleDir),
            description: `C# example project demonstrating ${exampleDir.replace(/_/g, ' ')}`,
            code: totalCode.substring(0, 8000),
            source: 'C_Sharp_Examples',
            language: 'csharp',
            files: Object.keys(codeFiles)
        });
    }
}

// 4. JDHP Snippets (multi-language)
function extractJDHPSnippets() {
    const baseDir = './snippets';
    if (!fs.existsSync(baseDir)) return;

    const languages = [
        { dir: 'python', lang: 'python', limit: 100 },
        { dir: 'cpp', lang: 'cpp', limit: 50 },
        { dir: 'javascript', lang: 'javascript', limit: 50 },
        { dir: 'java', lang: 'java', limit: 30 },
        { dir: 'c', lang: 'c', limit: 30 },
        { dir: 'bash', lang: 'bash', limit: 20 },
        { dir: 'go', lang: 'go', limit: 10 },
    ];

    for (const { dir, lang, limit } of languages) {
        const langDir = path.join(baseDir, dir);
        if (!fs.existsSync(langDir)) continue;

        extractLanguageSnippets(langDir, lang, limit, 'jdhp-snippets');
    }
}

// 5. ServiceNow Code Snippets
function extractServiceNowSnippets() {
    const baseDir = './code-snippets';
    if (!fs.existsSync(baseDir)) return;

    const categories = [
        'Core ServiceNow APIs',
        'Server-Side Components',
        'Client-Side Components',
        'Modern Development',
        'Integration',
        'Specialized Areas'
    ];

    for (const category of categories) {
        const catDir = path.join(baseDir, category);
        if (!fs.existsSync(catDir)) continue;

        extractServiceNowCategory(catDir, category, 30);
    }
}

function extractServiceNowCategory(dir, category, limit) {
    let count = 0;

    function walkDir(currentDir) {
        if (count >= limit) return;

        const items = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const item of items) {
            if (count >= limit) return;

            if (item.isDirectory()) {
                walkDir(path.join(currentDir, item.name));
            } else if (item.name.endsWith('.md') || item.name.endsWith('.js')) {
                const content = fs.readFileSync(path.join(currentDir, item.name), 'utf8');
                const snippet = parseServiceNowSnippet(content, item.name, category);
                if (snippet) {
                    allSnippets.push(snippet);
                    count++;
                }
            }
        }
    }

    walkDir(dir);
    console.log(`[ServiceNow/${category}] Extracted ${count} snippets`);
}

function parseServiceNowSnippet(content, filename, category) {
    // Extract code blocks from markdown or use whole file for .js
    let code = '';
    let description = '';

    if (filename.endsWith('.md')) {
        const codeMatch = content.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
        if (codeMatch) code = codeMatch[1];

        // Get first paragraph as description
        const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('```'));
        description = lines.slice(0, 3).join(' ').substring(0, 500);
    } else {
        code = content.substring(0, 5000);
        description = `ServiceNow ${category} script`;
    }

    if (!code) return null;

    return {
        title: filename.replace(/\.(md|js)$/, '').replace(/[-_]/g, ' '),
        tags: ['servicenow', category.toLowerCase().replace(/ /g, '-')],
        description,
        code,
        source: `ServiceNow/${category}`,
        language: 'javascript'
    };
}

function extractLanguageSnippets(langDir, language, limit, source) {
    let count = 0;

    function walkDir(currentDir, depth = 0) {
        if (count >= limit || depth > 3) return;

        try {
            const items = fs.readdirSync(currentDir, { withFileTypes: true });

            for (const item of items) {
                if (count >= limit) return;

                if (item.isDirectory() && !item.name.startsWith('.')) {
                    walkDir(path.join(currentDir, item.name), depth + 1);
                } else if (isCodeFile(item.name, language)) {
                    try {
                        const filePath = path.join(currentDir, item.name);
                        const stat = fs.lstatSync(filePath);
                        if (stat.isSymbolicLink()) continue; // Skip symlinks

                        const content = fs.readFileSync(filePath, 'utf8');
                        if (content.length > 50 && content.length < 20000) {
                            allSnippets.push({
                                title: item.name.replace(/\.[^.]+$/, ''),
                                tags: inferTagsFromPath(currentDir, langDir),
                                description: extractFirstComment(content, language),
                                code: content.substring(0, 8000),
                                source,
                                language
                            });
                            count++;
                        }
                    } catch (e) {
                        // Skip files that can't be read (symlinks, permissions, etc.)
                    }
                }
            }
        } catch (e) {
            // Skip directories that can't be read
        }
    }

    walkDir(langDir);
    console.log(`[${source}/${language}] Extracted ${count} snippets`);
}


function isCodeFile(filename, language) {
    const extMap = {
        python: ['.py'],
        cpp: ['.cpp', '.hpp', '.h', '.cc'],
        javascript: ['.js', '.mjs'],
        java: ['.java'],
        c: ['.c', '.h'],
        bash: ['.sh', '.bash'],
        go: ['.go']
    };
    return (extMap[language] || []).some(ext => filename.endsWith(ext));
}

function parseMarkdownSnippet(content, filename, source, language) {
    const lines = content.split('\n');
    let title = filename.replace('.md', '');
    let tags = [];
    let description = '';
    let code = '';
    let inFrontmatter = false;
    let inCode = false;
    let descLines = [];

    for (const line of lines) {
        if (line.trim() === '---') {
            inFrontmatter = !inFrontmatter;
            continue;
        }

        if (inFrontmatter) {
            if (line.startsWith('title:')) title = line.replace('title:', '').trim().replace(/^["']|["']$/g, '');
            else if (line.startsWith('tags:')) tags = line.replace('tags:', '').trim().split(',').map(t => t.trim());
            continue;
        }

        if (line.startsWith('```') && !inCode) {
            inCode = true;
            continue;
        }
        if (line.startsWith('```') && inCode) {
            inCode = false;
            continue;
        }

        if (inCode && !code) {
            code += line + '\n';
        } else if (inCode) {
            code += line + '\n';
        } else if (!inFrontmatter && line.trim() && !code) {
            descLines.push(line);
        }
    }

    return {
        title,
        tags,
        description: descLines.join(' ').substring(0, 500),
        code: code.trim(),
        source,
        language
    };
}

function extractFirstComment(content, language) {
    // Extract first docstring or comment block
    if (language === 'python') {
        const match = content.match(/^(?:'''|""")([\s\S]*?)(?:'''|""")/m);
        if (match) return match[1].trim().substring(0, 300);
    }

    const match = content.match(/^\/\*\*([\s\S]*?)\*\//m) || content.match(/^\/\/(.*)/m);
    if (match) return match[1].replace(/\*/g, '').trim().substring(0, 300);

    return '';
}

function inferTagsFromName(name) {
    const tagMap = {
        'Async': ['async', 'await', 'task'],
        'LINQ': ['linq', 'query'],
        'SOLID': ['solid', 'design-principles'],
        'Pattern': ['design-pattern'],
        'Delegate': ['delegate', 'events'],
        'Thread': ['threading', 'concurrency'],
        'Exception': ['error-handling']
    };

    const tags = ['csharp'];
    for (const [key, values] of Object.entries(tagMap)) {
        if (name.includes(key)) tags.push(...values);
    }
    return tags;
}

function inferTagsFromPath(currentDir, baseDir) {
    const relative = path.relative(baseDir, currentDir);
    return relative.split(path.sep).filter(p => p && !p.startsWith('.')).slice(0, 2);
}

// Main execution
console.log('Starting comprehensive snippet extraction...\n');

extract30SecondsCSharp();
extract30SecondsOfCode();
extractCSharpExamples();
extractJDHPSnippets();
extractServiceNowSnippets();

// Write output
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allSnippets, null, 2));
console.log(`\n=== TOTAL: ${allSnippets.length} snippets extracted to ${OUTPUT_FILE} ===`);

// Summary by source
const bySrc = {};
for (const s of allSnippets) {
    bySrc[s.source] = (bySrc[s.source] || 0) + 1;
}
console.log('\nBy source:');
for (const [src, count] of Object.entries(bySrc).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${src}: ${count}`);
}
