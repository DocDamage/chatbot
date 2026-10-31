# Coding tools with local Ollama

The **Coding workspace** panel in chat integrates Serena, Aider, ast-grep and Context7. These are optional local developer tools, separately installed from the core application. They do not require an OpenAI account or key.

## Setup

Install Node 22.13+ or Node 24, npm, [uv](https://docs.astral.sh/uv/) and Python 3.12. The optional ESLint 10 runtime requires this Node minimum. Start Ollama with an installed model. Then run:

```sh
npm run setup:coding-tools
npm run build
npm run start:local
```

Setup installs the locked npm tools under `services/coding-tools/node_modules` and hash-locked Python environments under `data/coding-tools/runtime`. It records executable paths in ignored `services/coding-tools/runtime.json` and enables `CODING_TOOLS_ENABLED` in your local `.env`. It does not download model weights or replace system Python/Node.

The default model is `CODING_OLLAMA_MODEL`, falling back to `OLLAMA_MODEL` and then `qwen3:8b`. The coding adapter accepts only an HTTP loopback Ollama endpoint. `CODING_CONTEXT_TOKENS=16384` reserves a separate coding context window; ordinary chat keeps its own `OLLAMA_CONTEXT_TOKENS`. Coding enables reasoning for known `qwen3:`, `deepseek-r1:` and `gpt-oss:` model names, with a longer bounded repair response timeout; ordinary chat keeps its own thinking setting. Smaller contexts may reject larger source selections. Only Windows with the recorded installed tool versions has received live validation.

`CODING_WORKSPACE_ROOT` selects the repository for the coding tools and native coding routes. It defaults to the chatbot checkout. Set an absolute directory in `.env` and restart to work on another project. This is a trusted local developer workspace, not an operating-system sandbox. Hosted deployments deny the coding routes.

## Daily workflow

1. Open **Coding workspace** below the chat history controls. Select repository-relative editable source files, one path per line, or leave the list empty and name an implementation file or symbol in the task. Add new file paths explicitly.
2. Describe the task and concrete acceptance criteria. For framework-specific work, enable the Context7 lookup and supply a documentation question and library ID.
3. Keep **Automatically find supporting files** enabled to gather relative imports, importing callers and related tests as read-only context. Select **Draft changes**. Aider reads and edits a private copy with local Ollama. The repository stays unchanged. Review the complete proposed diff and **Files selected for this draft**, which identifies editable files and read-only context separately.
4. Switch chat to **Build**, then select **Apply reviewed patch**. File content/hash preconditions reject stale drafts.
5. Select **Verify applied changes** to run detected, supported project checks. A successful draft is not a successful test run. Review the actual commands and results.
6. If checks fail, switch to **Debug** and select **Repair approved files and verify**. Repair gets fresh source, the captured supporting files as read-only context, current errors, and optional documentation. It may modify only the approved patch's file set, for at most three rounds. When coding integrations are enabled, fresh repair candidates receive static validation before application, with at most two candidates per round. Failure, blocked checks, and exhausted budgets remain visible.

Verification executes repository-defined commands on your machine. Use repositories and scripts you trust. Review tests as carefully as implementation changes; a model can write incomplete assertions. The live evaluation includes a mutation check so generated tests must detect a deliberately broken implementation.

| Tool | Available behavior | Boundary |
| --- | --- | --- |
| Serena 2.1.0 | Find a symbol and referencing symbols through a language server | Selected source snapshot; no whole-repository completeness claim. Include definition, likely callers and relevant configuration. Language server availability varies. |
| Aider 0.86.2 | Draft modifications and explicitly named new files with Ollama | Up to 12 total files, 16 KB existing source, and a combined context budget. No Git commits, target execution, cloud fallback or unrestricted shell in the worker. |
| ast-grep 0.51.0 | Structural pattern search and replacement previews | Selected files and an explicit language. Replacements use the same reviewed patch path. |
| Context7 MCP 4.4.4 | Resolve a library name, then retrieve cited documentation by `/owner/library` ID | Uses Context7's external service. Only the supplied library/question are submitted by this adapter; keep private source/secrets out of questions. Check returned versions. |

Aider's draft checks cover changed JavaScript syntax, new literal relative CommonJS imports, TypeScript compiler diagnostics and a fixed ESLint correctness profile. These checks also run on ast-grep replacement previews and fresh model repairs when coding integrations are enabled. Invalid structural previews remain conflicted; Aider and model repair receive actual static diagnostics for bounded correction. Static checks never execute the target source. Project verification executes supported configured checks after application. Missing toolchains, no detected checks, and omitted checks due to a command budget do not count as passing.

## Context selection and static checks

Automatic selection scans up to 400 source files / 512 KB, with named files and nearby directories prioritized. Up to 12 files / 16 KB are captured across editable and read-only source, with additional task/documentation/repair prompt budgets. Existing explicit edit scopes stay explicit. Task-only requests select matching implementation files; tasks without a grounded file or symbol ask for a selection instead of guessing. Supporting files cannot be edited by the Aider worker and their content is checked after generation. New files always require explicit paths. Disable automatic selection to supply every file manually.

Relative JavaScript/TypeScript imports, their importing callers (including aliases) and similarly named tests are followed. Package aliases, build-output imports, other languages and files outside the scan/context limits can require explicit selection. The result lists captured paths, roles, reasons and omissions. This is bounded context retrieval, not a complete repository index.

The TypeScript 5.9 compiler uses captured source plus available project type declarations and standard libraries. Nearest static `tsconfig.json` settings and contained relative inheritance are honored; executable plugins and package-based config inheritance are not loaded. Compiler input is bounded and supports at most four project configurations per draft. Unselected implementation files remain outside the compiler snapshot. ESLint 10 runs in a separate process with a fixed correctness profile covering undefined JavaScript names, unreachable code, invalid type comparisons and unsafe assignments/control flow. A project-owned rule also checks named imports/destructuring against exports from common trusted Node core modules, including the assertion modules. It does not execute project JavaScript configuration or project plugins, and inline disable comments cannot suppress this profile. Newly added TypeScript suppression directives also block drafts. Malformed repair JSON receives a bounded retry with a larger reserved output budget; incomplete responses never become applied patches.

Compiler/linter results compare the original snapshot against the draft. Baseline diagnostics can include missing context/dependencies rather than actual project defects. Existing errors are reported, and a comparison passing means no new errors were found in that scope; it does not certify the whole project. Diagnostics are matched by tool, path, code, message and source-line anchor, preserving counts while allowing line shifts. Other languages receive `not_applicable` compiler/linter results. Full configured project checks remain necessary.

## Property-based tests with fast-check

Enable **Include fast-check property test guidance** when drafting tests. The prompt includes the fast-check 4 API, a reproducible seed, bounded generators, assertions, input-preservation checks and async guidance. It does not install dependencies or claim tests ran. The target project must declare/install `fast-check` as a development dependency and include the generated test in its normal test command. This chatbot checkout pins `fast-check@4.10.2` for its development tests.

The internal property suite runs 500 seeded cases covering Unicode patch fidelity/stale edits, contained import resolution and diagnostic counts. The live Ollama evaluation also authors real fast-check tests, executes them, and requires them to detect identity, input-mutation and empty-output implementations. These probes do not establish complete test coverage.

Context7 works without a key within its service limits in the recorded live tests. An optional `CONTEXT7_API_KEY` may be set locally. No hosted provider is used for Aider generation. Cancellation terminates the per-request tool process tree; apply/verification requests currently finish once started.

## Reliability and evidence

Run `npm run verify:coding-tools` for an explicit live evaluation against installed tools and Ollama. It creates isolated source fixtures below ignored `data/coding-tools/evaluation-*`, validates alias references, structural rewrites, cited documentation, bug repair, multi-file feature work, generated tests and fresh model repair. It never edits the chatbot source tree. Each run records its actual outcomes in `verification.json`; failures produce a nonzero exit code.

See the [original integration record](implementation/evidence/coding-tools/2026-10-31/verification.json) and [compiler/context/property-test record](implementation/evidence/coding-validation/2026-10-31/verification.json). The small local model can produce wrong first drafts and can exhaust the bounded repair loop. These fixtures establish the tested workflows, not arbitrary repository or language correctness. Keep tasks small, include relevant implementation/tests, use current API documentation and require passing project checks before accepting changes. Use `-- --case=substring` with the live evaluation command for a targeted development run; a final complete run should omit the filter.

Per-run snapshots, prompts, logs and results remain under ignored `data/coding-tools/jobs`. They may contain private source. There is no automatic retention cleanup or download/history UI yet. After work finishes, close the app before removing old job/evaluation directories. Keep `runtime` if you want to retain installed Python environments. Never commit `.env`, `runtime.json`, model data or job directories.

## Upstream licensing

All four adapters are project-owned protocol/process integration code. No upstream application source is copied into the core. Exact versions and Python hashes/npm integrity values are locked under `services/coding-tools`.

Serena's application is GPL-3.0-or-later; its SolidLSP component is MIT. The optional combined `serena-agent` runtime retains GPL terms. Aider and TypeScript are Apache-2.0; ast-grep, Context7 MCP, fast-check, ESLint, typescript-eslint/parser and globals are MIT. Full upstream license texts are retained beside the lockfiles. The optional environments are outside the core application's dependency SBOM; redistribution of those environments requires their full dependency notices and applicable source obligations. See [third-party notices](../THIRD_PARTY_NOTICES.md) and the [source register](implementation/CAPABILITY_SOURCE_REGISTER.md).
