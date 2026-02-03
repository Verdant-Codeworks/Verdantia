#!/bin/bash
# Warning-only reminder at commit time

STAGED_FILES=$(git diff --cached --name-only 2>/dev/null)

# Check for server source files (excluding tests, modules, DTOs, entities)
SERVER_SRC=$(echo "$STAGED_FILES" | \
  grep -E '^apps/server/src/.*\.ts$' | \
  grep -v '\.spec\.ts$' | \
  grep -v '__tests__/' | \
  grep -v 'index\.ts$' | \
  grep -v '\.module\.ts$' | \
  grep -v '\.dto\.ts$' | \
  grep -v '\.entity\.ts$')

if [ -z "$SERVER_SRC" ]; then
  exit 0
fi

# Check if any test files are also staged
STAGED_TESTS=$(echo "$STAGED_FILES" | grep '\.spec\.ts$')

if [ -z "$STAGED_TESTS" ]; then
  echo "" >&2
  echo "=== TEST REMINDER ===" >&2
  echo "Server source files committed without test files." >&2
  echo "If this includes new functionality, add tests first." >&2
  echo "Run: pnpm test" >&2
  echo "=====================" >&2
fi

exit 0  # Always allow - warning only
