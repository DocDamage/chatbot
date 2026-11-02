# Verification commands

Commands executed from `codex/cf04-cf10-integration`:

- `npm run type-check`
- `npm run lint`
- `npx jest <11 focused CF-04 through CF-10 suites> --runInBand`
- `npm --prefix client run test -- src/components/CapabilityHubPanel.test.tsx src/components/LocalToolsWorkspace.test.tsx`
- `npm run inventory:generate`
- `npm run generate:sbom`
- `npm run verify:release`

`npm run verify:release` stopped during server coverage enforcement. Later client coverage/accessibility, package smoke, and Phase 2 policy commands in that composite command were not reached and are not claimed by this checkpoint.
