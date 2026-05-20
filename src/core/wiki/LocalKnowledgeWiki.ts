import * as fs from 'fs';
import * as path from 'path';

export interface WikiPage {
  slug: string;
  title: string;
  filePath: string;
  frontmatter: Record<string, string>;
  content: string;
}

export class LocalKnowledgeWiki {
  constructor(private readonly rootDir: string = path.join(process.cwd(), 'knowledge-base-public', 'wiki')) {}

  list(): WikiPage[] {
    this.ensureRoot();
    return this.walk(this.rootDir)
      .filter(file => file.endsWith('.md'))
      .map(file => this.readByPath(file));
  }

  search(query: string): WikiPage[] {
    const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (tokens.length === 0) return [];
    return this.list()
      .map(page => ({
        page,
        score: tokens.filter(token => `${page.title} ${page.content}`.toLowerCase().includes(token)).length
      }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(result => result.page);
  }

  read(slug: string): WikiPage {
    const filePath = this.resolveSlug(slug);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Wiki page not found: ${slug}`);
    }
    return this.readByPath(filePath);
  }

  write(input: { slug: string; title: string; content: string; frontmatter?: Record<string, string> }): WikiPage {
    this.ensureRoot();
    const filePath = this.resolveSlug(input.slug);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const frontmatter = {
      title: input.title,
      authority: 'canonical',
      last_updated: new Date().toISOString().slice(0, 10),
      ...(input.frontmatter || {})
    };
    const body = [
      '---',
      ...Object.entries(frontmatter).map(([key, value]) => `${key}: ${JSON.stringify(value)}`),
      '---',
      '',
      input.content.trim(),
      ''
    ].join('\n');
    fs.writeFileSync(filePath, body);
    return this.readByPath(filePath);
  }

  private readByPath(filePath: string): WikiPage {
    const raw = fs.readFileSync(filePath, 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    const frontmatter: Record<string, string> = {};
    let content = raw;
    if (match) {
      content = match[2].trim();
      for (const line of match[1].split(/\r?\n/)) {
        const separator = line.indexOf(':');
        if (separator === -1) continue;
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^"|"$/g, '');
        frontmatter[key] = value;
      }
    }

    const relative = path.relative(this.rootDir, filePath).replace(/\\/g, '/');
    const slug = relative.replace(/\.md$/, '');
    return {
      slug,
      title: frontmatter.title || this.titleFromSlug(slug),
      filePath,
      frontmatter,
      content
    };
  }

  private resolveSlug(slug: string): string {
    const safeSlug = slug.replace(/\\/g, '/').replace(/\.\./g, '').replace(/^\/+/, '').replace(/\.md$/, '');
    const resolved = path.resolve(this.rootDir, `${safeSlug}.md`);
    const relative = path.relative(this.rootDir, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Wiki slug escapes root: ${slug}`);
    }
    return resolved;
  }

  private ensureRoot(): void {
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  private walk(directoryPath: string): string[] {
    if (!fs.existsSync(directoryPath)) return [];
    return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap(entry => {
      const entryPath = path.join(directoryPath, entry.name);
      return entry.isDirectory() ? this.walk(entryPath) : [entryPath];
    });
  }

  private titleFromSlug(slug: string): string {
    return slug.split('/').pop()!.replace(/[-_]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  }
}
