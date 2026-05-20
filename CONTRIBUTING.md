# Contributing to AI Chatbot Hub

Thanks for helping improve AI Chatbot Hub. This project is a TypeScript chatbot platform with an Express backend, a Vite/React client, knowledge and file tooling, mode-specific behavior, and a static GitHub Pages client build.

## Getting Started

Install dependencies from the repository root:

```bash
npm ci
cd client
npm ci
```

Run the full local app from the repository root:

```bash
npm run dev
```

The root dev command starts the backend and Vite client together. The GitHub Pages deployment is a static client build, so backend-backed features must either be unavailable there or guard their API calls.

## Development Workflow

- Create focused branches from `main`.
- Keep each pull request scoped to one feature, fix, or documentation change.
- Use clear commit messages; Conventional Commits are preferred.
- Update documentation when behavior, setup, or deployment expectations change.
- Add or update tests when changing behavior.

## Verification

Before opening a pull request, run the checks that match your change:

```bash
npm run type-check
npm test -- --runInBand
npm run build
cd client
npm run build
```

For GitHub Pages-specific changes, also run:

```bash
cd client
$env:GITHUB_PAGES = "true"
npm run build
```

For user-facing UI changes, include a manual browser check or screenshot notes in the pull request.

## Project Notes

- Backend code lives under `src/`.
- Client code lives under `client/src/`.
- Tests are run with Jest from the repository root.
- GitHub Actions handles CI and GitHub Pages deployment from `main`.
- Keep local secrets in `.env`; do not commit real credentials.

## Pull Requests

Pull requests should include:

- A short summary of the user-facing or developer-facing change
- The verification commands you ran
- Screenshots or recordings for UI changes
- Notes for behavior that differs between local full-stack mode and GitHub Pages

By participating, you agree to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).
