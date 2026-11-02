import { KnowledgeExtractor } from '../KnowledgeExtractor';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('pdf-parse', () => {
  return jest.fn().mockImplementation(() => Promise.resolve({
    text: 'CHAPTER 1\n\nIntroduction to TypeScript and Algorithms.\n\nCHAPTER 2\n\nAdvanced patterns for React state and Node backend services.\n\nfunction calculate() {\n  return 42;\n}'
  }));
});

describe('RT-KNOW-001: KnowledgeExtractor Parsing & Static Ingestion Suite', () => {
  let tempDir: string;
  let mdPath: string;
  let pdfPath: string;
  let outputPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'extractor-test-'));
    mdPath = path.join(tempDir, 'instructions.md');
    pdfPath = path.join(tempDir, 'encyclopedia.pdf');
    outputPath = path.join(tempDir, 'output.json');

    fs.writeFileSync(mdPath, [
      '/frontend — UI Architecture',
      'I. Purpose and Core Directives',
      'Here are the core rules for building interfaces.',
      '### Component Guidelines',
      'Always use functional components with explicit typing.',
      'import React from "react";',
      'function Button() { return <button />; }'
    ].join('\n'));

    fs.writeFileSync(pdfPath, 'dummy-pdf-content');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('extracts structured entries from markdown and pdf files', async () => {
    const extractor = new KnowledgeExtractor(pdfPath, mdPath, outputPath);
    const entries = await extractor.extractAll();

    expect(entries.length).toBeGreaterThan(0);
    expect(fs.existsSync(outputPath)).toBe(true);

    const saved = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    expect(saved.length).toBe(entries.length);

    // Verify markdown tags
    const codeEntry = entries.find(e => e.tags.includes('code') || e.tags.includes('import'));
    expect(codeEntry).toBeDefined();
  });

  it('handles missing input files gracefully', async () => {
    const missingExtractor = new KnowledgeExtractor(
      path.join(tempDir, 'missing.pdf'),
      path.join(tempDir, 'missing.md'),
      outputPath
    );

    const entries = await missingExtractor.extractAll();
    expect(entries).toEqual([]);
  });

  it('handles pdf parsing errors gracefully', async () => {
    const pdfParse = require('pdf-parse');
    pdfParse.mockRejectedValueOnce(new Error('Corrupted PDF bytes'));

    const extractor = new KnowledgeExtractor(pdfPath, mdPath, outputPath);
    const entries = await extractor.extractAll();

    // Still returns markdown entries
    expect(entries.length).toBeGreaterThan(0);
  });
});
