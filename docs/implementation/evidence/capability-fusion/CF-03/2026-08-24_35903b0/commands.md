# Verification commands

Focused local checks:

- `npm run type-check:server`
- `npm run type-check:tests`
- `npx jest src/core/coding/findings --runInBand`
- `npm run generate:sbom`
- `npm run lint:server -- --quiet`

The authoritative full-matrix verification is [CI run #395](https://github.com/DocDamage/chatbot/actions/runs/32725484088), which passed the Required CI gate on `d591afb48bfd6986ca9704568eb9a67c870f4f0a`.
