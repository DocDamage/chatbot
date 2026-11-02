# Security Policy

## Supported Versions

Security fixes are applied to the current `main` branch and the latest stable release. Older releases are not guaranteed to receive security updates.

## Reporting a Vulnerability

Do not open a public issue for a suspected vulnerability or include credentials, private data, or exploit details in public discussions.

Report vulnerabilities through GitHub's private vulnerability reporting feature for this repository. Include the affected version or commit, impact, reproduction steps, and any proposed mitigation. If private reporting is unavailable, contact the repository owner through the private contact method listed on the GitHub organization profile.

The maintainers will acknowledge a complete report, assess severity, coordinate remediation, and disclose the issue after a fix is available. Please allow reasonable time for investigation before public disclosure.

## Release Security Gates

Stable releases require:

- no open P0 security or secret finding;
- no unapproved P1 finding;
- clean production dependency audits for critical and high severities;
- current and Git-history secret scans;
- passing security tests and release artifact inspection;
- a generated CycloneDX SBOM and SHA-256 artifact checksums.

Run `npm run audit:release` to produce the complete local evidence package. A local run does not replace private-report handling, clean-machine lifecycle validation, or release-owner approval.
