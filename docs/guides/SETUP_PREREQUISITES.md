# Setup Prerequisites and Clean-Clone Validation

## Document control

- Owner: Engineering
- Review date: 2026-11-05
- Supported baseline: Node.js 20 LTS and npm on Windows, macOS, or Linux

## Clean clone

```bash
git clone https://github.com/DocDamage/chatbot.git
cd chatbot
npm ci
npm --prefix client ci
cp .env.example .env
```

On Windows PowerShell, replace the final command with:

```powershell
Copy-Item .env.example .env
```

Set a unique `JWT_SECRET` before starting. For a trusted local run that needs filesystem or desktop integrations, set `DEPLOYMENT_MODE=local`. Hosted deployments must use `DEPLOYMENT_MODE=hosted`; hosted mode rejects local execution flags.

## Build and verification

```bash
npm run type-check
npm run lint
npm test -- --runInBand
npm --prefix client test
npm run build
npm run smoke:package
```

Phase 2 repository checks:

```bash
node scripts/release/check-repository-inventory.mjs
node scripts/release/check-production-boundary.mjs
node scripts/release/check-file-size.mjs
node scripts/release/check-environment-contract.mjs
node scripts/release/check-docs.mjs
```

## Optional native dependencies

These are optional unless the selected local feature requires them:

- **Ollama:** local LLM inference.
- **FFmpeg and ffprobe:** audio/video metadata, preview, and conversion workflows.
- **OCR runtime used by Tesseract.js:** scanned-document workflows.
- **Sharp native binaries:** image processing; installed through npm for supported platforms.
- **Aseprite or Pixelorama:** external Sprite Lab adapters.
- **FL Studio and its configured MCP bridge:** local-only DAW control.

The application must report a disabled or degraded feature when an optional dependency is missing. Missing optional software must not be disguised as a successful operation.

## Deployment profiles

- `development`: developer defaults; local-only routes may be present.
- `test`: deterministic automated-test profile.
- `local`: trusted single-machine profile that may explicitly enable local integrations.
- `hosted`: network-served profile; local-only routes and execution are unavailable.

See [Deployment Modes](../DEPLOYMENT_MODES.md) and [Repository Hygiene](../architecture/REPOSITORY_HYGIENE.md).
