# Security and provenance

All repository enumeration and reads are mediated by `ApprovedRepositoryGateway`. SARIF locations must be repository-relative and cannot escape the approved root. The SBOM generator reads only the project manifest and executes no analyzed repository code.

No GitGalaxy source, tests, comments, or internal structure was copied. CF-03 introduces no hosted-filesystem, shell, write, Git, browser, or process authority.
