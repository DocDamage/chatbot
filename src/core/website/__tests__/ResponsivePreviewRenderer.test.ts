import { ResponsivePreviewRenderer } from '../ResponsivePreviewRenderer';
import { WebsiteProjectSchema, WebsiteBlockData } from '../WebsiteTypes';

describe('ResponsivePreviewRenderer Deep Branch Suite', () => {
  let renderer: ResponsivePreviewRenderer;

  beforeEach(() => {
    renderer = new ResponsivePreviewRenderer();
  });

  const baseTheme = {
    colors: {
      primary: '#4f46e5',
      secondary: '#9333ea',
      background: '#0f172a',
      surface: '#1e293b',
      foreground: '#f8fafc',
      muted: '#64748b',
      border: '#334155',
      accent: '#38bdf8',
    },
    typography: {
      fontFamilyHeading: 'Roboto',
      fontFamilyBody: 'Open Sans',
      fontSizeBase: '18px',
      lineHeightBase: '1.7',
    },
    spacing: {
      containerMaxWidth: '1400px',
    },
    radii: {
      base: '6px',
      card: '16px',
      button: '10px',
    },
    shadows: {
      card: '0 8px 16px rgba(0,0,0,0.2)',
    },
  };

  it('throws error when project contains no pages', () => {
    const emptyProject: WebsiteProjectSchema = {
      schemaVersion: '2.0.0',
      id: 'proj-empty',
      name: 'Empty',
      theme: baseTheme as any,
      pages: [],
      assets: [],
      createdAt: '2026-08-25T00:00:00Z',
      updatedAt: '2026-08-25T00:00:00Z',
    };

    expect(() => renderer.renderPageHtml(emptyProject)).toThrow('Project must contain at least one page');
  });

  it('renders all block types, inspect markers, safe hrefs, and custom css', () => {
    const blocks: WebsiteBlockData[] = [
      {
        id: 'nav-1',
        type: 'navbar',
        title: 'BrandLogo',
        links: [
          { label: 'Home', href: '/home' },
          { label: 'External', href: 'https://example.com' },
          { label: 'Mail', href: 'mailto:info@example.com' },
          { label: 'Hash', href: '#section' },
          { label: 'Unsafe JS', href: 'javascript:alert(1)' },
          { label: 'Empty Href', href: '' },
        ],
        ctaText: 'Sign Up',
        ctaHref: '/signup',
        style: {
          backgroundColor: '#111827',
          textColor: '#f9fafb',
          paddingTop: '1rem',
          paddingBottom: '1rem',
          textAlign: 'center',
        },
      },
      {
        id: 'hero-1',
        type: 'hero',
        eyebrow: 'Announcing v2.0',
        title: 'Build Faster',
        body: 'The leading AI-powered web studio platform.',
        ctaText: 'Get Started',
        ctaHref: 'https://app.example.com',
        secondaryCtaText: 'Documentation',
        secondaryCtaHref: '/docs',
      },
      {
        id: 'hero-empty',
        type: 'hero',
      },
      {
        id: 'feat-1',
        type: 'features',
        title: 'Core Features',
        subtitle: 'Everything you need',
        items: [
          { title: 'Fast Rendering', description: 'Zero lag live preview.' },
          { title: '', description: '' },
        ],
      },
      {
        id: 'feat-empty',
        type: 'features',
      },
      {
        id: 'pricing-1',
        type: 'pricing',
        title: 'Simple Pricing',
        subtitle: 'Monthly or annual',
        items: [
          {
            title: 'Pro',
            price: '$29/mo',
            description: 'For growing teams',
            badge: 'Popular',
            ctaText: 'Buy Pro',
            href: '/checkout/pro',
          },
          {
            title: 'Starter',
            description: 'Free forever',
          },
        ],
      },
      {
        id: 'pricing-empty',
        type: 'pricing',
      },
      {
        id: 'test-1',
        type: 'testimonial',
        title: 'What Users Say',
        items: [
          { description: 'Incredible speed!', author: 'Alice Developer', role: 'CTO @ Tech' },
          { description: 'Loved the UX.' },
        ],
      },
      {
        id: 'test-empty',
        type: 'testimonial',
      },
      {
        id: 'faq-1',
        type: 'faq',
        title: 'Frequently Asked Questions',
        items: [
          { title: 'Is it free?', description: 'Yes, starter is free.' },
          { title: 'Can I export?', description: 'Yes, full ZIP download.' },
        ],
      },
      {
        id: 'faq-empty',
        type: 'faq',
      },
      {
        id: 'stats-1',
        type: 'stats',
        items: [
          { title: '100k+', description: 'Active users' },
          { title: '99.99%', description: 'Uptime' },
        ],
      },
      {
        id: 'contact-1',
        type: 'contactForm',
        title: 'Get In Touch',
        subtitle: 'We reply in 24 hours',
        ctaText: 'Send Message',
      },
      {
        id: 'contact-empty',
        type: 'contactForm',
      },
      {
        id: 'footer-1',
        type: 'footer',
        body: '© 2026 AI Chatbot Hub. All rights reserved.',
        links: [
          { label: 'Privacy', href: '/privacy' },
          { label: 'Terms', href: '/terms' },
        ],
      },
      {
        id: 'footer-empty',
        type: 'footer',
      },
      {
        id: 'custom-1',
        type: 'custom' as any,
        title: 'Custom Block',
        body: 'Custom HTML content block.',
      },
      {
        id: 'custom-empty',
        type: 'unknown' as any,
      },
    ];

    const project: WebsiteProjectSchema = {
      schemaVersion: '2.0.0',
      id: 'proj-1',
      name: 'Showcase <Website>',
      theme: {
        colors: {} as any,
        typography: {} as any,
        spacing: {} as any,
        radii: {} as any,
        shadows: {} as any,
      },
      customCss: '.custom-header { font-weight: bold; }',
      pages: [
        {
          id: 'page-home',
          title: 'Home <Page>',
          slug: 'home',
          description: 'Homepage description <safe>',
          seo: {
            metaTitle: 'SEO Title & Meta',
            metaDescription: 'SEO Description & Details',
          },
          blocks,
        },
        {
          id: 'page-about',
          title: 'About',
          slug: 'about',
          blocks: [],
        },
      ],
      assets: [],
      createdAt: '2026-08-25T00:00:00Z',
      updatedAt: '2026-08-25T00:00:00Z',
    };

    // Render with inspect markers enabled
    const htmlWithMarkers = renderer.renderPageHtml(project, {
      slug: 'home',
      enableInspectMarkers: true,
    });

    expect(htmlWithMarkers).toContain('<!doctype html>');
    expect(htmlWithMarkers).toContain('data-wb-block-id="nav-1"');
    expect(htmlWithMarkers).toContain('data-wb-block-type="navbar"');
    expect(htmlWithMarkers).toContain('SEO Title &amp; Meta');
    expect(htmlWithMarkers).toContain('SEO Description &amp; Details');
    expect(htmlWithMarkers).toContain('.custom-header { font-weight: bold; }');
    expect(htmlWithMarkers).toContain('href="#"'); // javascript: was sanitized to #
    expect(htmlWithMarkers).toContain('href="https://example.com"');
    expect(htmlWithMarkers).toContain('background-color: #111827;');
    expect(htmlWithMarkers).toContain('BrandLogo');
    expect(htmlWithMarkers).toContain('100k+');
    expect(htmlWithMarkers).toContain('© 2026 AI Chatbot Hub');

    // Render page by second slug without inspect markers
    const aboutHtml = renderer.renderPageHtml(project, { slug: 'about' });
    expect(aboutHtml).toContain('<title>About</title>');
    expect(aboutHtml).not.toContain('data-wb-block-id');

    // Render with fallback slug (falls back to first page)
    const fallbackHtml = renderer.renderPageHtml(project, { slug: 'non-existent-slug' });
    expect(fallbackHtml).toContain('SEO Title &amp; Meta');
  });
});
