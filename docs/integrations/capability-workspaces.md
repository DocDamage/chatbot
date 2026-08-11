# Capability workspace integrations

This document records the selected capabilities from the repository review and where they live in AI Chatbot Hub. The intent is to preserve useful behavior without copying entire upstream applications into the main chatbot.

## Decisions

| Upstream project | Decision | Chatbot implementation |
| --- | --- | --- |
| [devlens-agent](https://github.com/DocDamage/devlens-agent) | Adopt the analysis direction | Project Intelligence panel and `/api/project-intelligence/*` combine file metrics, symbols, complexity, Git churn, risk, duplicate candidates, and recommendations. |
| [Monoleaf](https://github.com/DocDamage/Monoleaf) | Adopt the Markdown-first review direction | Document Workspace supports drafting, review findings, edits, and a review-token-gated save into the knowledge base. |
| [norito-devtoolbox](https://github.com/DocDamage/norito-devtoolbox) | Curate, do not embed all utilities | Curated Utilities contains JSON, regex, Markdown inspection, and encoding helpers that run in the browser. |
| [capsule](https://github.com/DocDamage/capsule) | Adopt the local fixture workflow | Mock API Sandbox imports JSON/CSV into `data/mock-api` and provides collection previews under `/api/mock-api/*`. |
| [OpenForge No-code website builder](https://github.com/DocDamage/OpenForge_No-code-website-builder) | Adopt the block model and safe preview | Website Workspace persists a constrained JSON project, renders escaped block content into a sandboxed iframe, and returns HTML from `/api/website-workspace/*`. |
| [remembrandt](https://github.com/DocDamage/remembrandt) | Adopt the file-based memory shape | Project Memory stores entries under `.remembrandt/entries` and regenerates `.remembrandt/MEMORY.md`. The directory is ignored by Git by default. |
| [basemind](https://github.com/DocDamage/basemind) | Use as architecture reference | Existing `mex`, graph, RAG, project intelligence, and project memory remain separate bounded services rather than embedding a second MCP server. |
| [SpeakoFlow](https://github.com/DocDamage/SpeakoFlow) | Adopt the explicit-consent boundary | Desktop Companion reports capabilities and accepts approved transcript/screen-summary context; native OS capture remains an optional companion responsibility. |
| [Lexicon](https://github.com/DocDamage/Lexicon) | Adopt writing-review patterns | Document Workspace includes concise, bullet-list, and professional transforms plus structural review before persistence. |
| [UNICODER](https://github.com/DocDamage/UNICODER) | Exclude | It is not part of this chatbot implementation. |

## Local-only boundary

All new workspaces are hidden from the simple chat view and appear only after **Settings → Open advanced workspace**. Their routes are developer-authenticated and marked `LOCAL_ONLY_EXPERIMENTAL` in `src/server/routeManifest.ts`:

- `/api/project-intelligence/*`
- `/api/project-memory/*`
- `/api/document-workspace/*`
- `/api/mock-api/*`
- `/api/website-workspace/*`
- `/api/desktop-companion/*`

Generated state goes under `data/` or `.remembrandt/` and is excluded from release inventory and Git by default. The document workspace is the exception in behavior, not storage policy: after final review, its Markdown is saved under `data/document-workspace` and ingested through the same `DocumentManager`/RAG path used by the rest of the knowledge base.

## Safety and review rules

- Website preview content is escaped, colors are allow-listed, links accept only safe schemes, and the iframe has no script permission.
- Mock API data is local fixture data, not a network-facing server and not a replacement for authentication or production API testing.
- Project memory is local project state; it can be committed intentionally later, but it is ignored by default to avoid leaking workspace notes.
- Document changes invalidate the review token. Saving requires the exact content and title that were reviewed.
- Desktop screen/voice context is explicit per request. The browser does not capture the screen automatically.
- Basemind, mex, and the upstream desktop projects remain optional references or companion processes; the chatbot does not require them to start.

## Verification

The core services have unit coverage for review-token invalidation, JSON/CSV fixture persistence, website escaping, route-manifest audit metadata, and the existing release suites. Run:

```bash
npm run type-check
npm run lint
npm test -- --runInBand src/core/documents/DocumentReviewService.test.ts src/core/local-tools/MockApiWorkspaceService.test.ts src/core/website/WebsiteWorkspaceService.test.ts src/server/routeManifest.test.ts
```
