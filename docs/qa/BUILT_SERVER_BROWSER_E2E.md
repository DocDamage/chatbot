# Built-server browser E2E

The browser gate exercises the production-shaped artifact: a compiled React client served by the compiled Express server. It is intentionally separate from the Jest service E2E harness.

## Commands

```bash
# Prepare isolated text, image, audio, local-tool, and SQLite fixtures.
npm run test:browser:prepare

# Build and run the full browser gate.
npm run test:browser

# Run service and browser E2E layers together.
npm run test:e2e
```

The client browser commands use the same isolated Playwright tooling as accessibility checks:

```bash
cd client
npm run test:browser:deps
npm run test:browser:browsers
npm run test:browser:e2e
```

The browser profile uses port `4180`, the template adapter, an isolated SQLite database at `data/browser-e2e-output/chatbot.db`, and deterministic fixtures under `data/browser-e2e-fixtures`. It does not remove the normal local `data/chatbot.db`.

## Coverage boundaries

- JWT authentication, role authorization, and expired sessions are tested at the real API boundary because the application does not yet provide an end-user login screen.
- Chat, settings, mode switching, SSE streaming, and persisted conversation history use the compiled application.
- File/audio context, Knowledge Online approval, local-tool approval, Sprite Lab manifest generation, readiness/provider degradation, and mobile chat are covered with deterministic fixtures or explicit HTTP-boundary mocks.
- Playwright JSON/HTML reports and failure diagnostics are written under `client/test-results/browser/` and `client/playwright-report/browser/`.
