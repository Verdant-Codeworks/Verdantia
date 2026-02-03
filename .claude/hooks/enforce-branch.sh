#!/bin/bash
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

if [[ "$BRANCH" == "main" || "$BRANCH" == "develop" ]]; then
  cat << 'EOF' >&2
BLOCKED: Cannot edit files on main or develop branch.

Create a feature branch first:
  git checkout -b feature/[feature-name]
EOF
  exit 2
fi

exit 0
