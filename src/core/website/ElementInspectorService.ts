/**
 * Phase PX-16: Element Selection & Inspector Service
 * PX16-T05
 */

import {
  WebsiteProjectSchema,
  WebsiteBlockData,
  InspectorSelection,
  BoxModelMetrics
} from './WebsiteTypes';

export class ElementInspectorService {
  public inspectBlock(
    project: WebsiteProjectSchema,
    pageId: string,
    blockId: string
  ): InspectorSelection | null {
    const page = project.pages.find(p => p.id === pageId) || project.pages[0];
    if (!page) return null;

    const block = page.blocks.find(b => b.id === blockId);
    if (!block) return null;

    const boxModel = this.computeBoxModel(block);
    const matchedStyles = this.extractMatchedStyles(block, project);
    const ariaAttrs = this.extractAriaAttributes(block);
    const contrast = this.calculateContrast(
      matchedStyles.color || project.theme.colors.foreground || '#f8fafc',
      matchedStyles.backgroundColor || project.theme.colors.surface || '#18181b'
    );

    return {
      elementId: `elem-${block.id}`,
      blockId: block.id,
      blockType: block.type,
      tagName: this.getSemanticTagName(block.type),
      classes: [`wb-${block.type}`, ...(block.style?.customClass ? [block.style.customClass] : [])],
      matchedStyles,
      boxModel,
      ariaAttributes: ariaAttrs,
      computedContrast: contrast
    };
  }

  private getSemanticTagName(type: string): string {
    switch (type) {
      case 'navbar':
        return 'header';
      case 'footer':
        return 'footer';
      default:
        return 'section';
    }
  }

  private computeBoxModel(block: WebsiteBlockData): BoxModelMetrics {
    const isHero = block.type === 'hero';
    return {
      width: 1200,
      height: isHero ? 450 : 250,
      margin: { top: 0, right: 0, bottom: 48, left: 0 },
      padding: { top: isHero ? 80 : 40, right: 24, bottom: isHero ? 80 : 40, left: 24 },
      border: { top: 1, right: 1, bottom: 1, left: 1 }
    };
  }

  private extractMatchedStyles(block: WebsiteBlockData, project: WebsiteProjectSchema): Record<string, string> {
    const styles: Record<string, string> = {
      display: 'block',
      color: block.style?.textColor || project.theme.colors.foreground || '#f8fafc',
      backgroundColor: block.style?.backgroundColor || project.theme.colors.background || '#0a0a0c',
      paddingTop: block.style?.paddingTop || '40px',
      paddingBottom: block.style?.paddingBottom || '40px',
      textAlign: block.style?.textAlign || 'left',
      fontFamily: project.theme.typography.fontFamilyBody || 'Inter, sans-serif'
    };
    return styles;
  }

  private extractAriaAttributes(block: WebsiteBlockData): Record<string, string> {
    const attrs: Record<string, string> = {};
    if (block.ariaLabel) attrs['aria-label'] = block.ariaLabel;
    if (block.ariaRole) attrs.role = block.ariaRole;
    return attrs;
  }

  public calculateContrast(foregroundHex: string, backgroundHex: string): {
    foreground: string;
    background: string;
    ratio: number;
    passesAA: boolean;
    passesAAA: boolean;
  } {
    const fgLum = this.getLuminance(foregroundHex);
    const bgLum = this.getLuminance(backgroundHex);

    const lighter = Math.max(fgLum, bgLum);
    const darker = Math.min(fgLum, bgLum);
    const ratio = Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;

    return {
      foreground: foregroundHex,
      background: backgroundHex,
      ratio,
      passesAA: ratio >= 4.5,
      passesAAA: ratio >= 7.0
    };
  }

  private getLuminance(hex: string): number {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    const num = parseInt(full, 16) || 0;

    const r = ((num >> 16) & 255) / 255;
    const g = ((num >> 8) & 255) / 255;
    const b = (num & 255) / 255;

    const sRGB = [r, g, b].map(val => {
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  }
}
