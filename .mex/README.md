# mex project context

This directory is a local development aid for the ChatBot repository.

- Run `npx mex-agent graph` to rebuild `graph.db`.
- Run `npx mex-agent check` to inspect context drift.
- Run `npx mex-agent scope "task description"` to retrieve compact code context.

Production startup does not depend on mex. Generated graph databases are ignored by Git; the source code and human-maintained documentation remain authoritative.
