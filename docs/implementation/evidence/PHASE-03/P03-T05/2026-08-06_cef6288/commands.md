# P03-T05 Commands and Results

| Command or gate | Exit code | Result |
|---|---:|---|
| `npm run test:e2e` | 0 | 3 service suites / 5 tests and 7 built-server Playwright workflows passed. |
| `npm run test:browser:prepare` | 0 | Isolated SQLite, text, image, audio, Sprite Lab, and local-tool fixtures prepared. |
| `npm run build` | 0 | Compiled server and production client build passed before Playwright. |
| `npm --prefix client run test:browser` | 0 | Desktop Chromium and mobile Chromium workflows passed. |
| GitHub Actions CI `31081497523` | 0 | Every independent required job passed. |
| Required CI gate in `31081497523` | 0 | Aggregate enforcement passed. |
| Browser artifact upload | 0 | Artifact `8959667465` uploaded with digest `sha256:dbe6da3f6ed1f5ca5eebdafc6c1f91d629dc22c534e222d1c48e5c8746e0d0fa`. |

GitHub Actions checked pull-request merge ref `b7765c365139aa193a3f77c7e56552c9169b9e56` for implementation head `cef6288dfe784e55fc1ad69b5ff2c786b7b83072` against current `main`.
