# P01-T05 Runtime Checklist

- [x] GitHub Pages is enabled with GitHub Actions as the source.
- [x] HTTPS is enforced.
- [x] Deployment originates from protected `main`.
- [x] Static-demo limitation notice is present in the built and deployed JavaScript.
- [x] Prompt textarea is disabled.
- [x] Send action is disabled.
- [x] Backend runtime is not mounted in static-demo mode.
- [x] API base URL is prohibited in static-demo mode.
- [x] Production build uses the repository base path `/chatbot/`.
- [x] Referenced deployed assets return successful responses.
- [x] Post-deployment smoke passed against `https://docdamage.github.io/chatbot/`.
- [x] The site is documented as a static demonstration, not a production deployment.
- [x] The separately hosted production path remains unchanged.
- [x] No secret was added to the client build or workflow.
- [x] No deployment protection rule was weakened.

## Runtime result

`VERIFIED` at deployed commit `342b657c6510fc086d11ad19a1c7b62fad9cd725`.
