#!/usr/bin/env bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

# Test pr-comment.sh by stubbing gh CLI.
# Verifies the four branches: create, update, resolve, none.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

# Create a fake gh command that records calls
GH_STUB="$TEMP_DIR/gh"
GH_LOG="$TEMP_DIR/gh.log"

cat > "$GH_STUB" << 'EOF'
#!/usr/bin/env bash
echo "$@" >> "${GH_LOG}"

# Simulate gh api responses
if [[ "$1" == "api" && "$2" =~ repos/.*/issues/.*/comments ]]; then
  # Build JSON response
  if [[ "${EXISTING_COMMENT:-}" == "1" ]]; then
    JSON='[{"id": 12345, "body": "<!-- crucible-tests:e2e-now-passing -->\nOld content"}]'
  else
    JSON='[]'
  fi

  # If --jq is present, pipe through jq
  if [[ "$*" =~ --jq ]]; then
    # Extract jq expression (next arg after --jq or after --paginate --jq)
    JQ_EXPR=""
    for ((i=1; i<=$#; i++)); do
      if [[ "${!i}" == "--jq" ]]; then
        j=$((i+1))
        JQ_EXPR="${!j}"
        break
      fi
    done
    echo "$JSON" | jq -r "$JQ_EXPR"
  else
    echo "$JSON"
  fi
fi
EOF

chmod +x "$GH_STUB"

# Export environment for pr-comment.sh
export PATH="$TEMP_DIR:$PATH"
export GH_REPO="owner/repo"
export PR_COMMENT_DRY_RUN=1
export GH_LOG

# Test cases
PASS=0
FAIL=0

test_case() {
  local desc="$1"
  local existing="$2"
  local body_file="$3"
  local expected="$4"

  > "$GH_LOG"
  export EXISTING_COMMENT="$existing"

  # Create body file if not "-"
  if [[ "$body_file" != "-" ]]; then
    echo "$body_file" > "$TEMP_DIR/body.md"
    body_file="$TEMP_DIR/body.md"
  fi

  local output
  output=$("$SCRIPT_DIR/pr-comment.sh" 123 "$body_file" 2>&1) || true

  if echo "$output" | grep -q "$expected"; then
    echo "✓ $desc"
    PASS=$((PASS + 1))
  else
    echo "✗ $desc"
    echo "  Expected: $expected"
    echo "  Got: $output"
    FAIL=$((FAIL + 1))
  fi
}

# Test 1: No existing comment, non-empty body → create
test_case "create new comment" "0" "Test content" "Would create comment"

# Test 2: Existing comment, non-empty body → update
test_case "update existing comment" "1" "Updated content" "Would update comment 12345"

# Test 3: Existing comment, empty body → resolve
test_case "resolve with empty body" "1" "" "Would update comment 12345 on PR 123 to resolved text"

# Test 4: No existing comment, empty body → none
test_case "no action when no comment and empty body" "0" "" "No action needed"

# Test 5: No existing comment, "-" → none
test_case "no action when no comment and dash" "0" "-" "No action needed"

# Test 6: Existing comment, "-" → update to resolved
test_case "resolve with dash" "1" "-" "Would update comment 12345"

# Report
echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "All $PASS tests passed"
  exit 0
else
  echo "$FAIL test(s) failed, $PASS passed"
  exit 1
fi
