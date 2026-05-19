---
title: Multimodal and Office Ingestion
source: docs/rag/11_multimodal_office_ingestion.md
section: multimodal_office_ingestion
tags: [rag, ingestion, docx, doc, png, jpg, jpeg, bmp, gif, ocr]
last_updated: 2026-05-19
authority: canonical
---

# Multimodal and Office Ingestion

## Purpose

This document describes expanded RAG ingestion for Office files and image-based files.

The RAG system does not store raw pixels as text knowledge. It extracts useful text, metadata, and OCR-style summaries into `DocumentChunk` objects.

## Supported Extensions

The file type router advertises these extensions:

```txt
.txt
.md
.json
.pdf
.docx
.doc
.png
.jpg
.jpeg
.bmp
.gif
```

Primary code paths:

```txt
src/core/rag/DocumentIngester.ts
src/core/rag/DocumentManager.ts
src/core/rag/ingestion/FileTypeRouter.ts
src/core/rag/ingestion/TextLikeExtractor.ts
src/core/rag/ingestion/PdfExtractor.ts
src/core/rag/ingestion/OfficeExtractor.ts
src/core/rag/ingestion/ImageOcrExtractor.ts
src/core/rag/ingestion/ExtractedDocument.ts
```

## Architecture

Ingestion now flows through a router:

```txt
file path
  -> FileTypeRouter
  -> matching FileExtractor
  -> ExtractedDocument
  -> DocumentIngester.chunkText()
  -> optional embeddings
  -> DocumentChunk[]
```

`DocumentIngester` should not grow a giant extension switch for every new file type. New formats should be added as focused extractors.

## Office Ingestion

### DOCX

`.docx` support is handled by `OfficeExtractor`.

Preferred extraction path:

```txt
mammoth.extractRawText()
```

Fallback extraction path:

```txt
LibreOffice headless conversion to text
```

Operational note:

- `mammoth` is optional in code and must be installed if direct DOCX extraction is desired.
- If `mammoth` is unavailable or fails, `OfficeExtractor` attempts LibreOffice conversion unless disabled.

Recommended install for direct DOCX extraction:

```bash
npm install mammoth
```

### DOC

`.doc` is legacy binary Word format.

Supported approach:

```txt
LibreOffice headless conversion to text
```

Operational requirement:

- LibreOffice must be installed and `soffice` must be available on the system PATH.

Disable Office conversion when needed:

```ts
await documentManager.addFile('legacy.doc', {
  enableOfficeConversion: false,
  generateEmbeddings: true
});
```

When conversion is disabled or fails, RAG receives a diagnostic chunk instead of silently failing.

## Image OCR Ingestion

Supported still image extensions:

```txt
.png
.jpg
.jpeg
.bmp
```

Images are processed with:

```txt
sharp -> normalized PNG buffer -> tesseract.js OCR -> text chunk
```

OCR chunk content includes:

- image source
- image type
- image format
- image dimensions
- OCR block label
- OCR confidence when available
- OCR text or `[no text detected]`

Disable OCR when only metadata is wanted:

```ts
await documentManager.addFile('screenshot.png', {
  enableImageOcr: false,
  generateEmbeddings: true
});
```

Specify OCR language:

```ts
await documentManager.addFile('screenshot.png', {
  imageOcrLanguage: 'eng',
  generateEmbeddings: true
});
```

## GIF Ingestion

`.gif` files are handled by `ImageOcrExtractor`.

GIF behavior:

- Reads image metadata with `sharp`.
- Samples a limited number of frames/pages.
- Runs OCR on sampled frames.
- Produces a text chunk summarizing frame OCR results.

Configure max sampled frames:

```ts
await documentManager.addFile('demo.gif', {
  maxGifFrames: 4,
  imageOcrLanguage: 'eng',
  generateEmbeddings: true
});
```

Do not index every frame by default. Full-frame indexing can inflate chunk counts and slow retrieval.

## DocumentManager Options

`DocumentManager.addFile()`, `addText()`, and `addDirectory()` now accept `DocumentManagerIngestOptions`, which extends `IngestOptions`.

Useful options:

```ts
{
  chunkSize?: number;
  chunkOverlap?: number;
  generateEmbeddings?: boolean;
  embeddingProvider?: 'openai' | 'xenova' | 'ollama';
  enableImageOcr?: boolean;
  imageOcrLanguage?: string;
  maxGifFrames?: number;
  enableOfficeConversion?: boolean;
}
```

## Example: Ingest A Screenshot

```ts
await documentManager.addFile('assets/screenshots/error.png', {
  generateEmbeddings: true,
  enableImageOcr: true,
  imageOcrLanguage: 'eng',
  chunkSize: 500
});
```

## Example: Ingest A DOCX

```ts
await documentManager.addFile('docs/design/feature-spec.docx', {
  generateEmbeddings: true,
  enableOfficeConversion: true,
  chunkSize: 700
});
```

## Example: Ingest A GIF Demo

```ts
await documentManager.addFile('docs/demos/upload-flow.gif', {
  generateEmbeddings: true,
  enableImageOcr: true,
  maxGifFrames: 4,
  chunkSize: 700
});
```

## Metadata Expectations

Image chunks should include metadata such as:

```ts
{
  source: 'assets/screenshots/error.png',
  title: 'error.png',
  type: 'image',
  originalExtension: '.png',
  width: 1280,
  height: 720,
  format: 'png',
  ocrLanguage: 'eng',
  ocrConfidence: 92
}
```

Office chunks should include metadata such as:

```ts
{
  source: 'docs/design/spec.docx',
  title: 'spec.docx',
  type: 'docx',
  extractor: 'mammoth'
}
```

## What This Is Not

This is not true multimodal vector search yet.

Current behavior converts visual and Office input into text chunks. For real visual retrieval, add a separate image embedding index later.

Future visual index targets:

- image embeddings
- sprite sheet metadata extraction
- diagram object detection
- frame thumbnails
- visual similarity search

## Known Limits

- OCR quality depends on image clarity.
- GIF frame sampling may miss text that appears between sampled frames.
- DOC extraction requires LibreOffice when `mammoth` is unavailable.
- DOCX direct extraction is best with `mammoth` installed.
- Scanned documents should go through OCR, not plain PDF extraction.

## Test Coverage

Current regression tests cover:

- Markdown ingestion through the router.
- Supported extension advertisement.
- Diagnostic chunks when Office conversion is disabled.

Recommended future tests:

- OCR disabled metadata-only image ingestion.
- PNG OCR with a generated test fixture.
- GIF sampling behavior.
- DOCX extraction with `mammoth` installed.
- LibreOffice conversion skipped or failed behavior.

## Final Rule

RAG should ingest the useful meaning of a file, not blindly ingest the file itself.

For Office documents, useful meaning is extracted text and structure.

For images and GIFs, useful meaning is OCR text, dimensions, source metadata, and eventually visual descriptions or image embeddings.