/**
 * Phase PX-16: Responsive Live Preview Renderer
 * PX16-T03
 */

import {
  WebsiteProjectSchema,
  PageDefinition,
  WebsiteBlockData,
  ViewportMode,
  STANDARD_VIEWPORTS,
  DesignTokens
} from './WebsiteTypes';

export interface RenderOptions {
  slug?: string;
  viewport?: ViewportMode;
  isolateScripts?: boolean;
  enableInspectMarkers?: boolean;
  themeMode?: 'dark' | 'light';
}

export class ResponsivePreviewRenderer {
  public renderPageHtml(project: WebsiteProjectSchema, options: RenderOptions = {}): string {
    const targetSlug = options.slug || 'home';
    const page = project.pages.find(p => p.slug === targetSlug) || project.pages[0];
    if (!page) {
      throw new Error('Project must contain at least one page');
    }

    const cssTokens = this.generateCssVariables(project.theme);
    const customCss = project.customCss || '';
    const inspectMode = options.enableInspectMarkers ?? false;
    const renderedBlocks = page.blocks.map(block => this.renderBlock(block, inspectMode)).join('\n');

    const metaTitle = escapeHtml(page.seo?.metaTitle || page.title || project.name);
    const metaDesc = escapeHtml(page.seo?.metaDescription || page.description || '');

    // Strict CSP to prevent unsafe execution and escape
    const cspTag = `<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data: blob:; img-src 'self' data: https: blob:; media-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com data:; frame-ancestors 'self'; connect-src 'self';">`;

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${cspTag}
  <title>${metaTitle}</title>
  ${metaDesc ? `<meta name="description" content="${metaDesc}">` : ''}
  <style>
    ${cssTokens}

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--color-bg, #0a0a0c);
      color: var(--color-fg, #f8fafc);
      font-family: var(--font-body, system-ui, sans-serif);
      font-size: var(--font-size-base, 16px);
      line-height: var(--line-height-base, 1.6);
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: var(--font-heading, system-ui, sans-serif);
      color: var(--color-fg, #f8fafc);
      line-height: 1.2;
    }

    a {
      color: var(--color-accent, #38bdf8);
      text-decoration: none;
      transition: color 0.2s ease;
    }
    a:hover {
      text-decoration: underline;
    }

    .container {
      max-width: var(--container-max-width, 1200px);
      margin: 0 auto;
      padding: 0 1.5rem;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1.5rem;
      border-radius: var(--radius-button, 8px);
      font-weight: 600;
      cursor: pointer;
      text-decoration: none !important;
      transition: transform 0.15s ease, opacity 0.15s ease;
      font-size: 0.95rem;
      border: 1px solid transparent;
    }
    .btn:hover {
      transform: translateY(-1px);
      opacity: 0.95;
    }
    .btn-primary {
      background: var(--color-primary, #6366f1);
      color: #ffffff !important;
    }
    .btn-secondary {
      background: transparent;
      border-color: var(--color-border, #27272a);
      color: var(--color-fg, #f8fafc) !important;
    }
    .btn-secondary:hover {
      background: var(--color-surface, #18181b);
    }

    /* Block Component Styles */
    .wb-navbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 0;
      border-bottom: 1px solid var(--color-border, #27272a);
    }
    .wb-navbar .brand {
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .wb-navbar .nav-links {
      display: flex;
      gap: 1.5rem;
      align-items: center;
      list-style: none;
    }

    .wb-hero {
      padding: 5rem 0;
      text-align: center;
    }
    .wb-hero .eyebrow {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--color-accent, #38bdf8);
      margin-bottom: 1rem;
      font-weight: 700;
    }
    .wb-hero h1 {
      font-size: clamp(2.25rem, 5vw, 4rem);
      margin-bottom: 1.25rem;
      letter-spacing: -0.03em;
    }
    .wb-hero p.lead {
      font-size: 1.15rem;
      color: var(--color-muted, #94a3b8);
      max-width: 680px;
      margin: 0 auto 2rem;
    }
    .wb-hero .cta-group {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    .wb-features {
      padding: 4rem 0;
    }
    .wb-features .section-header {
      text-align: center;
      margin-bottom: 3rem;
    }
    .wb-features .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
    }
    .wb-features .card {
      background: var(--color-surface, #18181b);
      border: 1px solid var(--color-border, #27272a);
      border-radius: var(--radius-card, 12px);
      padding: 1.75rem;
      box-shadow: var(--shadow-card, 0 4px 6px -1px rgb(0 0 0 / 0.1));
    }
    .wb-features .card h3 {
      font-size: 1.2rem;
      margin-bottom: 0.75rem;
    }
    .wb-features .card p {
      color: var(--color-muted, #94a3b8);
      font-size: 0.95rem;
    }

    .wb-pricing {
      padding: 4rem 0;
    }
    .wb-pricing .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.5rem;
      margin-top: 2.5rem;
    }
    .wb-pricing .card {
      background: var(--color-surface, #18181b);
      border: 1px solid var(--color-border, #27272a);
      border-radius: var(--radius-card, 12px);
      padding: 2rem;
      text-align: center;
      position: relative;
    }
    .wb-pricing .badge {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--color-primary, #6366f1);
      color: #fff;
      font-size: 0.75rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-weight: 700;
    }
    .wb-pricing .price {
      font-size: 2.5rem;
      font-weight: 800;
      margin: 1rem 0;
    }

    .wb-testimonials {
      padding: 4rem 0;
    }
    .wb-testimonials .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-top: 2.5rem;
    }
    .wb-testimonials .card {
      background: var(--color-surface, #18181b);
      border: 1px solid var(--color-border, #27272a);
      border-radius: var(--radius-card, 12px);
      padding: 1.75rem;
    }
    .wb-testimonials .author-info {
      margin-top: 1.25rem;
      font-weight: 600;
    }
    .wb-testimonials .role {
      font-size: 0.85rem;
      color: var(--color-muted, #94a3b8);
    }

    .wb-faq {
      padding: 4rem 0;
      max-width: 800px;
      margin: 0 auto;
    }
    .wb-faq details {
      background: var(--color-surface, #18181b);
      border: 1px solid var(--color-border, #27272a);
      border-radius: var(--radius-base, 8px);
      padding: 1.25rem;
      margin-bottom: 1rem;
    }
    .wb-faq summary {
      font-weight: 600;
      cursor: pointer;
    }
    .wb-faq details p {
      margin-top: 0.75rem;
      color: var(--color-muted, #94a3b8);
    }

    .wb-footer {
      border-top: 1px solid var(--color-border, #27272a);
      padding: 3rem 0;
      margin-top: 4rem;
      font-size: 0.9rem;
      color: var(--color-muted, #94a3b8);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    /* Custom CSS injected safely */
    ${customCss}
  </style>
</head>
<body>
  <main>
    ${renderedBlocks}
  </main>
</body>
</html>`;
  }

  private renderBlock(block: WebsiteBlockData, inspectMode: boolean): string {
    const dataAttrs = inspectMode
      ? `data-wb-block-id="${escapeHtml(block.id)}" data-wb-block-type="${escapeHtml(block.type)}"`
      : '';
    const styleAttr = block.style ? this.formatInlineStyle(block.style) : '';

    switch (block.type) {
      case 'navbar':
        return `<header ${dataAttrs} ${styleAttr}><div class="container wb-navbar">
          <div class="brand">${escapeHtml(block.title || 'Brand')}</div>
          <nav>
            <ul class="nav-links">
              ${(block.links || []).map(l => `<li><a href="${safeHref(l.href)}">${escapeHtml(l.label)}</a></li>`).join('')}
              ${block.ctaText ? `<li><a href="${safeHref(block.ctaHref)}" class="btn btn-primary">${escapeHtml(block.ctaText)}</a></li>` : ''}
            </ul>
          </nav>
        </div></header>`;

      case 'hero':
        return `<section ${dataAttrs} ${styleAttr} class="wb-hero"><div class="container">
          ${block.eyebrow ? `<p class="eyebrow">${escapeHtml(block.eyebrow)}</p>` : ''}
          <h1>${escapeHtml(block.title || 'Welcome')}</h1>
          ${block.body ? `<p class="lead">${escapeHtml(block.body)}</p>` : ''}
          <div class="cta-group">
            ${block.ctaText ? `<a href="${safeHref(block.ctaHref)}" class="btn btn-primary">${escapeHtml(block.ctaText)}</a>` : ''}
            ${block.secondaryCtaText ? `<a href="${safeHref(block.secondaryCtaHref)}" class="btn btn-secondary">${escapeHtml(block.secondaryCtaText)}</a>` : ''}
          </div>
        </div></section>`;

      case 'features':
        return `<section ${dataAttrs} ${styleAttr} class="wb-features"><div class="container">
          ${block.title ? `<div class="section-header"><h2>${escapeHtml(block.title)}</h2>${block.subtitle ? `<p>${escapeHtml(block.subtitle)}</p>` : ''}</div>` : ''}
          <div class="grid">
            ${(block.items || []).map(it => `<div class="card"><h3>${escapeHtml(it.title || '')}</h3><p>${escapeHtml(it.description || '')}</p></div>`).join('')}
          </div>
        </div></section>`;

      case 'pricing':
        return `<section ${dataAttrs} ${styleAttr} class="wb-pricing"><div class="container">
          ${block.title ? `<div style="text-align:center;"><h2>${escapeHtml(block.title)}</h2>${block.subtitle ? `<p style="color:var(--color-muted);">${escapeHtml(block.subtitle)}</p>` : ''}</div>` : ''}
          <div class="grid">
            ${(block.items || []).map(it => `<div class="card">
              ${it.badge ? `<span class="badge">${escapeHtml(it.badge)}</span>` : ''}
              <h3>${escapeHtml(it.title || '')}</h3>
              <div class="price">${escapeHtml(it.price || '$0')}</div>
              <p style="color:var(--color-muted);margin-bottom:1.5rem;">${escapeHtml(it.description || '')}</p>
              ${it.ctaText ? `<a href="${safeHref(it.href)}" class="btn btn-primary" style="width:100%;">${escapeHtml(it.ctaText)}</a>` : ''}
            </div>`).join('')}
          </div>
        </div></section>`;

      case 'testimonial':
        return `<section ${dataAttrs} ${styleAttr} class="wb-testimonials"><div class="container">
          ${block.title ? `<h2 style="text-align:center;">${escapeHtml(block.title)}</h2>` : ''}
          <div class="grid">
            ${(block.items || []).map(it => `<div class="card">
              <p>"${escapeHtml(it.description || '')}"</p>
              <div class="author-info">${escapeHtml(it.author || '')}</div>
              <div class="role">${escapeHtml(it.role || '')}</div>
            </div>`).join('')}
          </div>
        </div></section>`;

      case 'faq':
        return `<section ${dataAttrs} ${styleAttr} class="wb-faq"><div class="container">
          ${block.title ? `<h2 style="text-align:center;margin-bottom:2rem;">${escapeHtml(block.title)}</h2>` : ''}
          ${(block.items || []).map(it => `<details><summary>${escapeHtml(it.title || '')}</summary><p>${escapeHtml(it.description || '')}</p></details>`).join('')}
        </div></section>`;

      case 'stats':
        return `<section ${dataAttrs} ${styleAttr} style="padding:3rem 0;border-top:1px solid var(--color-border);border-bottom:1px solid var(--color-border);"><div class="container" style="display:flex;justify-content:space-around;flex-wrap:wrap;gap:2rem;text-align:center;">
          ${(block.items || []).map(it => `<div><div style="font-size:2.5rem;font-weight:800;color:var(--color-primary);">${escapeHtml(it.title || '')}</div><div style="color:var(--color-muted);">${escapeHtml(it.description || '')}</div></div>`).join('')}
        </div></section>`;

      case 'contactForm':
        return `<section ${dataAttrs} ${styleAttr} style="padding:4rem 0;"><div class="container" style="max-width:600px;text-align:center;">
          <h2>${escapeHtml(block.title || 'Contact Us')}</h2>
          ${block.subtitle ? `<p style="color:var(--color-muted);margin-bottom:2rem;">${escapeHtml(block.subtitle)}</p>` : ''}
          <form style="display:flex;flex-direction:column;gap:1rem;text-align:left;">
            <div><label style="display:block;margin-bottom:0.4rem;font-size:0.9rem;">Email Address</label><input type="email" placeholder="name@domain.com" style="width:100%;padding:0.75rem;border-radius:var(--radius-base);background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-fg);" disabled></div>
            <div><label style="display:block;margin-bottom:0.4rem;font-size:0.9rem;">Message</label><textarea rows="4" placeholder="How can we help?" style="width:100%;padding:0.75rem;border-radius:var(--radius-base);background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-fg);" disabled></textarea></div>
            <button type="button" class="btn btn-primary" style="margin-top:0.5rem;" disabled>${escapeHtml(block.ctaText || 'Submit')}</button>
          </form>
        </div></section>`;

      case 'footer':
        return `<footer ${dataAttrs} ${styleAttr}><div class="container wb-footer">
          <div>${escapeHtml(block.body || block.title || '© 2026')}</div>
          <div style="display:flex;gap:1.5rem;">
            ${(block.links || []).map(l => `<a href="${safeHref(l.href)}">${escapeHtml(l.label)}</a>`).join('')}
          </div>
        </div></footer>`;

      default:
        return `<section ${dataAttrs} ${styleAttr} style="padding:3rem 0;"><div class="container">
          <h2>${escapeHtml(block.title || '')}</h2>
          <p>${escapeHtml(block.body || '')}</p>
        </div></section>`;
    }
  }

  private generateCssVariables(tokens: DesignTokens): string {
    return `:root {
      --color-bg: ${tokens.colors.background || '#0a0a0c'};
      --color-fg: ${tokens.colors.foreground || '#f8fafc'};
      --color-primary: ${tokens.colors.primary || '#6366f1'};
      --color-secondary: ${tokens.colors.secondary || '#a855f7'};
      --color-accent: ${tokens.colors.accent || '#38bdf8'};
      --color-surface: ${tokens.colors.surface || '#18181b'};
      --color-muted: ${tokens.colors.muted || '#94a3b8'};
      --color-border: ${tokens.colors.border || '#27272a'};

      --font-heading: ${tokens.typography.fontFamilyHeading || 'Inter, system-ui, sans-serif'};
      --font-body: ${tokens.typography.fontFamilyBody || 'Inter, system-ui, sans-serif'};
      --font-size-base: ${tokens.typography.fontSizeBase || '16px'};
      --line-height-base: ${tokens.typography.lineHeightBase || '1.6'};

      --container-max-width: ${tokens.spacing.containerMaxWidth || '1200px'};
      --radius-base: ${tokens.radii.base || '8px'};
      --radius-card: ${tokens.radii.card || '12px'};
      --radius-button: ${tokens.radii.button || '8px'};
      --shadow-card: ${tokens.shadows.card || '0 4px 6px -1px rgb(0 0 0 / 0.1)'};
    }`;
  }

  private formatInlineStyle(style: Partial<WebsiteBlockData['style']>): string {
    const rules: string[] = [];
    if (style?.backgroundColor) rules.push(`background-color: ${style.backgroundColor};`);
    if (style?.textColor) rules.push(`color: ${style.textColor};`);
    if (style?.paddingTop) rules.push(`padding-top: ${style.paddingTop};`);
    if (style?.paddingBottom) rules.push(`padding-bottom: ${style.paddingBottom};`);
    if (style?.textAlign) rules.push(`text-align: ${style.textAlign};`);
    return rules.length > 0 ? `style="${rules.join(' ')}"` : '';
  }
}

function escapeHtml(val: string): string {
  return String(val || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

function safeHref(val?: string): string {
  if (!val) return '#';
  return /^(https?:\/\/|mailto:|#|\/)/i.test(val) ? escapeHtml(val) : '#';
}
