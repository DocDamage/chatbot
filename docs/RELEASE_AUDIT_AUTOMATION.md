# Release Audit Automation

## Document control

- Owner: Release governance
- Review date: 2026-11-05
- Governing checklist: [Comprehensive Codebase Audit & Release Validation Handbook](COMPREHENSIVE_CODEBASE_AUDIT_AND_RELEASE_VALIDATION_HANDBOOK.md)

## Local audit commands

Run the complete automated audit and generate a timestamped evidence bundle:

```bash
npm run audit:release
```

For development feedback, use `npm run audit:release:quick`. Quick mode deliberately skips the build, coverage, browser/accessibility, load, and artifact groups and therefore cannot produce a `GO` decision.

`npm run audit:release:strict` exits unsuccessfully unless every automated group passes, the worktree is clean, and all required lifecycle attestations are present.

Evidence is written to ignored `release-evidence/<timestamp>_<commit>/` directories. Each bundle contains:

- an 18-group Markdown scorecard and machine-readable `results.json`;
- per-command logs organized by audit group;
- redacted secret and dependency scan evidence;
- the CycloneDX SBOM;
- release artifact inventory and SHA-256 checksums when full mode reaches packaging;
- explicit known issues and a `GO` or `NO-GO` decision;
- installation and upgrade evidence placeholders.

Release packages are written to ignored `release-artifacts/` directories. `npm run build:release-artifact` builds the server and client, creates an npm tarball, rejects forbidden contents, verifies required runtime files, and emits `artifact-inventory.json` plus `checksums.sha256`.

## Automated release gates

The required CI workflow independently enforces:

- clean clone and Git integrity;
- Node.js 22 and 24 lockfile installs;
- server, test, and client type checking;
- server and client lint;
- unit, integration, browser E2E, accessibility, security, coverage, and migration checks;
- critical/high production dependency vulnerability rejection;
- current-tree and complete-history secret scanning with redacted findings;
- deterministic SBOM and attribution generation;
- container and package smoke tests;
- repository inventory, reachability, file-size, environment, documentation, and evidence policy;
- an aggregate gate that fails on any missing, skipped, cancelled, or failed required job.

The release-candidate workflow repeats security and supply-chain gates, runs the release suite, packages the audited source, hashes the artifact, uploads the evidence, and requests GitHub build provenance. It does not publish a stable release or claim manual lifecycle success.

## Secret scan allowlist

The scanner covers current tracked/untracked non-ignored files and, in release/CI mode, every added line in Git history. Findings expose only rule, path, line, and a short SHA-256 fingerprint.

`config/secret-scan-allowlist.json` may contain only reviewed fingerprints for synthetic test fixtures. Never allowlist a real credential; rotate and remove it from history instead.

## Dependency policy

`npm run check:dependencies` rejects critical and high production vulnerabilities in both server and client trees. The root `overrides` entries force patched `adm-zip` and `sharp` versions through the Hugging Face/ONNX dependency tree; removing an override requires a clean audit demonstrating that upstream constraints have become safe.

## Required human and lifecycle evidence

The following environment variables may be set to `1` only after the named evidence has been performed and reviewed:

| Variable | Required evidence |
|---|---|
| `AUDIT_INSTALLATION_VERIFIED` | Clean-machine installation and launch |
| `AUDIT_UPGRADE_VERIFIED` | Supported upgrade, migration, rollback, and user-data preservation |
| `AUDIT_UNINSTALL_VERIFIED` | Uninstall behavior and documented user-data policy |
| `AUDIT_MANUAL_ACCESSIBILITY_VERIFIED` | Manual assistive-technology and supported-browser review |
| `AUDIT_SIGNING_VERIFIED` | Valid artifact signature or approved unsigned-release exception |

These flags are attestations, not bypasses. Keep the supporting logs, screenshots, approvals, or signed records with the release evidence package.

Repository-wide Prettier conformance remains an explicit P3 baseline item because the legacy source tree is not uniformly formatted. Correctness-focused ESLint and all type checks remain blocking gates; touched code should follow the configured formatter.
