# Profile-Wide Capability Expansion — Baseline Assessment

**Date:** 2026-08-25
**Authoritative baseline branch:** `main`
**Observed `main` commit SHA:** `266068db0c1ce4c8723e3e6fe1f851f07c37fe0f`
**Current development / integration branch:** `codex/cf04-cf10-integration`
**Current integration head commit SHA:** `aec8871623870623204bc93e90ebeb52dd51aea0`
**Passing GitHub Required CI run:** `32877962271` (head `cff8c72db7d3eb815cefcc40ef76f6dca31a397f`)

---

## 1. Repository State & Verification Baseline

### 1.1 Git and Branch Protection
- **Repository:** `DocDamage/chatbot`
- **Default branch:** `main` (Protected: requires status checks, PR review, no direct push).
- **Verified status on `main`:** All previous phases (Phase 0, Phase 1, Phase 2, and P03-T01..P03-T04) are verified and merged.
- **Capability Fusion state (CF-00 through CF-10):** CF-00 through CF-03 merged to `main`; CF-04 through CF-10 fully integrated on branch `codex/cf04-cf10-integration` under draft PR #171 at commit `aec8871623870623204bc93e90ebeb52dd51aea0` with all automated release checks passing.

### 1.2 Automated Release Gate Status
- **Server Type Checks (`npm run type-check:server`):** Passed.
- **Test Type Checks (`npm run type-check:tests`):** Passed.
- **Client Type Checks (`npm run type-check:client`):** Passed.
- **Server Lint (`npm run lint:server`):** Passed (0 errors, 0 warnings).
- **Client Lint (`npm run lint:client`):** Passed (0 errors, 0 warnings).
- **Server Coverage Policy (`npm run check:server-coverage`):** Passed — uncovered statements `13482 <= 14243`, branches `8168 <= 8217`, lines `12172 <= 13039`, functions `2810 <= 2905`.
- **Client Coverage Policy (`npm run check:client-coverage`):** Passed — uncovered statements `1003 <= 1047`, branches `830 <= 830`, lines `809 <= 848`, functions `368 <= 414`.
- **Phase 2 Release Scanners (`npm run check:phase2`):**
  - Release Scanner Unit Tests: 11/11 passed.
  - Repository Inventory: 4/4 artifacts up to date.
  - Production Reachability Boundary: 645 reachable, 204 isolated/classified modules.
  - File Size Policy: Passed (80 registered exceptions > 300 lines).
  - Environment Contract: Passed (232 definitions, 206 variables used).
  - Documentation Validation: Passed (all release-critical docs valid with current review dates and non-broken links).

### 1.3 Active Milestones and Feature Manifest
- **Core Production Completion Tracker:** 23/124 core production tasks `VERIFIED`, 101 `NOT_STARTED`.
- **Feature Manifest Status:** 18 domain areas cataloged; experimental features bounded behind `LOCAL_ONLY_EXPERIMENTAL` or `DISABLED`.
- **Initial Profile Expansion Status:** All profile-wide capability expansion entries start strictly `DISABLED`.

---

## 2. Rebaselined Discrepancies and Adjustments

1. **Historical vs Observed Commit:** The original 100% production plan referenced initial baseline `8b963232d72a69c6616667aaf34daadba6056aba`. The current authoritative base is `266068db0c1ce4c8723e3e6fe1f851f07c37fe0f`.
2. **Capability Fusion Integration:** CF-04 through CF-10 have been completed as an automated-release-verified integration candidate on `codex/cf04-cf10-integration` (PR #171).
3. **No Unearned Promotion:** No new PX capability shall be marked experimental or preview without passing its exact task exit gate, test suite, and security invariants.
