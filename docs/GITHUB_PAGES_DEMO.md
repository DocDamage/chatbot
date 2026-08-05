# GitHub Pages Static Demo

GitHub Pages is retained only as a public, static interface demonstration for AI Chatbot Hub.

- Demo URL: `https://docdamage.github.io/chatbot/`
- Runtime mode: `static-demo`
- Production status: not a production deployment
- Backend/API connection: prohibited for this Pages configuration

## What the demo includes

The site shows a non-interactive example of the product interface and clearly identifies itself as a GitHub Pages demo.

## What the demo does not include

The Pages artifact has no Express server, authentication, database, Redis, model provider, persistence, file access, document ingestion, local tools, desktop integrations, administration, or production monitoring. The composer and action controls are disabled. The demo does not send prompts or execute actions.

## Build safety

The Pages workflow sets `VITE_RUNTIME_MODE=static-demo` and intentionally leaves `VITE_PUBLIC_API_BASE_URL` unset. The Vite configuration rejects a Pages build that selects application mode or supplies an API base URL. Static artifact smoke checks verify repository-scoped assets, the limitation marker, absence of source maps, and common secret patterns.

A separately hosted API may not be connected to Pages without a new security review covering authentication, CORS, CSRF, abuse controls, data residency, and public-origin risk.

## Deployment verification

The Pages workflow performs:

1. isolated client installation;
2. client type-checking;
3. focused static-demo tests;
4. production static build;
5. artifact smoke verification;
6. Pages deployment;
7. live HTTP smoke verification of the page and referenced assets.

The separately hosted production application remains governed by the production hosting and deployment ADRs. Passing this demo workflow does not certify the full application.
