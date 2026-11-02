/**
 * Phase PX-16: Block-Based Editor Engine & History Manager
 * PX16-T02
 */

import { v4 as uuidv4 } from 'uuid';
import {
  BlockType,
  WebsiteBlockData,
  PageDefinition,
  WebsiteProjectSchema,
  BlockStyleOverrides
} from './WebsiteTypes';
import { WebsiteProjectModel } from './WebsiteProjectModel';

export interface BlockTemplate {
  type: BlockType;
  label: string;
  category: 'header' | 'content' | 'marketing' | 'navigation' | 'form';
  defaultData: Omit<WebsiteBlockData, 'id'>;
}

export class BlockEditorEngine {
  private projectModel: WebsiteProjectModel;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private readonly maxHistoryLength = 50;

  constructor(projectModel: WebsiteProjectModel) {
    this.projectModel = projectModel;
    this.pushHistoryState();
  }

  public getBlockTemplates(): BlockTemplate[] {
    return [
      {
        type: 'navbar',
        label: 'Navigation Bar',
        category: 'navigation',
        defaultData: {
          type: 'navbar',
          title: 'Brand',
          links: [
            { label: 'Overview', href: '#overview' },
            { label: 'Pricing', href: '#pricing' }
          ],
          ctaText: 'Sign In',
          ctaHref: '#login'
        }
      },
      {
        type: 'hero',
        label: 'Hero Section',
        category: 'header',
        defaultData: {
          type: 'hero',
          eyebrow: 'New Release',
          title: 'Transform your digital presence',
          subtitle: 'Clean aesthetics, responsive layouts, and blazing performance.',
          body: 'Empower your team with next-generation web design tooling.',
          ctaText: 'Get Started',
          ctaHref: '#signup',
          secondaryCtaText: 'Learn More',
          secondaryCtaHref: '#features'
        }
      },
      {
        type: 'features',
        label: 'Feature Grid',
        category: 'content',
        defaultData: {
          type: 'features',
          title: 'Why Choose Our Platform',
          subtitle: 'Engineered for speed, security, and developer joy.',
          items: [
            { title: 'Modular Architecture', description: 'Swap components seamlessly without layout reflows.' },
            { title: 'Zero Bloat', description: 'Clean semantic HTML and minimal CSS footprint.' },
            { title: 'Accessibility First', description: 'WCAG 2.1 AA compliant color schemes and roles.' }
          ]
        }
      },
      {
        type: 'pricing',
        label: 'Pricing Tables',
        category: 'marketing',
        defaultData: {
          type: 'pricing',
          title: 'Simple, Transparent Pricing',
          subtitle: 'No hidden fees. Upgrade or cancel at any time.',
          items: [
            { title: 'Starter', price: '$0/mo', description: 'Perfect for side projects & prototypes.', ctaText: 'Start Free' },
            { title: 'Pro', price: '$29/mo', description: 'Advanced analytics and team collaboration.', ctaText: 'Upgrade to Pro', badge: 'Popular' },
            { title: 'Enterprise', price: 'Custom', description: 'Dedicated support, custom SLA, and SSO.', ctaText: 'Contact Sales' }
          ]
        }
      },
      {
        type: 'testimonial',
        label: 'Customer Testimonials',
        category: 'marketing',
        defaultData: {
          type: 'testimonial',
          title: 'Loved by developers worldwide',
          items: [
            {
              author: 'Sarah Chen',
              role: 'VP Engineering at TechFlow',
              description: 'This studio transformed our publishing workflow in days.',
              rating: 5
            },
            {
              author: 'Marcus Vance',
              role: 'Founder, Studio Alpha',
              description: 'The click-to-code precision saved us dozens of hours.',
              rating: 5
            }
          ]
        }
      },
      {
        type: 'gallery',
        label: 'Media Gallery',
        category: 'content',
        defaultData: {
          type: 'gallery',
          title: 'Visual Showcase',
          subtitle: 'A gallery of recent releases and design assets.',
          items: [
            { title: 'Dashboard UI', description: 'Dark mode analytics preview' },
            { title: 'Mobile Companion', description: 'Native responsive experience' }
          ]
        }
      },
      {
        type: 'faq',
        label: 'Frequently Asked Questions',
        category: 'content',
        defaultData: {
          type: 'faq',
          title: 'Frequently Asked Questions',
          items: [
            { title: 'How does live preview work?', description: 'Frames run in a sandboxed iframe with strict CSP restrictions.' },
            { title: 'Can I export clean HTML?', description: 'Yes, projects export clean standalone HTML or multi-page ZIP packages.' }
          ]
        }
      },
      {
        type: 'stats',
        label: 'Metrics & Stats',
        category: 'marketing',
        defaultData: {
          type: 'stats',
          title: 'Proven at scale',
          items: [
            { title: '99.99%', description: 'Uptime SLA' },
            { title: '10M+', description: 'Requests processed' },
            { title: '<50ms', description: 'Average response latency' }
          ]
        }
      },
      {
        type: 'contactForm',
        label: 'Contact Form',
        category: 'form',
        defaultData: {
          type: 'contactForm',
          title: 'Get in Touch',
          subtitle: 'Send us a message and our team will respond within 24 hours.',
          ctaText: 'Send Message'
        }
      },
      {
        type: 'footer',
        label: 'Page Footer',
        category: 'navigation',
        defaultData: {
          type: 'footer',
          title: 'Brand Inc.',
          body: '© 2026 Brand Inc. All rights reserved.',
          links: [
            { label: 'Privacy Policy', href: '#privacy' },
            { label: 'Terms of Service', href: '#terms' }
          ]
        }
      }
    ];
  }

  public addBlock(pageId: string, blockType: BlockType, targetIndex?: number): WebsiteBlockData {
    const page = this.projectModel.getPageById(pageId);
    if (!page) throw new Error(`Page ${pageId} not found`);

    const template = this.getBlockTemplates().find(t => t.type === blockType);
    const newBlock: WebsiteBlockData = {
      id: `block-${uuidv4()}`,
      ...(template ? template.defaultData : { type: blockType, title: `New ${blockType} Block` })
    };

    if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= page.blocks.length) {
      page.blocks.splice(targetIndex, 0, newBlock);
    } else {
      page.blocks.push(newBlock);
    }

    this.pushHistoryState();
    return JSON.parse(JSON.stringify(newBlock));
  }

  public updateBlock(pageId: string, blockId: string, updates: Partial<WebsiteBlockData>): WebsiteBlockData {
    const page = this.projectModel.getPageById(pageId);
    if (!page) throw new Error(`Page ${pageId} not found`);

    const block = page.blocks.find(b => b.id === blockId);
    if (!block) throw new Error(`Block ${blockId} not found`);

    // Sanitize text inputs
    if (updates.title !== undefined) block.title = updates.title.slice(0, 300);
    if (updates.subtitle !== undefined) block.subtitle = updates.subtitle.slice(0, 500);
    if (updates.body !== undefined) block.body = updates.body.slice(0, 5000);
    if (updates.eyebrow !== undefined) block.eyebrow = updates.eyebrow.slice(0, 100);
    if (updates.ctaText !== undefined) block.ctaText = updates.ctaText.slice(0, 100);
    if (updates.ctaHref !== undefined) block.ctaHref = updates.ctaHref.slice(0, 500);
    if (updates.secondaryCtaText !== undefined) block.secondaryCtaText = updates.secondaryCtaText.slice(0, 100);
    if (updates.secondaryCtaHref !== undefined) block.secondaryCtaHref = updates.secondaryCtaHref.slice(0, 500);
    if (updates.imageUrl !== undefined) block.imageUrl = updates.imageUrl.slice(0, 1000);
    if (updates.imageAlt !== undefined) block.imageAlt = updates.imageAlt.slice(0, 300);
    if (updates.items !== undefined) block.items = updates.items;
    if (updates.links !== undefined) block.links = updates.links;
    if (updates.style !== undefined) block.style = { ...block.style, ...updates.style };
    if (updates.ariaLabel !== undefined) block.ariaLabel = updates.ariaLabel.slice(0, 200);
    if (updates.ariaRole !== undefined) block.ariaRole = updates.ariaRole.slice(0, 50);

    this.pushHistoryState();
    return JSON.parse(JSON.stringify(block));
  }

  public deleteBlock(pageId: string, blockId: string): boolean {
    const page = this.projectModel.getPageById(pageId);
    if (!page) return false;

    const idx = page.blocks.findIndex(b => b.id === blockId);
    if (idx === -1) return false;

    page.blocks.splice(idx, 1);
    this.pushHistoryState();
    return true;
  }

  public duplicateBlock(pageId: string, blockId: string): WebsiteBlockData {
    const page = this.projectModel.getPageById(pageId);
    if (!page) throw new Error(`Page ${pageId} not found`);

    const idx = page.blocks.findIndex(b => b.id === blockId);
    if (idx === -1) throw new Error(`Block ${blockId} not found`);

    const source = page.blocks[idx];
    const cloned: WebsiteBlockData = JSON.parse(JSON.stringify(source));
    cloned.id = `block-${uuidv4()}`;
    if (cloned.title) cloned.title = `${cloned.title} (Copy)`;

    page.blocks.splice(idx + 1, 0, cloned);
    this.pushHistoryState();
    return JSON.parse(JSON.stringify(cloned));
  }

  public reorderBlock(pageId: string, blockId: string, newIndex: number): boolean {
    const page = this.projectModel.getPageById(pageId);
    if (!page) return false;

    const currentIndex = page.blocks.findIndex(b => b.id === blockId);
    if (currentIndex === -1 || newIndex < 0 || newIndex >= page.blocks.length) return false;

    const [moved] = page.blocks.splice(currentIndex, 1);
    page.blocks.splice(newIndex, 0, moved);
    this.pushHistoryState();
    return true;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(): WebsiteProjectSchema | null {
    if (!this.canUndo()) return null;
    const currentState = this.undoStack.pop()!;
    this.redoStack.push(currentState);

    const previousState = this.undoStack[this.undoStack.length - 1];
    const parsed = JSON.parse(previousState) as WebsiteProjectSchema;
    this.projectModel = new WebsiteProjectModel(parsed);
    return this.projectModel.getProject();
  }

  public redo(): WebsiteProjectSchema | null {
    if (!this.canRedo()) return null;
    const nextState = this.redoStack.pop()!;
    this.undoStack.push(nextState);

    const parsed = JSON.parse(nextState) as WebsiteProjectSchema;
    this.projectModel = new WebsiteProjectModel(parsed);
    return this.projectModel.getProject();
  }

  public getProjectModel(): WebsiteProjectModel {
    return this.projectModel;
  }

  private pushHistoryState(): void {
    const serialized = JSON.stringify(this.projectModel.getProject());
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === serialized) {
      return;
    }
    this.undoStack.push(serialized);
    if (this.undoStack.length > this.maxHistoryLength) {
      this.undoStack.shift();
    }
    this.redoStack = []; // clear redo on new action
  }
}
