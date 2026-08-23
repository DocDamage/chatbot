# CF-00 Runtime QA

## Automated runtime evidence

GitHub Actions CI run `32668575991` passed the following production-like checks at commit `58dd3ec1076928a973496c63daa72cba52e77db3`:

- built-server browser E2E;
- Docker production-image build and container smoke;
- package smoke;
- server route and service integration tests;
- security tests;
- repository inventory and reachability regeneration with a zero-diff gate.

## Repository-boundary checks

The focused gateway suite created temporary repositories and exercised safe file listing/reading, path traversal and absolute-path denial, sensitive-path denial, symbolic-link escape denial on Ubuntu, Windows junction creation when run on Windows, bounded text reads, binary refusal, bounded literal search, and agent-facing tool failure at the common boundary.

## Result

`PASSED` for the CF-00 automated runtime scope.

## Deferred manual evidence

- A real Windows 11 junction/reparse-point run remains required before promoting Windows filesystem access beyond local experimental status.
- No hosted-mode or public-user runtime claim is made.
- No external source-repository adapter was launched in this subtask.
