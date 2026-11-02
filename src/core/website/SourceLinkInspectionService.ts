/**
 * Phase PX-16: Source-Linked Inspection Service
 * PX16-T06
 */

import path from 'node:path';
import fs from 'node:fs';
import { SourceLocationInfo } from './WebsiteTypes';

export interface DevServerConfig {
  targetUrl: string;
  projectRoot: string;
  framework: 'vite-react' | 'nextjs' | 'vanilla' | 'generic';
}

export class SourceLinkInspectionService {
  private config?: DevServerConfig;

  constructor(config?: DevServerConfig) {
    if (config) {
      this.configureDevServer(config);
    }
  }

  public configureDevServer(config: DevServerConfig): void {
    // Confine projectRoot: ensure path exists and is absolute/resolved
    const resolvedRoot = path.resolve(config.projectRoot);
    if (!fs.existsSync(resolvedRoot)) {
      throw new Error(`Project root '${config.projectRoot}' does not exist.`);
    }

    // Block SSRF / dangerous hosts
    const url = new URL(config.targetUrl);
    const safeHosts = ['localhost', '127.0.0.1', '::1'];
    if (!safeHosts.includes(url.hostname)) {
      throw new Error(`Dev server target host '${url.hostname}' must be a loopback address.`);
    }

    this.config = {
      ...config,
      projectRoot: resolvedRoot
    };
  }

  public locateSourceElement(elementSelector: {
    dataLoc?: string; // e.g. "src/components/Hero.tsx:12:4"
    componentName?: string;
    blockType?: string;
  }): SourceLocationInfo | null {
    if (!this.config) {
      // Return heuristic fallback if no dev server connected
      return {
        filePath: `src/components/${elementSelector.blockType || 'Component'}.tsx`,
        componentName: elementSelector.componentName || capitalize(elementSelector.blockType || 'Component'),
        startLine: 1,
        endLine: 50,
        confidence: 'HEURISTIC'
      };
    }

    // If explicit dataLoc provided by dev tooling (e.g. Vite react-source plugin)
    if (elementSelector.dataLoc) {
      const parts = elementSelector.dataLoc.split(':');
      const relPath = parts[0];
      const startLine = parseInt(parts[1], 10) || 1;

      // Verify file is strictly confined inside projectRoot
      const fullPath = path.resolve(this.config.projectRoot, relPath);
      const relative = path.relative(this.config.projectRoot, fullPath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Source-map escape attempted: '${relPath}' is outside project root.`);
      }

      return {
        filePath: relPath.replace(/\\/g, '/'),
        componentName: path.basename(relPath, path.extname(relPath)),
        startLine,
        endLine: startLine + 30,
        confidence: 'HIGH'
      };
    }

    // Heuristic scan in projectRoot for component
    if (elementSelector.componentName) {
      const candidates = [
        `src/components/${elementSelector.componentName}.tsx`,
        `src/components/${elementSelector.componentName}.jsx`,
        `src/pages/${elementSelector.componentName}.tsx`,
        `src/${elementSelector.componentName}.tsx`
      ];

      for (const rel of candidates) {
        const full = path.resolve(this.config.projectRoot, rel);
        if (fs.existsSync(full)) {
          return {
            filePath: rel.replace(/\\/g, '/'),
            componentName: elementSelector.componentName,
            startLine: 1,
            endLine: 100,
            confidence: 'MEDIUM'
          };
        }
      }
    }

    return {
      filePath: `src/components/${capitalize(elementSelector.blockType || 'Section')}.tsx`,
      componentName: capitalize(elementSelector.blockType || 'Section'),
      startLine: 1,
      endLine: 40,
      confidence: 'HEURISTIC'
    };
  }
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
