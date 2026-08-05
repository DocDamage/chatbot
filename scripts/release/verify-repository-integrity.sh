#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

echo "::group::git ls-files --stage"
git ls-files --stage
echo "::endgroup::"

echo "::group::git submodule status"
git submodule status
echo "::endgroup::"

echo "::group::git fsck --full"
git fsck --full
echo "::endgroup::"

source_commit="$(git rev-parse HEAD)"
clone_parent="$(mktemp -d)"
trap 'rm -rf "$clone_parent"' EXIT
clone_dir="$clone_parent/checkout"

echo "::group::clean clone and checkout"
git clone --no-local --no-recurse-submodules . "$clone_dir"
git -C "$clone_dir" checkout --detach "$source_commit"
git -C "$clone_dir" ls-files --stage
git -C "$clone_dir" submodule status
git -C "$clone_dir" fsck --full
echo "Clean clone and detached checkout passed for $source_commit"
echo "::endgroup::"
