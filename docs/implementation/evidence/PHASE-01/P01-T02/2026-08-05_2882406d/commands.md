# P01-T02 Commands

All commands below completed with exit code 0 in GitHub Actions run `30985202244` against the exact repair applied before commit `2882406d0d944ab62aa93c27cbf9a685084d8d5a`.

## Repair integrity

```bash
node scripts/p01-t02-apply.mjs
git diff --check
grep -R -n -E '(^|[^[:alnum:]_])global\.' client/src --include='*.test.ts' --include='*.test.tsx'
```

The grep command returned no matches. The repair script asserted that exactly 14 `global.fetch` references were replaced.

## Isolated client verification

```bash
rm -rf node_modules client/node_modules
npm --prefix client ci
test ! -d node_modules
npm --prefix client run type-check
npm --prefix client test
npm --prefix client run build
```

## Full repository boundary verification

```bash
rm -rf node_modules client/node_modules
npm ci
npm --prefix client ci
npm run type-check:client
npm --prefix client test
npm --prefix client run build
```
