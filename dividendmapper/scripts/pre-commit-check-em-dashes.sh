#!/usr/bin/env bash
# pre-commit-check-em-dashes.sh: Pre-commit hook that blocks commits with em dashes.
# Install with: bash scripts/install-git-hooks.sh

set -euo pipefail

violations=0
while IFS= read -r -d '' file; do
  count=$(grep -c $'\xe2\x80\x94' "$file" 2>/dev/null || true)
  if [ "$count" -gt 0 ]; then
    echo "ERROR: $count em dash(es) found in $file"
    echo "  Em dashes (\u2014) are banned. Replace them with commas, colons, or periods."
    violations=$((violations + 1))
  fi
done < <(git diff --cached --name-only -z -- '*.mdx' '*.md')

if [ "$violations" -gt 0 ]; then
  echo ""
  echo "COMMIT BLOCKED: $violations file(s) contain em dashes."
  echo "Fix them and try again: bash scripts/fix-em-dashes.sh --check"
  exit 1
fi

exit 0