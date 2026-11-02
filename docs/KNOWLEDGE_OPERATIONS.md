# Local knowledge and shadow operations

`knowledge:install` and `knowledge:update` accept `--bundle <local-json-file>`. They currently support local SQLite; they never fetch remote datasets implicitly. The bundle contains a `pack` matching the knowledge-pack schema and a `datasets` array. Every dataset supplies a `manifest`, an explicit `version`, and non-empty `documents` with unique `id`, `content`, and `sourceUri` fields.

```json
{
  "pack": { "id": "local-notes", "name": "Local notes", "category": "custom", "datasetIds": ["observatory"] },
  "datasets": [{
    "manifest": { "id": "observatory", "slug": "observatory", "name": "Observatory", "provider": "Local", "sourceType": "custom", "sourceUri": "https://example.org/observatory", "license": { "id": "MIT", "redistributable": true } },
    "version": "1",
    "documents": [{ "id": "hours", "content": "The observatory opens Thursday.", "sourceUri": "https://example.org/observatory/hours" }]
  }]
}
```

Run `npm run knowledge:install -- --bundle notes.json`. Repeat installation is idempotent. To replace content, give it a new version and run `knowledge:update` with the complete bundle. Changed content under an existing version is rejected. Pack membership changes require a separate migration. All dataset replacements in a bundle commit together; failed validation or updates preserve the previous searchable content. Source provenance, licenses, versions, memberships, hashes, and completed jobs are persisted. Recognized, redistributable licensing is required. Inputs are bounded to 32 MiB.

`npm run chat:runtime:shadow-report -- --input comparisons.jsonl` summarizes recorded shadow comparisons, reporting divergent requests, parity rate, and average primary/shadow latency. Missing, malformed, or empty evidence fails; the command never invents parity. Set `CHAT_SHADOW_REPORT_PATH` to persist routing and latency summaries when using `ChatRuntimeShadowRunner`. This does not enable shadow execution or wire a second runtime into normal chat. Prompts and generated answers are omitted from saved summaries.

Coding workspace now offers **Coding job history**, with owner-scoped result downloads. Saved jobs and captured source expire after seven days; cleanup runs at startup, hourly, and after jobs complete, and skips active jobs. Downloads contain saved JSON results; applying any downloaded patch still requires the normal review flow.
