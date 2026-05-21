# Deployment Modes

## Local Development

Run both processes with hot reload:

```bash
npm run dev
```

- Client: `http://localhost:3000`
- API: `http://localhost:3001`
- The Vite dev server proxies `/api` to the API server.

## Full Production App

Build and run one same-origin app:

```bash
npm run build
npm start
```

- Open `http://localhost:3001`.
- Express serves `client/dist` and the API from the same origin.
- Required environment: `JWT_SECRET` with at least 32 characters.
- Required in production: explicit `CORS_ORIGIN`, for example `https://chat.example.com`.

Privileged API groups require a bearer token with `admin` or `developer` roles:

- `/api/settings`
- `/api/files`
- `/api/audio`
- `/api/plans`
- `/api/code`
- `/api/knowledge`
- `/api/knowledge-os`
- `/api/knowledge-online`
- `/api/admin`
- `/api/export`
- `/api/webhooks`

## Static Demo

The client can be built as static assets, but backend-only panels and API-backed workflows require the Express API. A static-only host should be treated as a demo shell unless it proxies `/api` and `/health` to a running backend.

## Smoke Checklist

Run:

```bash
npm run release:check
```

Then start the built server and verify:

- `GET /health/ready` returns `200` after startup.
- The browser loads the React app from the server port.
- Anonymous requests to privileged route groups return `401`.
- Admin/developer bearer tokens can access the intended privileged workflows.
