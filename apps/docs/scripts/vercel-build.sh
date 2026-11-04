#!/usr/bin/env bash
# The Vercel build. Vercel clones only the last few commits, but the sitemap dates each page from
# git history, so fetch all of it first. Vercel's clone has no usable remote, and `git fetch
# --unshallow` without one does nothing yet exits 0, so check the result rather than the exit code
# and fall back to the public URL. scripts/check-sitemap-lastmod.mjs fails the build if both fail.
set -euo pipefail
cd "$(dirname "$0")/../../.."
export GIT_TERMINAL_PROMPT=0
shallow() { [ "$(git rev-parse --is-shallow-repository)" = true ]; }
if shallow; then git fetch --unshallow || true; fi
if shallow; then git fetch --unshallow https://github.com/marcellosso/penciled.git || true; fi
echo "vercel-build: shallow=$(git rev-parse --is-shallow-repository), commits=$(git rev-list --count HEAD)"
pnpm docs:build
