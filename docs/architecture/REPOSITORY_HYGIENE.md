# Repository Hygiene and Architecture Boundary

## Document control

- Owner: Engineering / release governance
- Review date: 2026-11-05
- Applies to: Phase 2 and all later production-completion work

## Enforced sources of truth

- `.env.example` is the only environment template.
- `src/core/config/EnvironmentDefinitions.ts` is the typed environment registry.
- `src/core/config/ConfigValidator.ts` validates profiles and emits only sanitized diagnostics.
- `src/server/routeManifest.ts` classifies runtime route availability.
- `config/production-boundary.json` classifies compatibility, local-only, provider, and dormant modules.
- `docs/architecture/generated/` contains deterministic repository inventory and reachability artifacts.
- `docs/architecture/large-file-register.md` records every production source file above 300 lines.

## Required checks

```bash
node scripts/release/generate-repository-inventory.mjs
node scripts/release/check-repository-inventory.mjs
node scripts/release/check-production-boundary.mjs
node scripts/release/check-file-size.mjs
node scripts/release/check-environment-contract.mjs
node scripts/release/check-docs.mjs
node --test scripts/release/__tests__/phase2-scanners.test.mjs
```

The checks must fail rather than silently reclassify new routes, environment variables, oversized files, local-only registrations, or release-critical documentation.

## Production boundary

Hosted mode excludes routes classified `local-only` before router registration. The source can remain in the repository for trusted local use, but it cannot silently become part of the hosted route surface. Compatibility chat endpoints remain `PRODUCTION_PREVIEW`; they are not counted as production-supported merely because they are reachable.

Unreachable production modules are classified as isolated or dormant by the generated reachability map. Reachability is static evidence only and does not replace runtime verification.
