import fs from 'fs';
import path from 'path';

interface SkillSource {
  file: string;
  title: string;
  content: string;
}

/**
 * Create a book-to-skill-compatible, on-demand Markdown bundle from local
 * documentation. This deliberately preserves source files instead of making
 * unsupported claims about AI-generated summaries; an agent can refine the
 * bundle later with book-to-skill if desired.
 */
function main(): void {
  const [, , sourceArg, outputArg = '.agents/skills/project-knowledge'] = process.argv;
  if (!sourceArg) {
    throw new Error('Usage: npm run export:skill -- <file-or-directory> [output-directory]');
  }

  const sourcePath = path.resolve(sourceArg);
  const outputPath = path.resolve(outputArg);
  const sources = collectSources(sourcePath);
  if (sources.length === 0) throw new Error(`No Markdown or text sources found at ${sourcePath}`);

  fs.mkdirSync(path.join(outputPath, 'chapters'), { recursive: true });
  const chapterEntries = sources.map((source, index) => {
    const chapterName = `ch${String(index + 1).padStart(2, '0')}-${slugify(source.title)}.md`;
    fs.writeFileSync(path.join(outputPath, 'chapters', chapterName), `# ${source.title}\n\nSource: \`${source.file}\`\n\n${source.content.trim()}\n`, 'utf8');
    return { chapterName, title: source.title, file: source.file };
  });

  const index = chapterEntries.map(entry => `- [${entry.title}](chapters/${entry.chapterName}) — \`${entry.file}\``).join('\n');
  fs.writeFileSync(path.join(outputPath, 'SKILL.md'), [
    '---',
    'name: project-knowledge',
    'description: On-demand project documentation assembled from local sources.',
    '---',
    '',
    '# Project knowledge',
    '',
    'Load the relevant chapter before making claims about this project. The source files remain authoritative.',
    '',
    '## Chapter index',
    '',
    index,
    '',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(outputPath, 'glossary.md'), '# Glossary\n\nAdd domain terms and chapter links here as the project evolves.\n', 'utf8');
  fs.writeFileSync(path.join(outputPath, 'cheatsheet.md'), '# Cheatsheet\n\nUse `SKILL.md` to find the relevant chapter, then read only that chapter.\n', 'utf8');

  console.log(JSON.stringify({ outputPath, sourceCount: sources.length, chapters: chapterEntries.map(entry => entry.chapterName) }, null, 2));
}

function collectSources(sourcePath: string): SkillSource[] {
  const files = fs.statSync(sourcePath).isDirectory()
    ? listFiles(sourcePath)
    : [sourcePath];
  return files
    .filter(file => ['.md', '.markdown', '.txt', '.rst', '.adoc'].includes(path.extname(file).toLowerCase()))
    .map(file => ({ file: path.relative(process.cwd(), file), title: titleFor(file), content: fs.readFileSync(file, 'utf8') }));
}

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const child = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(child) : [child];
  });
}

function titleFor(file: string): string {
  return path.basename(file, path.extname(file)).replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chapter';
}

main();
