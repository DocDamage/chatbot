# ADR-0006 — Supported Operating Systems for Local Integrations

- **Status:** Accepted
- **Date:** 2026-08-05
- **Decision owners:** AI Chatbot Hub release governance
- **Authorized task:** `P00-T04`
- **Decision baseline:** `main` commit `4b10a434f5b60216608da74303d4193bc289e372`

## Context

The server code is Node.js and can be developed on multiple operating systems, but local integrations discover executables, manipulate paths, spawn processes, and interact with desktop tools. The local-tool service has explicit Windows discovery behavior and known paths for applications such as Aseprite, Blender, and Godot. No complete local-integration matrix exists for macOS or Linux.

## Decision

1. **The initial supported host for `LOCAL_TRUSTED` integrations is Windows 11 x64.**
2. **The initial hosted runtime target is Linux x86_64 in an OCI container.**
3. macOS and desktop Linux may be used for development where the core application works, but local filesystem, command, media, Sprite Lab, DAW, and desktop integrations are not production-supported there until a dedicated compatibility matrix passes.
4. Windows support includes path, drive-letter, junction, executable, process-tree, quoting, and permission behavior. WSL is treated as a separate environment and is not an implied substitute for native Windows testing.
5. Browser support is governed separately by Phase 8 and is not inferred from the server operating-system decision.
6. Every local integration must declare its exact OS and external-tool prerequisites in the feature manifest and health diagnostics.

## Alternatives considered

### Claim cross-platform support from Node.js portability

Rejected. Process spawning, executable discovery, filesystem semantics, and desktop integration differ materially by operating system.

### Support Windows only for every deployment

Rejected. A Linux container is the safer and more conventional hosted target, while Windows remains the user's primary local-integration environment.

### Support Windows, macOS, and Linux local integrations initially

Rejected because no complete test hardware, automation, or fixture matrix exists.

## Consequences

### Positive

- Local QA has one authoritative operating-system target.
- Hosted container hardening is not constrained by Windows desktop requirements.
- Cross-platform claims remain evidence-based.

### Negative

- macOS and desktop Linux users receive no initial support promise for local integrations.
- Windows-specific security tests are mandatory.
- The project must maintain distinct hosted and local build/test paths.

## Security and data impact

- Windows tests must cover junctions, UNC/device paths, alternate data streams where applicable, PowerShell/cmd quoting boundaries, executable extensions, and child-process termination.
- Linux container tests must verify non-root execution, read-only filesystem expectations, dropped capabilities, and confined writable paths.
- No operating system is considered a security boundary without route and capability enforcement.

## Verification obligations

- `P04-T05` and `P04-T06`: Windows path and command-abuse tests.
- `P07-T06`, `P07-T07`, `P07-T12`, `P07-T13`, and `P07-T17`: Windows 11 local runtime evidence.
- `P11-T02`: Linux OCI image hardening.
- `P12-T01` and `P12-T03`: clean-machine and cross-configuration acceptance.
- `P08-T07`: browser matrix independent of the host OS matrix.

## Unresolved assumptions

- Windows Server is not selected as a local-integration target.
- ARM64 is not part of the initial support matrix.
- macOS/Linux promotion requires later hardware or CI resources and a new evidence-backed decision.

## Superseded decisions

None. This ADR replaces broad portability assumptions with explicit support targets.

## Repository evidence reviewed

- `src/core/local-tools/LocalToolService.ts`
- `src/core/tools/CommandRunner.ts`
- `src/core/tools/CodeExecutor.ts`
- Sprite Lab and FL Studio integration files
- `docs/DEPLOYMENT_MODES.md`
