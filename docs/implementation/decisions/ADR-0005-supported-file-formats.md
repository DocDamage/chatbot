# ADR-0005 — Supported File Formats

- **Status:** Accepted
- **Date:** 2026-08-05
- **Decision owners:** AI Chatbot Hub release governance
- **Authorized task:** `P00-T04`
- **Decision baseline:** `main` commit `4b10a434f5b60216608da74303d4193bc289e372`

## Context

The ingestion router advertises text, Markdown, JSON, PDF, DOC/DOCX, PNG, JPEG, BMP, and GIF extensions. Some extractors depend on optional local tools, and unknown extensions currently fall back to UTF-8 reads. Extension routing alone does not prove content-type validation, safe parser behavior, resource limits, OCR quality, provenance, corrupt-file handling, or production support.

## Decision

### Initial production-support targets

The following formats may be promoted to production support after the Phase 4 and Phase 7 verification requirements pass:

- UTF-8 plain text: `.txt`
- Markdown: `.md`
- JSON documents: `.json`
- Text-bearing PDF: `.pdf`
- Static raster images for OCR: `.png`, `.jpg`, `.jpeg`

### Preview or local-only candidates

- Scanned/image-only PDF OCR: preview until the OCR path and resource limits are verified.
- DOCX: preview until a maintained parser is a declared runtime dependency and fixtures pass.
- Legacy DOC: trusted-local preview only because extraction relies on LibreOffice conversion.
- BMP and GIF: preview; GIF extraction must have strict frame and decoded-pixel limits.
- Source-code extensions and extensionless text: may be read through explicitly text-safe workflows, but are not covered by generic fallback claims.

### Not supported in the initial release

- XLS/XLSX, PPT/PPTX, ODT/ODS/ODP.
- Audio and video as document-ingestion formats; their separate specialist workflows have independent support decisions.
- Archives, executables, disk images, email mailbox formats, and encrypted documents.
- Any unknown extension routed only by a blind UTF-8 fallback.

A format is supported only when MIME/content signatures, parser limits, corrupt/encrypted handling, provenance, cleanup, and real fixtures are verified. Filename extension alone is never sufficient.

## Alternatives considered

### Advertise every extension currently listed by the router

Rejected. Several paths are optional, local-tool dependent, or not hardened.

### Support only plain text

Rejected because PDF and image ingestion are core intended workflows and can be bounded with explicit release tests.

### Accept arbitrary files and let extraction fail

Rejected. It creates resource-exhaustion, parser, misleading-status, and data-handling risk.

## Consequences

### Positive

- User documentation can state a small, testable matrix.
- Parser hardening and QA can focus on formats that matter to the initial release.
- Optional conversion tools cannot silently create hosted dependencies.

### Negative

- Existing UI or documentation may need to remove broad format claims.
- DOCX and legacy Office workflows remain preview until dependencies and fixtures are complete.
- Separate media workflows require their own support matrix.

## Security and data impact

- Uploads require content-signature verification, size/page/pixel/frame limits, randomized storage names, quarantine, cleanup, and path confinement.
- Extracted text and metadata inherit the source's ownership and retention policy.
- Parser errors must not leak file contents or host paths.
- Remote URLs embedded in documents must not trigger unrestricted outbound requests.

## Verification obligations

- `P04-T04`: harden upload and parser boundaries.
- `P04-T07`: block parser-induced SSRF.
- `P07-T08`: execute the real fixture matrix and remove any unverified format from claims.
- `P08-T02`: provide unsupported, corrupt, encrypted, oversized, and dependency-unavailable states.
- `P09-T04`: enforce upload, page, pixel, frame, duration, and extraction-result caps.

## Unresolved assumptions

- The maintained DOCX parser has not yet been selected.
- OCR language packs and supported languages remain a Phase 7 decision.
- Maximum sizes and page counts remain to be derived from performance tests.

## Superseded decisions

None. This ADR supersedes the assumption that `getSupportedExtensions()` is a production support declaration.

## Repository evidence reviewed

- `src/core/rag/ingestion/FileTypeRouter.ts`
- `src/core/rag/ingestion/ExtractedDocument.ts`
- `src/core/rag/ingestion/OfficeExtractor.ts`
- PDF, text, and image OCR extractor files
- `package.json`
