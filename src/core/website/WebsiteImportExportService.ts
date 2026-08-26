/**
 * Phase PX-16: Website Import and Export Service
 * PX16-T09
 */

import { v4 as uuidv4 } from 'uuid';
import {
  WebsiteProjectSchema,
  PageDefinition,
  WebsiteBlockData
} from './WebsiteTypes';
import { ResponsivePreviewRenderer } from './ResponsivePreviewRenderer';
import { WebsiteProjectModel } from './WebsiteProjectModel';

export interface ExportBundleResult {
  files: Array<{
    path: string;
    content: string | Buffer;
    mimeType: string;
  }>;
  totalBytes: number;
  warnings: string[];
}

export interface ValidationReport {
  valid: boolean;
  brokenLinks: Array<{ pageSlug: string; href: string; reason: string }>;
  missingAssets: Array<{ pageSlug: string; assetUrl: string }>;
}

export class WebsiteImportExportService {
  private renderer = new ResponsivePreviewRenderer();

  public importFromHtml(html: string, projectName = 'Imported Website'): WebsiteProjectSchema {
    // Sanitize imported HTML - remove dangerous scripts and iframes
    const cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');

    // Extract title
    const titleMatch = cleanHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : projectName;

    // Extract headings for blocks
    const h1Matches = Array.from(cleanHtml.matchAll(/<h1[^>]*>([^<]+)<\/h1>/gi)).map(m => m[1].trim());
    const pMatches = Array.from(cleanHtml.matchAll(/<p[^>]*>([^<]+)<\/p>/gi)).map(m => m[1].trim());

    const blocks: WebsiteBlockData[] = [];

    // Construct hero block
    blocks.push({
      id: `block-${uuidv4()}`,
      type: 'hero',
      title: h1Matches[0] || title,
      body: pMatches[0] || 'Imported content from external HTML document.',
      ctaText: 'Explore More',
      ctaHref: '#content'
    });

    // If more paragraphs or sections exist, create text/features blocks
    if (pMatches.length > 1) {
      blocks.push({
        id: `block-${uuidv4()}`,
        type: 'features',
        title: 'Key Information',
        items: pMatches.slice(1, 4).map((p, i) => ({
          title: `Section ${i + 1}`,
          description: p
        }))
      });
    }

    // Add footer
    blocks.push({
      id: `block-${uuidv4()}`,
      type: 'footer',
      title,
      body: `© ${new Date().getFullYear()} ${title}. Imported safely.`
    });

    const model = new WebsiteProjectModel({
      name: projectName,
      pages: [
        {
          slug: 'home',
          title,
          blocks: blocks as any
        }
      ]
    });

    return model.getProject();
  }

  public exportCleanHtml(project: WebsiteProjectSchema, slug = 'home'): string {
    return this.renderer.renderPageHtml(project, { slug, isolateScripts: true, enableInspectMarkers: false });
  }

  public exportMultiPageBundle(project: WebsiteProjectSchema): ExportBundleResult {
    const files: Array<{ path: string; content: string | Buffer; mimeType: string }> = [];
    const warnings: string[] = [];
    let totalBytes = 0;

    for (const page of project.pages) {
      const html = this.exportCleanHtml(project, page.slug);
      const filePath = page.isHome || page.slug === 'home' ? 'index.html' : `${page.slug}.html`;
      const buffer = Buffer.from(html, 'utf8');
      totalBytes += buffer.byteLength;
      files.push({
        path: filePath,
        content: html,
        mimeType: 'text/html'
      });
    }

    // Add sitemap.xml
    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${project.pages.map(p => `<url><loc>/${p.slug === 'home' ? '' : p.slug + '.html'}</loc><lastmod>${project.updatedAt.slice(0, 10)}</lastmod></url>`).join('\n  ')}
</urlset>`;
    files.push({
      path: 'sitemap.xml',
      content: sitemapContent,
      mimeType: 'application/xml'
    });
    totalBytes += Buffer.byteLength(sitemapContent);

    // Add robots.txt
    const robotsTxt = `User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n`;
    files.push({
      path: 'robots.txt',
      content: robotsTxt,
      mimeType: 'text/plain'
    });
    totalBytes += Buffer.byteLength(robotsTxt);

    return {
      files,
      totalBytes,
      warnings
    };
  }

  public validateProjectLinksAndAssets(project: WebsiteProjectSchema): ValidationReport {
    const pageSlugs = new Set(project.pages.map(p => p.slug));
    const assetUrls = new Set(project.assets.map(a => a.url));
    const brokenLinks: Array<{ pageSlug: string; href: string; reason: string }> = [];
    const missingAssets: Array<{ pageSlug: string; assetUrl: string }> = [];

    for (const page of project.pages) {
      for (const block of page.blocks) {
        // Validate internal links
        if (block.ctaHref && block.ctaHref.startsWith('/')) {
          const targetSlug = block.ctaHref.replace(/^\//, '').replace(/\.html$/, '');
          if (targetSlug && !pageSlugs.has(targetSlug)) {
            brokenLinks.push({ pageSlug: page.slug, href: block.ctaHref, reason: 'Target page slug does not exist' });
          }
        }
        if (block.links) {
          for (const link of block.links) {
            if (link.href && link.href.startsWith('/')) {
              const targetSlug = link.href.replace(/^\//, '').replace(/\.html$/, '');
              if (targetSlug && !pageSlugs.has(targetSlug)) {
                brokenLinks.push({ pageSlug: page.slug, href: link.href, reason: 'Target page slug does not exist' });
              }
            }
          }
        }

        // Validate local assets
        if (block.imageUrl && !block.imageUrl.startsWith('http') && !block.imageUrl.startsWith('data:')) {
          if (!assetUrls.has(block.imageUrl)) {
            missingAssets.push({ pageSlug: page.slug, assetUrl: block.imageUrl });
          }
        }
      }
    }

    return {
      valid: brokenLinks.length === 0 && missingAssets.length === 0,
      brokenLinks,
      missingAssets
    };
  }
}
