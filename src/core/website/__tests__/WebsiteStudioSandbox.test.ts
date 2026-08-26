import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ResponsivePreviewRenderer } from '../ResponsivePreviewRenderer';
import { WebsiteSandboxUndoManager } from '../WebsiteSandboxUndoManager';
import { WebsiteProjectSchema } from '../WebsiteTypes';

describe('RT-WEB-001 — Sandboxed Preview, Block Editing, and Security Suite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-sandbox-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('renders preview HTML within safe sandboxed container', () => {
    const project: WebsiteProjectSchema = {
      schemaVersion: '2.0.0',
      id: 'web-1',
      name: 'Sample Website',
      description: 'Landing page demo',
      theme: {
        colors: {
          primary: '#6366f1',
          secondary: '#ec4899',
          background: '#0a0a0c',
          foreground: '#f8fafc',
        },
        typography: {
          fontFamilyHeading: 'Inter',
          fontFamilyBody: 'Inter',
        },
        spacing: {
          sectionPadding: '2rem',
        },
        radii: {
          base: '8px',
        },
        shadows: {},
      },
      pages: [
        {
          id: 'p1',
          title: 'Home',
          slug: 'home',
          blocks: [
            {
              id: 'b1',
              type: 'hero',
              title: 'Hero Title',
              subtitle: 'Welcome to our web app',
            },
          ],
        },
      ],
      assets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const renderer = new ResponsivePreviewRenderer();
    const html = renderer.renderPageHtml(project);

    expect(html).toContain('Hero Title');
    expect(html).toContain('Content-Security-Policy');
  });

  it('manages file staging and rollback in sandbox transactions', () => {
    const undoManager = new WebsiteSandboxUndoManager(tempDir);
    const txId = undoManager.beginTransaction();

    undoManager.stageFileWrite(txId, 'index.html', '<h1>Hello World</h1>');
    expect(fs.existsSync(path.join(tempDir, 'index.html'))).toBe(true);

    const rollbackSuccess = undoManager.rollbackTransaction(txId);
    expect(rollbackSuccess).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'index.html'))).toBe(false);
  });
});
