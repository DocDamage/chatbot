/**
 * Phase PX-16: Visual Website and Click-to-Code Studio
 * Type Definitions & Schema Contracts
 */

export type BlockType =
  | 'hero'
  | 'text'
  | 'features'
  | 'cta'
  | 'navbar'
  | 'footer'
  | 'testimonial'
  | 'gallery'
  | 'pricing'
  | 'faq'
  | 'stats'
  | 'contactForm';

export type ViewportMode = 'desktop' | 'tablet' | 'mobile' | 'custom';

export interface ViewportDimension {
  width: number;
  height: number;
  label: string;
}

export const STANDARD_VIEWPORTS: Record<ViewportMode, ViewportDimension> = {
  desktop: { width: 1280, height: 800, label: 'Desktop (1280px)' },
  tablet: { width: 768, height: 1024, label: 'Tablet (768px)' },
  mobile: { width: 375, height: 667, label: 'Mobile (375px)' },
  custom: { width: 1024, height: 768, label: 'Custom' }
};

export interface DesignTokens {
  colors: {
    primary?: string;
    secondary?: string;
    background?: string;
    foreground?: string;
    accent?: string;
    surface?: string;
    muted?: string;
    border?: string;
  };
  typography: {
    fontFamilyHeading?: string;
    fontFamilyBody?: string;
    fontSizeBase?: string;
    lineHeightBase?: string;
  };
  spacing: {
    sectionPadding?: string;
    containerMaxWidth?: string;
    gapBase?: string;
  };
  radii: {
    base?: string;
    card?: string;
    button?: string;
  };
  shadows: {
    card?: string;
    dropdown?: string;
  };
}

export interface BlockStyleOverrides {
  backgroundColor?: string;
  textColor?: string;
  paddingTop?: string;
  paddingBottom?: string;
  textAlign?: 'left' | 'center' | 'right';
  customClass?: string;
}

export interface WebsiteBlockData {
  id: string;
  type: BlockType;
  title?: string;
  subtitle?: string;
  body?: string;
  eyebrow?: string;
  items?: Array<{
    id?: string;
    title?: string;
    description?: string;
    icon?: string;
    price?: string;
    badge?: string;
    href?: string;
    ctaText?: string;
    rating?: number;
    avatarUrl?: string;
    author?: string;
    role?: string;
  }>;
  ctaText?: string;
  ctaHref?: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  imageUrl?: string;
  imageAlt?: string;
  videoUrl?: string;
  links?: Array<{ label: string; href: string }>;
  style?: BlockStyleOverrides;
  ariaLabel?: string;
  ariaRole?: string;
}

export interface SEOConfig {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
}

export interface PageDefinition {
  id: string;
  slug: string;
  title: string;
  description?: string;
  blocks: WebsiteBlockData[];
  seo?: SEOConfig;
  isHome?: boolean;
}

export interface WebsiteAsset {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
  url: string;
  altText: string;
  focalPoint?: { x: number; y: number };
  responsiveVariants?: Array<{ width: number; height: number; url: string; format: 'webp' | 'png' | 'jpg' }>;
  uploadedAt: string;
  isRemote?: boolean;
  approvedForRemoteLoad?: boolean;
}

export interface BreakpointConfig {
  mobileMax: number;
  tabletMax: number;
  desktopMin: number;
}

export interface ExportConfig {
  target: 'standalone-html' | 'zip-bundle' | 'react-static';
  minify: boolean;
  includeSourceMaps: boolean;
  generateRobotsTxt: boolean;
  generateSitemap: boolean;
  inlineCss: boolean;
}

export interface WebsiteProjectSchema {
  schemaVersion: '2.0.0';
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  theme: DesignTokens;
  pages: PageDefinition[];
  assets: WebsiteAsset[];
  customCss?: string;
  breakpoints?: BreakpointConfig;
  exportConfig?: ExportConfig;
}

export interface BoxModelMetrics {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  padding: { top: number; right: number; bottom: number; left: number };
  border: { top: number; right: number; bottom: number; left: number };
}

export interface InspectorSelection {
  elementId: string;
  blockId: string;
  blockType: BlockType;
  tagName: string;
  classes: string[];
  matchedStyles: Record<string, string>;
  boxModel: BoxModelMetrics;
  ariaAttributes: Record<string, string>;
  computedContrast?: {
    foreground: string;
    background: string;
    ratio: number;
    passesAA: boolean;
    passesAAA: boolean;
  };
  sourceLocation?: SourceLocationInfo;
}

export interface SourceLocationInfo {
  filePath: string;
  componentName: string;
  startLine: number;
  endLine: number;
  confidence: 'HIGH' | 'MEDIUM' | 'HEURISTIC';
}

export interface VisualEditProposal {
  id: string;
  projectId: string;
  targetBlockId: string;
  targetElementId?: string;
  instruction: string;
  proposedPatch: {
    targetFiles: string[];
    diff: string;
    summary: string;
    blockMutation?: Partial<WebsiteBlockData>;
  };
  responsiveImpactSummary: string;
  accessibilityImpact: {
    contrastChanged: boolean;
    ariaChanged: boolean;
    wcagScoreBefore: number;
    wcagScoreAfter: number;
    warnings: string[];
  };
  testsToRun: string[];
  approvalDigest: string; // SHA-256
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'ROLLED_BACK';
  createdAt: string;
  appliedAt?: string;
}

export interface SandboxTransaction {
  id: string;
  timestamp: string;
  proposalId?: string;
  affectedFiles: Array<{
    filePath: string;
    preEditContent: string;
    postEditContent: string;
  }>;
  status: 'COMMITTED' | 'ROLLED_BACK';
}

export interface WebAuditIssue {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  elementId?: string;
  blockId?: string;
  wcagCriterion?: string;
}

export interface WebAuditReport {
  score: number; // 0-100
  passedChecks: number;
  totalChecks: number;
  issues: WebAuditIssue[];
  timestamp: string;
}
