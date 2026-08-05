# P01-T05 Commands and External Checks

| Command or operation | Exit/result | Evidence |
|---|---:|---|
| Read repository Pages settings through GitHub API | 200 / passed | Pages enabled, `build_type=workflow`, HTTPS enforced, URL configured |
| `npm ci` in `client` | 0 | Pages build job `92254244744` |
| `npm run type-check` in `client` with `GITHUB_PAGES=true`, `VITE_RUNTIME_MODE=static-demo` | 0 | Pages build job |
| `npm run test:pages` in `client` | 0 | 3 files, 6 tests passed |
| `npm run build:pages` in `client` | 0 | Vite production build passed; 751 modules transformed |
| `npm run smoke:pages` in `client` | 0 | 3 files checked, 2 repository-scoped assets, limitation marker present |
| `actions/upload-pages-artifact@v3` | success | Artifact ID `8923760893`, SHA-256 `bc485c2670c2d9d21eff70da190f08397607f91af85b9d359649479158c4d3c4` |
| `actions/deploy-pages@v4` from protected `main` | success | Deployment commit `342b657c6510fc086d11ad19a1c7b62fad9cd725` |
| `node scripts/release/smoke-pages-deployment.mjs "https://docdamage.github.io/chatbot/"` | 0 | Live page and 2 assets passed; limitation marker present |
| Full PR CI run `30989827572` | 0 | All existing CI steps passed |
| Full `main` CI run `30990196532` | 0 | All existing CI steps passed |

## Negative verification

| Check | Expected result | Actual result |
|---|---|---|
| Static demo configured with an API URL | Build/runtime configuration rejects it | Passed by unit test and Vite guard |
| Static demo configured as application mode | Pages build rejects it | Guard implemented |
| Interactive app rendered in static demo | Must not render | App boundary test passes; mocked interactive components would throw |
| Task branch attempts protected Pages deployment | Must be rejected | GitHub environment rejected it before runner execution |
