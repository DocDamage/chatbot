## Compiler, linter and property-test dependencies (2026-10-31)

`fast-check@4.10.2` is a root development dependency (MIT, copyright 2017 Nicolas DUBIEN), included in the core dependency SBOM. Its full notice is retained in [LICENSE.fast-check](../../services/coding-tools/LICENSE.fast-check). The optional coding environment additionally pins ESLint 10.14.0 (MIT, OpenJS Foundation and other contributors), typescript-eslint/parser 8.59.4 (MIT, copyright 2019 typescript-eslint and other contributors), TypeScript 5.9.3 (Apache-2.0) and globals 17.13.0 (MIT, Sindre Sorhus). Their full notices are retained in [LICENSE.eslint](../../services/coding-tools/LICENSE.eslint), [LICENSE.typescript-eslint](../../services/coding-tools/LICENSE.typescript-eslint), [LICENSE.typescript](../../services/coding-tools/LICENSE.typescript), and [LICENSE.globals](../../services/coding-tools/LICENSE.globals). These unmodified optional packages and their transitive notices remain separate from the base runtime SBOM; TypeScript is also an existing core dependency.

## Optional coding runtimes (2026-10-31)

These packages run in separate optional environments; project-owned adapters communicate through stdio MCP/CLI and local Ollama. No upstream application source is incorporated into the core. Their lockfiles, integrity hashes and complete upstream license texts are under `services/coding-tools`; transitive package notices remain in the installed environments and are outside the base application SBOM.

| Runtime | License and copyright | Retained license |
| --- | --- | --- |
| `serena-agent==2.1.0` ([Oraios Serena](https://github.com/oraios/serena)) | Application GPL-3.0-or-later, SolidLSP MIT; copyright 2025–2026 Jain & Panchenko IT-Berater Partnerschaft (Oraios AI) and contributors. The combined runtime is GPL-3.0-or-later. | [Component policy](../../services/coding-tools/LICENSE.serena), [GPL](../../services/coding-tools/LICENSE.serena-gpl), [MIT](../../services/coding-tools/LICENSE.serena-mit) |
| `aider-chat==0.86.2` ([Aider](https://github.com/Aider-AI/aider)) | Apache-2.0; upstream copyright notices retained in the package and full license | [Apache license](../../services/coding-tools/LICENSE.aider) |
| `@ast-grep/cli@0.51.0` ([ast-grep](https://github.com/ast-grep/ast-grep)) | MIT; copyright 2022 Herrington Darkholme | [MIT license](../../services/coding-tools/LICENSE.ast-grep) |
| `@upstash/context7-mcp@4.4.4` ([Context7](https://github.com/upstash/context7)) | MIT; copyright 2021 Upstash, Inc. | [MIT license](../../services/coding-tools/LICENSE.context7) |

Context7's remote service and model weights have separate terms. Redistribution of optional runtimes must retain their licenses/dependency notices and fulfill applicable source obligations. The source register records the exact reviewed revisions; a repository revision is not a claim that the published package contains every change from that revision.

## Optional REA runtime

The optional adapter uses `rea-agents@6.8.0` (MIT), installed separately under `services/rea`. Source reference: [DocDamage/rea](https://github.com/DocDamage/rea), reviewed at `d48e472fa6a664cacbb400560e673533005795ce`; the npm package identifies [morluto/rea](https://github.com/morluto/rea) as upstream. Copyright (c) 2026 morluto. The full notice is retained in [services/rea/LICENSE.rea](../../services/rea/LICENSE.rea). Its separately locked transitive dependencies retain their package notices and are outside the base application SBOM.

