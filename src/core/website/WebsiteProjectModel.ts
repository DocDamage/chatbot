/**
 * Phase PX-16: Versioned Website Project Model & Schema Migrations
 * PX16-T01
 */

import { v4 as uuidv4 } from 'uuid';
import {
  WebsiteProjectSchema,
  PageDefinition,
  WebsiteBlockData,
  DesignTokens,
  SEOConfig,
  ExportConfig
} from './WebsiteTypes';

export interface LegacyV1WebsiteProject {
  name: string;
  theme?: { background?: string; foreground?: string; accent?: string };
  pages: Array<{
    slug: string;
    title: string;
    blocks: Array<{
      type: 'hero' | 'text' | 'features' | 'cta';
      title?: string;
      body?: string;
      items?: string[];
      href?: string;
    }>;
  }>;
}

export class WebsiteProjectModel {
  private project: WebsiteProjectSchema;

  constructor(initialData?: Partial<WebsiteProjectSchema> | LegacyV1WebsiteProject) {
    if (initialData && !('schemaVersion' in initialData)) {
      this.project = this.migrateV1ToV2(initialData as LegacyV1WebsiteProject);
    } else if (initialData && initialData.schemaVersion === '2.0.0') {
      this.project = this.validateAndNormalize(initialData as WebsiteProjectSchema);
    } else {
      this.project = this.createDefaultProject();
    }
  }

  public getProject(): WebsiteProjectSchema {
    return JSON.parse(JSON.stringify(this.project));
  }

  public getId(): string {
    return this.project.id;
  }

  public getName(): string {
    return this.project.name;
  }

  public setName(name: string): void {
    this.project.name = name.trim().slice(0, 120);
    this.touch();
  }

  public getTheme(): DesignTokens {
    return JSON.parse(JSON.stringify(this.project.theme));
  }

  public updateTheme(themeUpdates: Partial<DesignTokens>): void {
    this.project.theme = {
      ...this.project.theme,
      ...themeUpdates,
      colors: { ...this.project.theme.colors, ...themeUpdates.colors },
      typography: { ...this.project.theme.typography, ...themeUpdates.typography },
      spacing: { ...this.project.theme.spacing, ...themeUpdates.spacing },
      radii: { ...this.project.theme.radii, ...themeUpdates.radii },
      shadows: { ...this.project.theme.shadows, ...themeUpdates.shadows }
    };
    this.touch();
  }

  public getPages(): PageDefinition[] {
    return this.project.pages;
  }

  public getPageBySlug(slug: string): PageDefinition | undefined {
    const normalized = slug.toLowerCase().trim();
    return this.project.pages.find(p => p.slug === normalized);
  }

  public getPageById(pageId: string): PageDefinition | undefined {
    return this.project.pages.find(p => p.id === pageId);
  }

  public addPage(pageInput: { title: string; slug?: string; description?: string; isHome?: boolean }): PageDefinition {
    const title = pageInput.title.trim().slice(0, 100) || 'Untitled Page';
    let slug = (pageInput.slug || title)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-|-$/g, '') || 'page';

    // ensure slug uniqueness
    let counter = 1;
    const baseSlug = slug;
    while (this.project.pages.some(p => p.slug === slug)) {
      slug = `${baseSlug}-${counter++}`;
    }

    const newPage: PageDefinition = {
      id: `page-${uuidv4()}`,
      slug,
      title,
      description: pageInput.description,
      blocks: [
        {
          id: `block-${uuidv4()}`,
          type: 'hero',
          title,
          subtitle: 'Welcome to your new page',
          body: 'Start editing blocks or ask AI assistant to construct your design.'
        }
      ],
      isHome: pageInput.isHome ?? (this.project.pages.length === 0)
    };

    if (newPage.isHome) {
      for (const p of this.project.pages) {
        p.isHome = false;
      }
    }

    this.project.pages.push(newPage);
    this.touch();
    return JSON.parse(JSON.stringify(newPage));
  }

  public deletePage(pageId: string): boolean {
    if (this.project.pages.length <= 1) {
      throw new Error('Website project must retain at least one page');
    }
    const idx = this.project.pages.findIndex(p => p.id === pageId);
    if (idx === -1) return false;

    const wasHome = this.project.pages[idx].isHome;
    this.project.pages.splice(idx, 1);
    if (wasHome && this.project.pages.length > 0) {
      this.project.pages[0].isHome = true;
    }
    this.touch();
    return true;
  }

  public updatePageSEO(pageId: string, seo: SEOConfig): void {
    const page = this.project.pages.find(p => p.id === pageId);
    if (!page) throw new Error(`Page ${pageId} not found`);
    page.seo = { ...page.seo, ...seo };
    this.touch();
  }

  public setCustomCss(css: string): void {
    // Sanitize custom CSS: remove risky tags/expressions
    const sanitized = css
      .replace(/<\/?script[^>]*>/gi, '')
      .replace(/expression\s*\(/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/behavior\s*:/gi, '')
      .slice(0, 50000);
    this.project.customCss = sanitized;
    this.touch();
  }

  public getCustomCss(): string {
    return this.project.customCss || '';
  }

  public updateExportConfig(config: Partial<ExportConfig>): void {
    this.project.exportConfig = {
      ...(this.project.exportConfig || {
        target: 'standalone-html',
        minify: true,
        includeSourceMaps: false,
        generateRobotsTxt: true,
        generateSitemap: true,
        inlineCss: true
      }),
      ...config
    };
    this.touch();
  }

  public migrateV1ToV2(legacy: LegacyV1WebsiteProject): WebsiteProjectSchema {
    const defaultTheme: DesignTokens = {
      colors: {
        background: legacy.theme?.background || '#0f172a',
        foreground: legacy.theme?.foreground || '#f8fafc',
        accent: legacy.theme?.accent || '#38bdf8',
        primary: legacy.theme?.accent || '#38bdf8',
        surface: '#1e293b',
        muted: '#94a3b8',
        border: '#334155'
      },
      typography: {
        fontFamilyHeading: 'Inter, system-ui, sans-serif',
        fontFamilyBody: 'Inter, system-ui, sans-serif',
        fontSizeBase: '16px',
        lineHeightBase: '1.6'
      },
      spacing: {
        sectionPadding: '4rem 1.5rem',
        containerMaxWidth: '1200px',
        gapBase: '1.5rem'
      },
      radii: {
        base: '8px',
        card: '12px',
        button: '8px'
      },
      shadows: {
        card: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        dropdown: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
      }
    };

    const pages: PageDefinition[] = (legacy.pages || []).map((lp, pIdx) => {
      const blocks: WebsiteBlockData[] = (lp.blocks || []).map(lb => ({
        id: `block-${uuidv4()}`,
        type: lb.type,
        title: lb.title,
        body: lb.body,
        items: lb.items?.map(it => ({ title: it })),
        ctaHref: lb.href,
        ctaText: lb.body && lb.type === 'cta' ? lb.body : undefined
      }));

      return {
        id: `page-${uuidv4()}`,
        slug: lp.slug || (pIdx === 0 ? 'home' : `page-${pIdx}`),
        title: lp.title || 'Untitled',
        blocks,
        isHome: pIdx === 0
      };
    });

    if (pages.length === 0) {
      pages.push({
        id: `page-${uuidv4()}`,
        slug: 'home',
        title: 'Home',
        blocks: [
          {
            id: `block-${uuidv4()}`,
            type: 'hero',
            title: legacy.name || 'Welcome',
            body: 'Welcome to your newly migrated site.'
          }
        ],
        isHome: true
      });
    }

    return {
      schemaVersion: '2.0.0',
      id: `proj-${uuidv4()}`,
      name: legacy.name || 'Untitled Website',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      theme: defaultTheme,
      pages,
      assets: [],
      breakpoints: {
        mobileMax: 640,
        tabletMax: 1024,
        desktopMin: 1025
      },
      exportConfig: {
        target: 'standalone-html',
        minify: true,
        includeSourceMaps: false,
        generateRobotsTxt: true,
        generateSitemap: true,
        inlineCss: true
      }
    };
  }

  private validateAndNormalize(raw: WebsiteProjectSchema): WebsiteProjectSchema {
    if (!raw.name || typeof raw.name !== 'string') {
      raw.name = 'Untitled Site';
    }
    if (!Array.isArray(raw.pages) || raw.pages.length === 0) {
      raw.pages = [
        {
          id: `page-${uuidv4()}`,
          slug: 'home',
          title: 'Home',
          blocks: [
            {
              id: `block-${uuidv4()}`,
              type: 'hero',
              title: raw.name,
              body: 'Welcome to your website.'
            }
          ],
          isHome: true
        }
      ];
    }
    if (!raw.theme) {
      raw.theme = this.createDefaultTheme();
    }
    if (!raw.assets) {
      raw.assets = [];
    }
    return raw;
  }

  private createDefaultTheme(): DesignTokens {
    return {
      colors: {
        background: '#0a0a0c',
        foreground: '#f8fafc',
        primary: '#6366f1',
        secondary: '#a855f7',
        accent: '#38bdf8',
        surface: '#18181b',
        muted: '#71717a',
        border: '#27272a'
      },
      typography: {
        fontFamilyHeading: 'Inter, system-ui, sans-serif',
        fontFamilyBody: 'Inter, system-ui, sans-serif',
        fontSizeBase: '16px',
        lineHeightBase: '1.6'
      },
      spacing: {
        sectionPadding: '4rem 1.5rem',
        containerMaxWidth: '1200px',
        gapBase: '1.5rem'
      },
      radii: {
        base: '8px',
        card: '12px',
        button: '8px'
      },
      shadows: {
        card: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        dropdown: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
      }
    };
  }

  private createDefaultProject(): WebsiteProjectSchema {
    const id = `proj-${uuidv4()}`;
    return {
      schemaVersion: '2.0.0',
      id,
      name: 'New Modern Website',
      description: 'Crafted with AI Chatbot Hub Visual Web Studio',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      theme: this.createDefaultTheme(),
      pages: [
        {
          id: `page-${uuidv4()}`,
          slug: 'home',
          title: 'Home',
          isHome: true,
          blocks: [
            {
              id: `block-${uuidv4()}`,
              type: 'navbar',
              title: 'My Brand',
              links: [
                { label: 'Features', href: '#features' },
                { label: 'Pricing', href: '#pricing' },
                { label: 'FAQ', href: '#faq' }
              ],
              ctaText: 'Get Started',
              ctaHref: '#pricing'
            },
            {
              id: `block-${uuidv4()}`,
              type: 'hero',
              eyebrow: 'Next-Gen Web Platform',
              title: 'Build stunning experiences with confidence',
              body: 'Visual block-based composition, sandboxed responsive preview, and AI click-to-code workflow.',
              ctaText: 'Explore Blocks',
              ctaHref: '#features',
              secondaryCtaText: 'Documentation',
              secondaryCtaHref: '#faq'
            },
            {
              id: `block-${uuidv4()}`,
              type: 'features',
              title: 'Powerful Capabilities',
              subtitle: 'Everything you need to publish high-performance web experiences',
              items: [
                { title: 'Responsive Live Frame', description: 'Real-time multi-device preview with isolated security.' },
                { title: 'Design Tokens', description: 'Centralized typography, colors, radii, and spacing.' },
                { title: 'Source-Linked Inspection', description: 'Trace elements directly back to codebase components.' }
              ]
            },
            {
              id: `block-${uuidv4()}`,
              type: 'footer',
              title: 'My Brand',
              body: '© 2026 My Brand. All rights reserved.'
            }
          ]
        }
      ],
      assets: [],
      breakpoints: {
        mobileMax: 640,
        tabletMax: 1024,
        desktopMin: 1025
      },
      exportConfig: {
        target: 'standalone-html',
        minify: true,
        includeSourceMaps: false,
        generateRobotsTxt: true,
        generateSitemap: true,
        inlineCss: true
      }
    };
  }

  private touch(): void {
    this.project.updatedAt = new Date().toISOString();
  }
}
