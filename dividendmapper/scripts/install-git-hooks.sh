#!/usr/bin/env bash
# install-git-hooks.sh: Install the em-dash pre-commit hook for this repo.
# Run from the repo root.
# Usage: bash scripts/install-git-hooks.sh

set -euo pipefail

HOOK_DIR=".git/hooks"
HOOK_SRC="scripts/pre-commit-check-em-dashes.sh"
HOOK_DST="$HOOK_DIR/pre-commit"

if [ ! -d "$HOOK_DIR" ]; then
  echo "ERROR: $HOOK_DIR not found. Run from the repo root."
  exit 1
fi

if [ -f "$HOOK_DST" ]; then
  echo "WARNING: $HOOK_DST already exists. Overwriting."
fi

cp "$HOOK_SRC" "$HOOK_DST"
chmod +x "$HOOK_DST"
echo "Installed pre-commit hook at $HOOK_DST"