#!/usr/bin/env bash
# fix-em-dashes.sh: Replace all em dashes (U+2014) with commas in .mdx and .md files.
# Usage:
#   ./scripts/fix-em-dashes.sh [path]          # Fix em dashes in path
#   ./scripts/fix-em-dashes.sh --check [path]  # Check-only: exit 1 if any found
#   Default path: app/blog/

set -euo pipefail

check_mode=false
target="app/blog"

if [ "${1:-}" = "--check" ]; then
  check_mode=true
  shift
fi

target="${1:-$target}"

echo "Scanning for em dashes in: $target"
found=0
violations=0

while IFS= read -r -d '' file; do
  count=$(grep -c $'\xe2\x80\x94' "$file" 2>/dev/null || true)
  if [ "$count" -gt 0 ]; then
    if [ "$check_mode" = true ]; then
      echo "  VIOLATION: $count em dash(es) in $file"
      violations=$((violations + 1))
    else
      echo "  Fixing $count em dash(es) in $file"
      sed -i 's/\xe2\x80\x94/, /g' "$file"
      found=$((found + 1))
    fi
  fi
done < <(find "$target" -type f \( -name '*.mdx' -o -name '*.md' \) -print0 2>/dev/null || true)

if [ "$check_mode" = true ]; then
  if [ "$violations" -gt 0 ]; then
    echo ""
    echo "CONTENT_QUALITY_GATE: fail"
    echo "REASON: $violations file(s) contain em dashes"
    echo "BLOCKED: true"
    exit 1
  else
    echo "  No em dashes found."
    echo "CONTENT_QUALITY_GATE: pass"
    exit 0
  fi
else
  if [ "$found" -eq 0 ]; then
    echo "  No em dashes found."
  else
    echo "Fixed $found file(s)."
  fi
  echo "Done."
fi