import fs from 'fs';
import os from 'os';
import path from 'path';
import { FileProcessor, ProcessableUploadFile } from '../FileProcessor';
import { DocumentManager } from '../../rag/DocumentManager';

jest.mock('pdf-parse', () => {
  return jest.fn(async (_buffer: Buffer) => ({
    text: 'Extracted PDF text content for RAG pipeline indexing'
  }));
});

describe('RT-PLAT-009 / RT-UPL-001: FileProcessor Validation and Upload Processing Suite', () => {
  let tempUploadDir: string;
  let fileProcessor: FileProcessor;
  let mockDocManager: DocumentManager;

  beforeEach(() => {
    tempUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-processor-test-'));
    fileProcessor = new FileProcessor(tempUploadDir);
    mockDocManager = {
      addText: jest.fn(async () => ['chunk-1', 'chunk-2'])
    } as unknown as DocumentManager;
  });

  afterEach(() => {
    try {
      fs.rmSync(tempUploadDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('rejects files exceeding max size or with forbidden MIME types', async () => {
    // 1. Oversized file
    const oversizedFile = {
      originalname: 'huge.txt',
      mimetype: 'text/plain',
      size: 15 * 1024 * 1024,
      buffer: Buffer.alloc(100)
    } as ProcessableUploadFile;

    const sizeRes = await fileProcessor.processFile(oversizedFile, mockDocManager);
    expect(sizeRes.success).toBe(false);
    expect(sizeRes.error).toContain('File too large');

    // 2. Disallowed MIME type (e.g. exe or sh)
    const dangerousFile = {
      originalname: 'malicious.sh',
      mimetype: 'application/x-sh',
      size: 500,
      buffer: Buffer.from('rm -rf /')
    } as ProcessableUploadFile;

    const mimeRes = await fileProcessor.processFile(dangerousFile, mockDocManager);
    expect(mimeRes.success).toBe(false);
    expect(mimeRes.error).toContain('File type not allowed');
  });

  it('processes Markdown, Plain Text, JSON (object and string), and PDF files', async () => {
    // 1. Markdown
    const mdFile = {
      originalname: 'guide.md',
      mimetype: 'text/markdown',
      size: 200,
      buffer: Buffer.from('# Architecture Guide\nDetails here.')
    } as ProcessableUploadFile;

    const mdRes = await fileProcessor.processFile(mdFile, mockDocManager);
    expect(mdRes.success).toBe(true);
    expect(mdRes.chunks).toBe(2);

    // 2. Text
    const txtFile = {
      originalname: 'notes.txt',
      mimetype: 'text/plain',
      size: 150,
      buffer: Buffer.from('Plain text notes')
    } as ProcessableUploadFile;

    const txtRes = await fileProcessor.processFile(txtFile, mockDocManager);
    expect(txtRes.success).toBe(true);

    // 3. JSON object
    const jsonFile = {
      originalname: 'data.json',
      mimetype: 'application/json',
      size: 100,
      buffer: Buffer.from(JSON.stringify({ name: 'Project', count: 42 }))
    } as ProcessableUploadFile;

    const jsonRes = await fileProcessor.processFile(jsonFile, mockDocManager);
    expect(jsonRes.success).toBe(true);

    // 4. JSON string
    const jsonStrFile = {
      originalname: 'str.json',
      mimetype: 'application/json',
      size: 20,
      buffer: Buffer.from(JSON.stringify("raw-string-content"))
    } as ProcessableUploadFile;

    const jsonStrRes = await fileProcessor.processFile(jsonStrFile, mockDocManager);
    expect(jsonStrRes.success).toBe(true);

    // 5. PDF
    const pdfFile = {
      originalname: 'manual.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('%PDF-1.4 dummy buffer')
    } as ProcessableUploadFile;

    const pdfRes = await fileProcessor.processFile(pdfFile, mockDocManager);
    expect(pdfRes.success).toBe(true);
  });

  it('handles file deletion and non-existent file lookups', async () => {
    const txtFile = {
      originalname: 'temp.txt',
      mimetype: 'text/plain',
      size: 50,
      buffer: Buffer.from('to be deleted')
    } as ProcessableUploadFile;

    const res = await fileProcessor.processFile(txtFile, mockDocManager);
    expect(res.success).toBe(true);
    const fileId = res.metadata?.fileId;
    expect(fileId).toBeDefined();

    // Delete existing
    const deleted = await fileProcessor.deleteFile(fileId);
    expect(deleted).toBe(true);

    // Delete non-existent
    const deleteAgain = await fileProcessor.deleteFile('non-existent-id');
    expect(deleteAgain).toBe(false);
  });
});
