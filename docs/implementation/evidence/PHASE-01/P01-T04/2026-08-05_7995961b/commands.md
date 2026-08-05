# P01-T04 Commands and Results

| Command or check | Exit code | Result |
|---|---:|---|
| base-tree mode inspection at `c2ea947b30f514c5c7b32015e8aba82bfc644451` | 0 | Found five mode-`160000` entries and no `.gitmodules` file. |
| malformed-gitlink fixture: `git submodule status` | 128 (expected) | Reproduced the missing `.gitmodules` mapping failure mechanism. |
| `git ls-files --stage` | 0 | Passed at `7995961b0b6c2f2fc847da8ade16d2df594aee27`; no gitlink entry remained. |
| `git submodule status` | 0 | Passed with no output and no missing mapping. |
| `git fsck --full` | 0 | Passed with no integrity error. |
| `git clone --no-local --no-recurse-submodules . <temp>` | 0 | Created an isolated clone. |
| `git -C <temp> checkout --detach 7995961b0b6c2f2fc847da8ade16d2df594aee27` | 0 | Exact implementation commit checked out. |
| clone `git ls-files --stage` / `git submodule status` / `git fsck --full` | 0 | All clean-clone integrity checks passed. |
| GitHub Actions CI run `30987598336` | 0 | Repository integrity and the complete existing CI sequence passed. |
