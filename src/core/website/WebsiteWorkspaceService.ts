import fs from 'node:fs';
import path from 'node:path';

export interface WebsiteBlock {
  type: 'hero' | 'text' | 'features' | 'cta';
  title?: string;
  body?: string;
  items?: string[];
  href?: string;
}

export interface WebsiteProject {
  name: string;
  theme?: { background?: string; foreground?: string; accent?: string };
  pages: Array<{ slug: string; title: string; blocks: WebsiteBlock[] }>;
}

export class WebsiteWorkspaceService {
  private readonly filePath: string;

  constructor(workspaceRoot = process.cwd()) {
    const root = path.join(workspaceRoot, 'data', 'website-workspace');
    fs.mkdirSync(root, { recursive: true });
    this.filePath = path.join(root, 'project.json');
  }

  load(): WebsiteProject | null {
    if (!fs.existsSync(this.filePath)) return null;
    try { return JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as WebsiteProject; } catch { return null; }
  }

  save(project: WebsiteProject): { project: WebsiteProject; html: string } {
    const normalized = this.normalize(project);
    fs.writeFileSync(this.filePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    return { project: normalized, html: this.render(normalized, normalized.pages[0]?.slug) };
  }

  render(project: WebsiteProject, slug?: string): string {
    const page = project.pages.find(item => item.slug === slug) || project.pages[0];
    if (!page) throw new Error('website project needs at least one page');
    const background = this.color(project.theme?.background, '#171717');
    const foreground = this.color(project.theme?.foreground, '#f5f5f5');
    const accent = this.color(project.theme?.accent, '#a3a3a3');
    const blocks = page.blocks.map(block => {
      if (block.type === 'hero') return `<section class="hero"><p class="eyebrow">${escapeHtml(project.name)}</p><h1>${escapeHtml(block.title || page.title)}</h1><p>${escapeHtml(block.body || '')}</p></section>`;
      if (block.type === 'features') return `<section class="features">${(block.items || []).map(item => `<article><h2>${escapeHtml(item)}</h2></article>`).join('')}</section>`;
      if (block.type === 'cta') return `<section class="cta"><h2>${escapeHtml(block.title || 'Keep building')}</h2><a href="${safeHref(block.href)}">${escapeHtml(block.body || 'Learn more')}</a></section>`;
      return `<section class="copy"><h2>${escapeHtml(block.title || '')}</h2><p>${escapeHtml(block.body || '')}</p></section>`;
    }).join('\n');
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(page.title)}</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:${background};color:${foreground};font:16px/1.6 system-ui,sans-serif}main{max-width:960px;margin:0 auto;padding:12vh 24px}.hero,.copy,.features,.cta{margin:0 0 48px}.hero h1{font-size:clamp(42px,8vw,84px);line-height:1.02;margin:8px 0 20px}.eyebrow{color:${accent};letter-spacing:.14em;text-transform:uppercase;font-size:12px}.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}.features article{border:1px solid #404040;border-radius:14px;padding:20px;background:#202020}.cta{border:1px solid #666;border-radius:16px;padding:24px}.cta a{color:${foreground};display:inline-block;margin-top:8px}</style></head><body><main>${blocks}</main></body></html>`;
  }

  private normalize(project: WebsiteProject): WebsiteProject {
    if (!project || !Array.isArray(project.pages) || project.pages.length === 0) throw new Error('website project needs at least one page');
    return {
      name: String(project.name || 'Untitled site').slice(0, 100),
      theme: project.theme || {},
      pages: project.pages.slice(0, 20).map(page => ({ slug: String(page.slug || 'home').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'home', title: String(page.title || 'Untitled page').slice(0, 100), blocks: Array.isArray(page.blocks) ? page.blocks.slice(0, 50).map(block => ({ type: block.type, title: block.title, body: block.body, items: block.items?.slice(0, 20), href: block.href })) : [] }))
    };
  }

  private color(value: string | undefined, fallback: string): string {
    return value && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

function safeHref(value?: string): string {
  return value && /^(https?:\/\/|mailto:|#)/i.test(value) ? escapeHtml(value) : '#';
}
