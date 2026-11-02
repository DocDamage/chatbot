# Dependency patch provenance

`deepmerge+4.3.1.patch` applies the minimal `__proto__` key guard proposed in
[upstream pull request #274](https://github.com/TehShrike/deepmerge/pull/274) for
CVE-2026-93753. The npm package remains version 4.3.1 under its original MIT
license; this repository does not claim or publish a custom fixed version.

Pristine npm 4.3.1 SHA-256 values used for review:

- `index.js`: `12440C84957C1990EA2D5E33DC0091722DC1DC1585C6D20E0C780E568FFA9D30`
- `dist/cjs.js`: `2E5160F84A1141BD927264AFE4D15766F1E6CF07DAEF182B37FF53FEA121DE7D`

`patch-package --error-on-fail` applies the patch during development installs.
The postinstall wrapper skips only when both Jest and the patch target are absent and
fails closed if the target exists without the patch tool. A Node regression test
covers the three published exploit shapes and ordinary object/array behavior.
