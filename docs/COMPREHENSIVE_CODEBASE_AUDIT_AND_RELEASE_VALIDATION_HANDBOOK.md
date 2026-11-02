# Comprehensive Codebase Audit & Release Validation Handbook

## Purpose

This document defines a thorough, repeatable audit framework for evaluating a software codebase before release, public distribution, production deployment, or major version promotion.

The objective is not merely to determine whether the code "works." A mature release process should establish evidence that the repository is:

- Buildable
- Testable
- Secure
- Maintainable
- Reproducible
- Properly documented
- Operationally reliable
- Safe to install and upgrade
- Free of accidental secrets and inappropriate artifacts
- Correctly licensed
- Suitable for its supported platforms
- Ready for outside contributors or users
- Traceable from source code to released artifact

A successful audit should produce evidence, findings, severity classifications, remediation actions, and an explicit release decision.

---

# 1. Recommended Audit Structure

Use the following 18 audit groups as the canonical audit suite:

1. Repository Integrity
2. Build & Compilation
3. Static Analysis
4. Type Safety
5. Tests & Coverage
6. Security
7. Secrets
8. Dependencies
9. Software Supply Chain
10. Licensing & Attribution
11. Architecture & Maintainability
12. Performance & Resource Usage
13. Reliability & Recovery
14. UX & Accessibility
15. Data & Persistence
16. CI/CD & Release Engineering
17. Documentation & Repository Policy
18. Release Artifact & Installation Validation

These audits should be independently reportable because different classes of defects require different remediation strategies.

---

# 2. Severity Classification

Every audit finding should receive a severity level.

## P0 — Release Blocker

A P0 issue means the release should not ship.

Examples:

- Credentials or private keys exposed
- Known critical remotely exploitable vulnerability
- Installer corrupts or deletes user data
- Application cannot build from a clean checkout
- Release artifact cannot start
- Upgrade destroys existing projects, saves, or configuration
- Malicious or compromised dependency detected
- Release artifact does not correspond to tagged source
- Database migration causes irreversible corruption
- Authentication or authorization can be trivially bypassed

### Required Action

- Stop release
- Remediate
- Re-run affected audit
- Re-run dependent audits
- Record evidence of resolution

---

## P1 — Critical

A severe defect that may not always block the entire application but materially affects usability, reliability, compatibility, or security.

Examples:

- Major feature completely broken
- Frequent crash in normal workflow
- Severe accessibility failure
- Important save/load bug
- Large memory leak
- Broken Windows/Linux/macOS packaging on a supported platform
- CI is incapable of validating release builds
- Missing recovery from interrupted update

### Required Action

Normally blocks stable release unless formally accepted by the release owner with documented justification.

---

## P2 — Important

A meaningful defect with a workaround or limited impact.

Examples:

- Incorrect behavior in an edge case
- Significant architectural debt
- Missing validation on secondary input
- Unclear error message that complicates recovery
- Moderate performance issue
- Missing documentation for an advanced feature
- Test coverage gap around non-critical code

### Required Action

Fix before release when feasible or create a tracked remediation issue.

---

## P3 — Cleanup / Advisory

Low-risk issues.

Examples:

- Minor lint violations
- Small documentation inconsistencies
- Dead comments
- Cosmetic issues
- Small duplicated code blocks
- Optional optimization opportunities

### Required Action

Track when useful but do not normally block release.

---

# 3. Release Gate Policy

The following audit groups should normally be mandatory release gates:

- Repository Integrity
- Build & Compilation
- Static Analysis
- Type Safety where applicable
- Tests & Coverage
- Security
- Secrets
- Dependencies
- Software Supply Chain
- Licensing & Attribution
- CI/CD & Release Engineering
- Documentation & Repository Policy
- Release Artifact & Installation Validation

The following should also become mandatory for mature products:

- Performance
- Reliability & Recovery
- Accessibility
- Data & Persistence
- Architecture & Maintainability

A release should fail automatically when:

- Any P0 finding remains open
- Any unapproved P1 finding remains open
- Mandatory CI checks fail
- Release artifacts are missing
- Checksums cannot be verified
- Source/tag/artifact provenance is inconsistent

---

# 4. Audit 1 — Repository Integrity

## Objective

Verify that the repository itself is structurally correct, clean, complete, and suitable as the authoritative source of the product.

## Checks

### Repository Structure

- Confirm expected root-level directories exist
- Confirm source directories are correctly organized
- Confirm test directories are present
- Confirm documentation directories are present where expected
- Confirm configuration files are located consistently
- Confirm generated files are not mixed with source files unless intentionally tracked

### Default Branch

Verify:

- Correct default branch
- Default branch contains the actual application
- No obsolete starter branch is accidentally configured as default
- Release automation targets the correct branch
- Documentation references the correct branch

### Branch Hygiene

Check for:

- Abandoned branches
- Duplicate feature branches
- Old release branches
- Unmerged critical work
- Branches containing secrets
- Branches containing large binaries
- Branches diverged from authoritative development history

### Git Status

A clean checkout should not immediately produce modifications.

Run equivalent checks for:

- Dirty generated files
- Rewritten lockfiles
- Automatic formatting changes
- Imported asset metadata changes
- Platform-specific newline churn

### .gitignore

Verify that it excludes:

- Build outputs
- Temporary files
- IDE state
- OS metadata
- Secrets
- Local environment configuration
- Package caches
- Generated exports
- Test artifacts
- Coverage artifacts where appropriate

Also verify that `.gitignore` does not accidentally exclude required source assets.

### Large File Audit

Identify:

- Unexpected binaries
- Large archives
- Video files
- Installer files
- Database files
- Build outputs
- Model files
- Export artifacts

Determine whether Git LFS or external storage is more appropriate.

### Duplicate Project Trees

Check for:

- Nested copies of the repository
- "old", "backup", or "copy" folders
- Duplicate source trees
- Archived versions accidentally committed
- Generated export directories containing source copies

## Evidence

Capture:

- Branch list
- Default branch
- Clean working-tree result
- Repository size
- Largest tracked files
- Root directory inventory

---

# 5. Audit 2 — Build & Compilation

## Objective

Prove that the application can be built from an independent clean checkout.

## Clean Build Procedure

1. Create a clean environment.
2. Clone the repository.
3. Checkout the exact release commit.
4. Install only documented prerequisites.
5. Restore dependencies.
6. Run the documented build command.
7. Verify expected artifacts.
8. Run the built application.

## Validate

### Dependency Restoration

- Dependency install succeeds
- Lockfiles are honored
- No undocumented global packages are required
- No developer-machine-only paths exist

### Compiler Results

Treat as findings:

- Errors
- Warnings
- Deprecated API usage
- Unsafe operations
- Implicit conversion warnings
- Platform compatibility warnings

### Build Matrix

Test all supported combinations where applicable:

- Debug
- Release
- Development
- Production
- x64
- ARM64
- Windows
- Linux
- macOS
- Web
- Mobile

### Clean Environment Verification

The build must not depend on:

- Previously generated files
- IDE caches
- Local SDK overrides
- Developer secrets
- User-specific absolute paths
- Uncommitted files

### Repeated Build Stability

Run the build more than once.

Verify:

- Deterministic output where expected
- No accumulating generated files
- No failing second build
- No stale cache dependency

---

# 6. Audit 3 — Static Analysis

## Objective

Identify defects that can be detected without running the software.

## Common Categories

Check for:

- Null dereferences
- Unreachable code
- Uninitialized variables
- Incorrect boolean logic
- Integer overflow risks
- Unsafe conversions
- Resource leaks
- Suspicious exception handling
- Shadowed variables
- Unused variables
- Unused imports
- Unused functions
- Unused classes
- Potential infinite loops
- Unsafe file operations
- Incorrect path handling
- Dangerous shell invocation
- Tainted input flows

## Linting

Separate stylistic lint rules from correctness rules.

Correctness-related warnings should have higher severity than:

- Naming
- Formatting
- Whitespace
- Line length

Do not allow thousands of cosmetic warnings to obscure meaningful defects.

## Recommended Policy

Maintain:

- Zero static-analysis errors
- Zero unreviewed high-severity warnings
- A documented baseline for intentionally accepted warnings

---

# 7. Audit 4 — Type Safety

## Objective

Verify that type contracts reflect actual runtime behavior.

## Applicable Systems

Examples:

- TypeScript
- C#
- Rust
- Kotlin
- Swift
- Python with mypy/pyright
- Typed GDScript
- Java
- C++

## Checks

Look for:

- Implicit `any`
- Nullable values used without checks
- Unsafe casts
- Incorrect generic constraints
- Incorrect API response types
- Type assertions used to suppress genuine issues
- Incorrect enum handling
- Incomplete union handling
- Missing exhaustiveness checks
- Interface drift
- Serialization/deserialization mismatch

## Strong Recommendation

Avoid treating casts as fixes.

Example anti-pattern:

```text
compiler complains
→ developer casts value
→ warning disappears
→ runtime bug remains
```

Require justification for unsafe casts in critical systems.

---

# 8. Audit 5 — Tests & Coverage

## Objective

Determine whether important behavior is actually validated.

## Test Categories

### Unit Tests

Validate individual functions, classes, services, or systems.

### Integration Tests

Validate interactions between:

- Database and application
- API and frontend
- Filesystem and importer
- Authentication and authorization
- Engine systems and plugins

### End-to-End Tests

Validate complete workflows.

Examples:

- Launch → create project → save → close → reopen
- Register → log in → perform action → log out
- Import asset → edit → export
- Install → launch → update → restart

### Regression Tests

Every important previously fixed defect should receive a regression test when practical.

## Coverage Review

Do not judge quality solely by percentage.

Audit whether tests cover:

- Critical workflows
- Error paths
- Permission failures
- Invalid input
- Boundary conditions
- Corrupt data
- Offline state
- Recovery
- Upgrade scenarios

## Flaky Test Audit

Track:

- Intermittent failures
- Timing-sensitive tests
- Network-dependent tests
- Random-order failures
- Shared mutable fixtures
- Port collisions

A test suite that fails randomly cannot serve as a reliable release gate.

---

# 9. Audit 6 — Security

## Objective

Identify vulnerabilities in application code, runtime behavior, infrastructure, and exposed interfaces.

## Input Validation

Audit all externally controlled input:

- HTTP parameters
- JSON
- Form input
- File uploads
- Filenames
- Archives
- CLI arguments
- IPC messages
- Plugin metadata
- Database fields
- Imported projects
- User-generated scripts

## Vulnerability Categories

Inspect for:

- SQL injection
- Command injection
- XSS
- CSRF
- SSRF
- Path traversal
- Directory escape
- Arbitrary file overwrite
- Unsafe deserialization
- Template injection
- XML entity attacks
- Authentication bypass
- Authorization bypass
- IDOR
- Insecure randomness
- Weak cryptography
- Hardcoded credentials
- Sensitive logging
- Insecure temporary files

## Authentication

Verify:

- Password handling
- Token expiration
- Session invalidation
- Account lockout strategy
- Reset flows
- Multi-factor handling where applicable

## Authorization

Test explicitly:

- User A cannot access User B resources
- Lower privilege cannot call administrator endpoints
- Hidden UI actions cannot be invoked directly
- API authorization is enforced server-side

## File Handling

For applications importing files:

Test:

- Unexpected extension
- Double extension
- Empty files
- Huge files
- Zip bombs
- Malformed archives
- Symlinks
- Parent-directory traversal
- Unicode filenames
- Reserved Windows filenames

---

# 10. Audit 7 — Secrets

## Objective

Confirm no credentials are present in current source or Git history.

## Search For

- API keys
- Cloud credentials
- GitHub tokens
- OAuth secrets
- Private keys
- Passwords
- Database URLs
- Service account JSON
- `.env`
- `.env.local`
- SSH keys
- Certificates with private keys
- Production webhook secrets

## Git History

Do not only scan the current tree.

Search:

- Deleted files
- Old commits
- Old branches
- Tags
- Merge commits

If a credential was ever committed, deleting the file is not sufficient.

### Required Response

1. Rotate the credential.
2. Revoke the old credential.
3. Remove it from history where appropriate.
4. Add preventative scanning.
5. Document the incident.

---

# 11. Audit 8 — Dependencies

## Objective

Assess third-party packages and libraries for known vulnerabilities and maintenance risk.

## Checks

For every dependency:

- Current version
- Latest stable version
- Known CVEs
- Maintenance status
- Last release date
- Direct or transitive
- License
- Runtime necessity
- Development-only necessity

## Identify

- Abandoned libraries
- Deprecated libraries
- Duplicate libraries with overlapping purpose
- Packages pulled only for trivial functionality
- Unnecessary native dependencies
- Unpinned dependencies
- Wildcard version ranges

## Lockfile Validation

Confirm lockfiles:

- Exist
- Are tracked
- Match manifests
- Are used in CI
- Are not regenerated unexpectedly

---

# 12. Audit 9 — Software Supply Chain

## Objective

Verify integrity from dependency retrieval through final release artifact.

## Areas

### Dependency Integrity

- Registry sources
- Checksums
- Package signatures where available
- Lockfile integrity

### CI Dependencies

Pin third-party CI actions or scripts to trusted versions or commits when practical.

Review permissions requested by automation.

### Build Provenance

Record:

- Source commit SHA
- Release tag
- Build environment
- Compiler/runtime version
- Dependency lockfile
- Build timestamp
- Artifact hashes

### SBOM

Generate a Software Bill of Materials containing:

- Components
- Versions
- Licenses
- Dependency relationships
- Package identifiers when available

Formats may include:

- SPDX
- CycloneDX

### Artifact Signing

Where appropriate:

- Sign executables
- Sign installers
- Sign packages
- Record certificate identity
- Validate signatures during release verification

---

# 13. Audit 10 — Licensing & Attribution

## Objective

Ensure the repository has the legal right to distribute all included code, assets, fonts, libraries, media, and dependencies.

## Check

### Repository License

Verify:

- LICENSE exists
- README identifies license when appropriate
- Package metadata matches
- Source headers match policy

### Dependency Licenses

Identify incompatible licenses.

Pay special attention to:

- GPL
- AGPL
- LGPL
- SSPL
- commercial-only licenses
- non-commercial clauses
- attribution clauses

### Assets

Audit:

- Art
- Audio
- Music
- Fonts
- Icons
- Textures
- Models
- Sample projects
- Screenshots
- Branding

Record source and permission.

### Attribution

Create or verify:

- NOTICE
- THIRD_PARTY_LICENSES
- credits screen
- documentation acknowledgements

when required.

---

# 14. Audit 11 — Architecture & Maintainability

## Objective

Determine whether the project can continue to evolve without becoming increasingly fragile.

## Architecture Checks

Evaluate:

- Layer boundaries
- Module responsibilities
- Dependency direction
- Circular dependencies
- Global state
- Service boundaries
- Plugin boundaries
- Data model ownership

## Code Smells

Identify:

- God classes
- God scripts
- Giant files
- Giant methods
- Deep nesting
- Copy/paste implementations
- Feature logic mixed with UI
- Database logic inside views
- Networking mixed with presentation logic
- Hardcoded paths
- Hardcoded magic numbers

## Complexity

Measure where possible:

- Cyclomatic complexity
- Cognitive complexity
- Method length
- Class size
- Dependency count
- Fan-in
- Fan-out

## Modularity

Ask:

- Can a subsystem be tested independently?
- Can it be replaced independently?
- Can failures be isolated?
- Is public API surface intentionally defined?

---

# 15. Audit 12 — Performance & Resource Usage

## Objective

Determine whether the software behaves acceptably under realistic and worst-case workloads.

## Measure

### Startup

- Cold start
- Warm start
- First-run initialization

### CPU

Profile:

- Idle CPU
- Normal workflow
- Heavy workflow
- Background tasks

### Memory

Measure:

- Startup memory
- Peak memory
- Long-session memory
- Memory after closing large projects
- Memory after repeated operations

### GPU

For graphical applications:

- GPU memory
- frame time
- frame rate
- shader compilation
- asset streaming
- render spikes

### Storage

Measure:

- Application size
- Cache growth
- Save-file growth
- Temporary-file cleanup
- Log growth

### I/O

Profile:

- Large project loading
- Save operations
- asset import
- export
- network transfer
- database access

## Stress Testing

Test:

- Maximum supported project size
- Thousands of records
- Many open documents
- Repeated imports
- Repeated saves
- Continuous operation

---

# 16. Audit 13 — Reliability & Recovery

## Objective

Verify that failures do not cause catastrophic or unrecoverable behavior.

## Crash Recovery

Test:

- Crash during save
- Crash during import
- Crash during export
- Crash during update
- Crash during migration

## Power-Loss Simulation

Where appropriate, simulate process termination during writes.

## Network Failure

Test:

- Offline startup
- Connection lost mid-request
- Slow network
- Timeout
- DNS failure
- Server unavailable
- Partial response

## Retry Behavior

Ensure:

- Retries have limits
- Exponential backoff where appropriate
- Failed actions are not duplicated
- User receives actionable feedback

## Resource Lifecycle

Check:

- File handles
- sockets
- subprocesses
- threads
- database connections
- event listeners
- timers
- temporary files
- GPU resources

## Long-Running Soak Test

Run normal workflows repeatedly for extended periods.

Watch for:

- Memory growth
- file-handle growth
- performance degradation
- timer accumulation
- thread leakage
- log explosion

---

# 17. Audit 14 — UX & Accessibility

## Objective

Ensure the product is not merely functional but usable.

## UX Review

Check:

- Clear primary actions
- Predictable navigation
- Consistent terminology
- Discoverable features
- Undo where destructive operations exist
- Confirmation for dangerous actions
- Progress indication
- useful empty states
- useful error states
- sensible defaults

## First-Run Experience

A new user should understand:

- What the application does
- How to begin
- Where files are stored
- How to create/open a project
- How to save/export

## Accessibility

Audit:

- Keyboard navigation
- Focus order
- visible focus indicators
- screen-reader labels
- semantic controls
- contrast
- text scaling
- color-independent state communication
- reduced-motion support
- captions/transcripts for essential media where needed

## Controller Navigation

For controller-supported applications:

- Every required control is reachable
- Focus never becomes trapped
- Focus remains visible
- Modal behavior is correct
- Back/cancel is consistent
- lists scroll correctly
- sliders and dropdowns are controllable
- no mouse-only action exists in a controller-required workflow

---

# 18. Audit 15 — Data & Persistence

## Objective

Protect user data against corruption, incompatible versions, and partial writes.

## Save/Load

Test:

- Empty save
- normal save
- large save
- repeated save
- save-as
- overwrite
- read-only location
- no disk space
- missing folder
- invalid filename

## Corruption

Test:

- Truncated file
- malformed JSON/XML/database
- missing required field
- unexpected field
- invalid version
- partially written save

The application should:

- Fail safely
- preserve original data
- provide recovery guidance
- avoid overwriting corrupt data automatically

## Atomic Writes

Critical saves should preferably use:

1. Write temporary file
2. Flush
3. Validate
4. Rename/replace original

## Migration

Test every supported upgrade path.

Example:

```text
v1 save → v2 application
v2 save → v3 application
```

Validate:

- Data retained
- new fields initialized
- removed fields handled
- migration cannot repeatedly execute incorrectly

## Backup Strategy

Consider:

- automatic backups
- rotating backups
- pre-migration backup
- restore workflow

---

# 19. Audit 16 — CI/CD & Release Engineering

## Objective

Verify that automated validation and deployment systems are trustworthy.

## CI Workflow Audit

Check:

- Correct triggering branches
- pull-request validation
- push validation
- release validation
- concurrency controls
- cancellation behavior

## Permissions

Use least privilege.

Review permissions for:

- Repository contents
- Pull requests
- Issues
- Packages
- Releases
- OIDC
- deployment environments

## Secrets in CI

Verify:

- Secrets are not echoed
- Secrets are scoped correctly
- Pull requests from forks cannot steal privileged secrets
- Production credentials are isolated

## Third-Party Actions

Audit:

- Publisher
- version
- pinning strategy
- permissions
- maintenance status

## CI Artifact Validation

Verify CI produces expected:

- binaries
- packages
- logs
- coverage
- test reports
- checksums
- SBOM
- signatures

## Release Workflow

A release pipeline should ideally:

1. Verify clean source
2. Verify exact tag
3. Build
4. Run tests
5. Run security scans
6. Generate artifact
7. Generate SBOM
8. Generate checksums
9. Sign where applicable
10. Publish
11. Verify published artifact

---

# 20. Audit 17 — Documentation & Repository Policy

## Objective

Ensure the repository tells the truth about how the project actually works.

## README Audit

Verify:

- Project purpose
- Current screenshots where useful
- Supported platforms
- Installation
- Quick start
- Build instructions
- configuration
- troubleshooting
- license
- contribution link

Every command shown should be tested.

## CONTRIBUTING

Should explain:

- Development prerequisites
- Branch strategy
- Formatting
- Tests
- Pull request expectations
- issue reporting

## SECURITY

Should define:

- Supported versions
- Vulnerability reporting process
- Private disclosure mechanism
- Expected response process

## CHANGELOG

Verify:

- Latest version present
- Versions correspond to tags
- Breaking changes identified
- Upgrade notes included when needed

## CODEOWNERS

Verify ownership paths remain valid.

## Repository Policy

Audit:

- Default branch protection
- Required reviews
- Required checks
- Force-push policy
- branch deletion policy
- admin bypass policy
- signed commits/tags policy where relevant

## Templates

Review:

- Bug report
- Feature request
- Pull request
- Security issue handling

---

# 21. Audit 18 — Release Artifact & Installation Validation

## Objective

Audit the actual file the user receives, not only the source repository.

This is one of the most important release audits.

## Artifact Inventory

Verify all expected artifacts exist.

Examples:

- ZIP
- EXE
- MSI
- DMG
- AppImage
- Flatpak
- package archive
- web bundle

## Artifact Contents

Inspect for accidental inclusion of:

- Source secrets
- `.env`
- test fixtures
- debug symbols
- developer configuration
- private certificates
- raw assets not intended for redistribution
- temporary files
- local usernames or paths
- crash dumps

## Installation

Test on a clean machine or VM.

Validate:

- Installer starts
- Destination works
- shortcuts work
- required runtimes handled
- application launches
- no admin rights required unless justified

## Uninstallation

Verify:

- Application binaries removed
- User data policy followed
- shared dependencies not incorrectly removed
- uninstall does not delete unrelated files

## Portable Builds

Verify:

- Runs from extracted folder
- Does not depend on installer-created state
- Does not unexpectedly write beside executable if prohibited
- Relative paths work

## Checksums

Generate at minimum:

- SHA-256

Verify downloaded artifact against published checksum.

---

# 22. Git History Audit

A Git history audit should be performed separately from a normal repository scan.

## Search For

- Secrets
- personal data
- copyrighted files
- giant binaries
- accidental archives
- database dumps
- logs
- compiled artifacts
- private configuration

## Tag Audit

Verify:

- Tag names match release version
- Tag points to intended commit
- Tag chronology makes sense
- Release notes correspond to tag

## Merge Audit

Review:

- Incorrect merge direction
- accidental replacement of authoritative history
- duplicate trees
- unrelated histories
- rebases that dropped important commits

---

# 23. API Contract Audit

For applications exposing APIs, validate:

## Request Validation

- Missing parameters
- additional unexpected parameters
- invalid types
- malformed JSON
- huge payloads

## Response Contract

- Correct status codes
- stable field names
- correct content types
- consistent error format

## Compatibility

Test older clients against newer servers when supported.

## Timeouts

Every network operation should have intentional timeout behavior.

## Rate Limiting

Where necessary, validate limits and responses.

---

# 24. Configuration Audit

## Search For

- Hardcoded development URLs
- localhost assumptions
- debug flags
- test credentials
- production secrets
- undocumented environment variables
- obsolete flags
- duplicate configuration sources

## Defaults

Defaults should be:

- secure
- predictable
- appropriate for production
- clearly documented

---

# 25. Error Handling Audit

## Inspect

- Empty catch blocks
- generic exception swallowing
- errors converted into success
- lost stack traces
- incorrect fallback behavior

## User Errors vs Internal Errors

Users should receive useful messages without exposing sensitive internals.

Avoid exposing:

- stack traces
- credentials
- database queries
- filesystem secrets
- private server paths

Logs may contain additional diagnostic context if securely handled.

---

# 26. Logging & Observability Audit

## Verify

- Appropriate log levels
- no passwords
- no access tokens
- no private keys
- no sensitive user data unless required and protected

## Log Categories

Consider:

- startup
- shutdown
- configuration
- warnings
- errors
- update operations
- migration
- recovery
- security events

## Rotation

Ensure logs cannot grow without bound.

---

# 27. Clean-Room Validation

A clean-room validation is one of the best ways to expose undocumented assumptions.

## Procedure

Use a fresh VM, container, or machine that has never had the project installed.

Test:

1. Clone repository
2. Follow README exactly
3. Install dependencies
4. Build
5. Run tests
6. Package
7. Install
8. Launch
9. Perform basic workflows

Document every undocumented step.

Every undocumented dependency discovered should produce a documentation or build-system fix.

---

# 28. Upgrade Path Audit

Never validate only fresh installs.

Test supported transitions.

Example:

```text
0.9.0 → 1.0.0
0.9.5 → 1.0.0
1.0.0-beta → 1.0.0
portable old → portable new
installed old → installed new
```

## Verify

- User settings preserved
- User projects preserved
- caches safely regenerated
- migrations succeed
- plugins remain compatible or fail gracefully
- rollback strategy exists

---

# 29. Failure Injection Testing

Intentional failure testing reveals defects that happy-path testing will never find.

Inject:

- Disk full
- File locked
- Permission denied
- Database unavailable
- Server unavailable
- Network disconnected
- Dependency timeout
- corrupted configuration
- malformed project
- missing asset
- missing runtime
- killed process
- update interrupted

Record actual recovery behavior.

---

# 30. Fuzz Testing

Fuzz testing is useful for parsers, importers, APIs, serialization formats, and protocol handlers.

Targets include:

- JSON parsers
- custom binary formats
- archive importers
- image loaders
- project files
- plugin manifests
- command parsers

Monitor for:

- crashes
- hangs
- excessive memory use
- arbitrary filesystem access
- unhandled exceptions

---

# 31. Platform-Specific Audit

## Windows

Check:

- Installer
- Defender/SmartScreen behavior
- path length
- Unicode paths
- Program Files permissions
- AppData use
- DPI scaling
- multiple monitors
- portable build
- uninstall
- upgrade

## Linux

Check:

- filesystem case sensitivity
- permissions
- desktop integration
- Wayland/X11 where relevant
- package dependencies
- AppImage/Flatpak behavior

## macOS

Check:

- app bundle
- Gatekeeper
- signing
- notarization
- permissions
- Apple Silicon
- Intel compatibility if supported

---

# 32. Game / Godot-Specific Audit

For Godot projects, add the following.

## Project Validation

- `project.godot` valid
- autoload paths valid
- input actions defined
- engine version documented
- plugins load
- import metadata correct

## Scene Audit

Search for:

- Missing scripts
- Missing resources
- broken NodePaths
- invalid signals
- orphaned dependencies

## Resource Audit

Check:

- Broken textures
- missing audio
- incorrect import flags
- duplicate assets
- oversized textures
- unused resources

## Runtime Errors

Run scenes and inspect debugger output for:

- script errors
- invalid calls
- null instances
- missing nodes
- failed resource loads

## Input Audit

Test:

- Keyboard
- Mouse
- Controller
- remapping
- focus navigation

## Save System

Validate:

- save
- load
- corrupt save
- version migration
- user data path
- backup

## Export Audit

Test actual exported executable rather than relying only on editor execution.

---

# 33. Web / PWA-Specific Audit

For web applications and PWAs:

## Browser Matrix

Test current versions of supported:

- Chrome
- Edge
- Firefox
- Safari

## Responsive Layout

Test:

- Mobile
- Tablet
- Desktop
- Large desktop

## PWA

Validate:

- manifest
- icons
- service worker
- offline behavior
- update behavior
- installability
- cache invalidation

## Web Security

Check:

- CSP
- CORS
- cookie attributes
- HTTPS assumptions
- local storage risks
- DOM injection

---

# 34. Desktop Application Audit

For desktop applications:

Test:

- multiple monitors
- DPI scaling
- maximize/minimize
- window restoration
- invalid saved window positions
- sleep/resume
- display disconnect
- audio device changes
- controller reconnect
- file association
- drag and drop

---

# 35. Suggested Automated Tooling Categories

The exact tool depends on language and platform, but a mature audit suite commonly includes:

## Code Quality

- Compiler warnings
- Linter
- static analyzer
- type checker
- formatter validation

## Security

- SAST
- dependency vulnerability scanner
- secrets scanner
- container scanner where relevant

## Dependency Management

- vulnerability database scan
- update bot
- license scanner

## Git

- history secret scanner
- large-file scanner
- branch/tag validation

## Documentation

- broken-link checker
- Markdown lint
- documentation build validation

## Packaging

- checksum generator
- SBOM generator
- signature validation

---

# 36. Evidence Collection Standard

Each audit should generate a record containing:

## Audit Metadata

- Audit name
- Date
- Source commit
- Branch
- Tag
- Environment
- Tool versions
- Auditor or CI workflow

## Result

- PASS
- PASS WITH WARNINGS
- FAIL
- NOT APPLICABLE

## Findings

Each finding should include:

- ID
- Severity
- File or component
- Description
- Reproduction steps
- Evidence
- Recommended fix
- Owner
- Status

Example:

```markdown
### SEC-004

Severity: P1
Component: archive importer
Status: Open

Problem:
Archive extraction permits `../` parent path traversal.

Impact:
A crafted archive may write files outside the intended extraction directory.

Required remediation:
Canonicalize all extracted paths and reject entries that escape the destination root.
```

---

# 37. Release Readiness Scorecard

A useful release report can use this format:

| Audit | Result | P0 | P1 | P2 | P3 |
|---|---|---:|---:|---:|---:|
| Repository Integrity | PASS | 0 | 0 | 1 | 2 |
| Build | PASS | 0 | 0 | 0 | 1 |
| Tests | PASS | 0 | 0 | 2 | 0 |
| Security | PASS | 0 | 0 | 0 | 1 |
| Dependencies | PASS | 0 | 0 | 1 | 0 |
| Documentation | PASS | 0 | 0 | 2 | 3 |
| Release Artifact | PASS | 0 | 0 | 0 | 0 |

---

# 38. Release Decision Rules

## GO

Release may proceed when:

- No P0 findings
- No unapproved P1 findings
- Mandatory checks pass
- Artifacts validated
- Provenance established
- Checksums generated
- Required documentation present

## CONDITIONAL GO

May be used when:

- Only approved P2/P3 issues remain
- Known limitations are documented
- Remediation issues exist

## NO-GO

Release should stop when:

- P0 exists
- Required build fails
- core tests fail
- secrets found
- critical vulnerability exists
- installer corrupts data
- release artifact cannot be reproduced or traced

---

# 39. Pre-Release Master Checklist

## Repository

- [ ] Correct default branch
- [ ] Working tree clean
- [ ] No duplicate source trees
- [ ] No unwanted binaries
- [ ] `.gitignore` reviewed
- [ ] Tags validated
- [ ] Git history scanned

## Build

- [ ] Clean clone builds
- [ ] Release configuration builds
- [ ] Supported platforms build
- [ ] No unexplained compiler errors
- [ ] Critical warnings resolved

## Code Quality

- [ ] Static analysis passes
- [ ] Type checking passes
- [ ] Formatting validation passes
- [ ] Dead code reviewed
- [ ] Complexity hotspots reviewed

## Tests

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Regression tests pass
- [ ] Flaky tests investigated
- [ ] Critical workflows covered

## Security

- [ ] SAST complete
- [ ] Input validation reviewed
- [ ] Authentication reviewed
- [ ] Authorization reviewed
- [ ] File handling reviewed
- [ ] Secrets scan clean

## Dependencies

- [ ] Vulnerability scan complete
- [ ] Critical CVEs resolved
- [ ] Lockfile present
- [ ] Unused dependencies removed
- [ ] Abandoned dependencies reviewed

## Supply Chain

- [ ] Dependency sources validated
- [ ] CI permissions reviewed
- [ ] Third-party actions reviewed
- [ ] SBOM generated
- [ ] Artifact hashes generated

## Licensing

- [ ] Repository license present
- [ ] Dependency licenses reviewed
- [ ] Assets licensed
- [ ] Fonts licensed
- [ ] Attribution included

## Reliability

- [ ] Crash recovery tested
- [ ] Interrupted writes tested
- [ ] Offline behavior tested
- [ ] Timeout behavior tested
- [ ] Long-session test completed
- [ ] Resource leaks reviewed

## Performance

- [ ] Startup benchmarked
- [ ] Memory benchmarked
- [ ] CPU benchmarked
- [ ] GPU benchmarked where applicable
- [ ] Large project/data test completed
- [ ] Stress test completed

## Data

- [ ] Save/load tested
- [ ] Corrupt file handling tested
- [ ] Migration tested
- [ ] Backup behavior tested
- [ ] Disk-full behavior tested

## UX

- [ ] First-run experience tested
- [ ] Main workflows reviewed
- [ ] Error messages reviewed
- [ ] Destructive actions protected
- [ ] Keyboard navigation tested
- [ ] Controller navigation tested where applicable

## Accessibility

- [ ] Focus order tested
- [ ] Focus visibility tested
- [ ] Contrast reviewed
- [ ] Screen-reader semantics reviewed
- [ ] Scaling tested
- [ ] Reduced-motion behavior reviewed where relevant

## Documentation

- [ ] README accurate
- [ ] Installation instructions tested
- [ ] Build instructions tested
- [ ] CONTRIBUTING current
- [ ] SECURITY current
- [ ] CHANGELOG current
- [ ] Broken links checked
- [ ] Supported versions documented

## CI/CD

- [ ] Required status checks pass
- [ ] Branch protections verified
- [ ] Release workflow succeeds
- [ ] CI artifacts validated
- [ ] Secrets permissions reviewed

## Packaging

- [ ] Final artifact inspected
- [ ] Clean-machine install tested
- [ ] Application launches
- [ ] Upgrade tested
- [ ] Uninstall tested
- [ ] Portable version tested where applicable
- [ ] SHA-256 verified
- [ ] Signature validated where applicable

---

# 40. Recommended Audit Cadence

## Every Commit / Pull Request

Automate:

- Formatting
- Linting
- Static analysis
- Type checking
- Unit tests
- Secret scan
- Dependency manifest validation

## Daily or Main-Branch Build

Run:

- Full tests
- integration tests
- dependency vulnerability scan
- development package build
- broader static analysis

## Before Release Candidate

Run all 18 audit groups.

## Before Stable Release

Repeat:

- Clean-room build
- Security scan
- Dependency scan
- Release artifact inspection
- Upgrade test
- Install/uninstall test
- Critical E2E suite
- checksum verification

## Periodically

Run:

- Architecture review
- performance benchmark
- dependency cleanup
- Git history audit
- documentation audit
- license audit
- accessibility audit

---

# 41. Suggested Audit Order

A practical sequence is:

## Stage 1 — Repository Health

1. Repository Integrity
2. Secrets
3. Licensing
4. Documentation

These can expose issues that make later work inappropriate or wasteful.

## Stage 2 — Build Health

5. Dependencies
6. Supply Chain
7. Build
8. Static Analysis
9. Type Safety

## Stage 3 — Behavioral Health

10. Tests
11. Security
12. Data & Persistence
13. Reliability

## Stage 4 — Product Health

14. Performance
15. UX
16. Accessibility

## Stage 5 — Release Health

17. CI/CD
18. Packaging
19. Clean-room install
20. Upgrade validation

---

# 42. Audit Automation Philosophy

The long-term goal should be to convert repeatable audits into automation.

A good rule is:

> If a failure can be detected mechanically, it should eventually become a CI check.

Humans should focus primarily on:

- Architecture
- UX
- visual quality
- threat modeling
- design judgment
- unusual edge cases
- release decisions

Automation should handle:

- lint
- static analysis
- type checking
- tests
- vulnerability scanning
- secret scanning
- broken links
- artifact creation
- checksums
- policy validation

---

# 43. Definition of a Release-Ready Repository

A repository should not be considered genuinely release-ready merely because:

- It compiles
- Unit tests pass
- CI is green

A stronger definition is:

> A release-ready repository is one for which the team can demonstrate that the exact source revision builds reproducibly, passes automated and manual validation, contains no known release-blocking security or data-integrity defects, has compliant dependencies and assets, produces verified release artifacts, preserves user data across supported lifecycle operations, and accurately documents how users and contributors interact with the product.

---

# 44. Minimum Recommended Release Evidence Package

For every serious release, preserve:

```text
release-evidence/
├── audit-summary.md
├── build-report.txt
├── test-results/
├── static-analysis/
├── security-scan/
├── dependency-scan/
├── secrets-scan/
├── license-report/
├── sbom/
├── benchmarks/
├── artifact-inventory.txt
├── checksums.sha256
├── installation-test.md
├── upgrade-test.md
├── known-issues.md
└── release-decision.md
```

For highly mature projects, also preserve:

- screenshots
- benchmark machine information
- signed provenance
- accessibility results
- compatibility matrix
- migration validation evidence

---

# 45. Recommended Final Release Report

Every release candidate should end with a concise report containing:

## Release

- Version
- Commit
- Tag
- Build date
- Supported platforms

## Audit Status

- Audits passed
- Audits failed
- Audits not applicable

## Findings

- Open P0
- Open P1
- Open P2
- Open P3

## Artifact Status

- Artifacts produced
- Artifact sizes
- SHA-256 hashes
- Signing status

## Validation

- Clean-room build
- Install
- Launch
- Upgrade
- Uninstall
- Critical workflow tests

## Decision

One of:

- GO
- CONDITIONAL GO
- NO-GO

## Approvals

Record responsible maintainers or release owners when appropriate.

---

# 46. Final Recommended Standard

For a serious project, the strongest practical release standard is:

1. Clean checkout succeeds.
2. Correct branch/tag verified.
3. No secrets present.
4. Dependencies locked and scanned.
5. Security analysis clean of release blockers.
6. Static analysis passes.
7. Type checks pass where applicable.
8. Unit, integration, and E2E suites pass.
9. Critical data operations survive corruption and interruption tests.
10. Performance remains within documented baseline.
11. UX and accessibility have been reviewed.
12. Documentation matches reality.
13. Branch protection and CI policies are correct.
14. Release artifacts are generated from the audited source.
15. Artifacts are inspected, hashed, and optionally signed.
16. Clean-machine installation works.
17. Upgrade from supported prior versions works.
18. User data survives upgrade and uninstall according to policy.
19. All findings are categorized by severity.
20. Release decision is explicitly recorded.

That converts repository auditing from an informal review into a repeatable engineering control.

---

# Appendix A — Suggested Finding Template

```markdown
## FINDING-ID

**Audit:**
**Severity:** P0 / P1 / P2 / P3
**Status:** Open / In Progress / Resolved / Accepted
**Component:**
**File/Path:**

### Summary

Describe the problem.

### Evidence

Provide logs, screenshots, stack traces, test output, or reproduction information.

### Impact

Describe what could happen.

### Reproduction

1. Step one
2. Step two
3. Step three

### Required Remediation

Describe the necessary correction.

### Verification

Describe how the fix will be validated.

### Owner

Responsible person/team.

### Resolution

Document the final change and commit.
```

---

# Appendix B — Suggested Audit Summary Template

```markdown
# Release Audit Summary

## Release Information

Version:
Commit:
Tag:
Branch:
Date:

## Result

Overall Status: PASS / CONDITIONAL PASS / FAIL

## Findings

P0:
P1:
P2:
P3:

## Audit Results

| Audit | Status | Notes |
|---|---|---|
| Repository Integrity | | |
| Build & Compilation | | |
| Static Analysis | | |
| Type Safety | | |
| Tests & Coverage | | |
| Security | | |
| Secrets | | |
| Dependencies | | |
| Supply Chain | | |
| Licensing | | |
| Architecture | | |
| Performance | | |
| Reliability | | |
| UX & Accessibility | | |
| Data & Persistence | | |
| CI/CD | | |
| Documentation & Policy | | |
| Release Artifact | | |

## Release Decision

GO / CONDITIONAL GO / NO-GO

## Outstanding Work

List accepted or deferred findings.

## Sign-Off

Release owner:
Date:
```

---

# Appendix C — Suggested CI Audit Gates

A mature CI pipeline can eventually enforce:

```text
PR
├── formatting
├── lint
├── typecheck
├── unit-tests
├── static-analysis
├── secrets-scan
└── dependency-validation

main
├── all PR gates
├── integration-tests
├── security-scan
├── dependency-vulnerability-scan
└── package-development-build

release-candidate
├── all main gates
├── e2e-tests
├── license-audit
├── SBOM
├── release-build
├── installer-build
├── artifact-inspection
├── checksums
└── smoke-tests

stable-release
├── verify-tag
├── verify-provenance
├── final-security-scan
├── clean-install-test
├── upgrade-test
├── artifact-signing
└── publication
```

---

# Closing Principle

The purpose of auditing is not to accumulate green checkmarks.

The purpose is to create defensible evidence that the software being released is the software that was reviewed, that it behaves as expected, that failures are handled safely, that users' systems and data are protected, and that the repository can continue to support the product after release.
