# P01-T07 — Live branch-protection verification

Status: `VERIFIED`.

On 2026-08-25 the repository owner authorized branch protection, superseding the 2026-08-05 waiver. The retained P01-T07 configurator implementation is commit `9ec527f3d635fa1bf02d1a8ffbaeeb46048eaeb1`; the policy was applied to `main` and read back through the GitHub administration API.

## Verified controls

- Pull requests are required.
- Required status checks are strict/up to date.
- `Required CI gate` from GitHub Actions app ID `15368` is required.
- Rules apply to administrators.
- Conversations must be resolved.
- Force pushes and branch deletion are blocked.
- The latest protected baseline, `266068db0c1ce4c8723e3e6fe1f851f07c37fe0f`, passed Required CI run `32742006979`.

The approving-review count is zero to avoid locking out the single maintainer. This does not waive the plan's human-review requirement for capability or production promotion.
