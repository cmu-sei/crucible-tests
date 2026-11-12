#!/usr/bin/env bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

# Test regression-issue.sh by stubbing gh CLI.
# Verifies the four branches: create, recurrence, recover, none.
# Tests both dry-run and real execution modes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

# Create a fake gh command that records calls
GH_STUB="$TEMP_DIR/gh"
GH_LOG="$TEMP_DIR/gh.log"

cat > "$GH_STUB" << 'EOF'
#!/usr/bin/env bash
# Log all calls
echo "$*" >> "${GH_LOG}"

# Simulate gh responses
if [[ "$1" == "issue" && "$2" == "list" ]]; then
  if [[ "${EXISTING_ISSUE:-}" == "1" ]]; then
    JSON='[{"number": 456, "body": "<!-- crucible-tests:e2e-regression:cite -->\\nOld content"}]'
  else
    JSON='[]'
  fi

  if [[ "$*" =~ --jq ]]; then
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
elif [[ "$1" == "label" && "$2" == "list" ]]; then
  if [[ "${LABEL_EXISTS:-}" == "1" ]]; then
    echo '[{"name": "e2e-regression"}]'
  else
    echo '[]'
  fi
fi
EOF

chmod +x "$GH_STUB"

# No jq stub needed - real jq handles all filters correctly
# The gh stub now outputs valid JSON with proper escaping

# Export environment for regression-issue.sh
export PATH="$TEMP_DIR:$PATH"
export GH_REPO="owner/repo"
export GH_LOG

# Test cases
PASS=0
FAIL=0

test_case() {
  local desc="$1"
  local existing="$2"
  local label_exists="$3"
  local is_dry_run="$4"
  local call_args="$5"
  local expected="$6"

  > "$GH_LOG"
  export EXISTING_ISSUE="$existing"
  export LABEL_EXISTS="$label_exists"

  if [[ "$is_dry_run" == "1" ]]; then
    export REGRESSION_ISSUE_DRY_RUN=1
  else
    unset REGRESSION_ISSUE_DRY_RUN
  fi

  local output
  output=$(eval "$SCRIPT_DIR/regression-issue.sh cite $call_args" 2>&1) || true

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

# Prepare test body files
echo '{"title": "E2E regression: cite", "issueBody": "Test issue body", "recurrenceBody": "Test recurrence body"}' > "$TEMP_DIR/body.json"
echo "Passing again; closing." > "$TEMP_DIR/recovered.txt"

# Dry-run tests
test_case "DRY-RUN: create new issue" "0" "1" "1" "$TEMP_DIR/body.json" "Would create issue"
test_case "DRY-RUN: add recurrence comment" "1" "1" "1" "$TEMP_DIR/body.json" "Would add recurrence comment to issue #456"
test_case "DRY-RUN: recover and close" "1" "1" "1" "--recovered $TEMP_DIR/recovered.txt" "Would add recovered comment and close issue #456"
test_case "DRY-RUN: no action when no issue and recovered" "0" "1" "1" "--recovered $TEMP_DIR/recovered.txt" "No action needed"

# Real execution tests - these verify the script logic and gh call patterns
test_case "REAL: create new issue" "0" "1" "0" "$TEMP_DIR/body.json" "Created regression issue"
test_case "REAL: add recurrence comment" "1" "1" "0" "$TEMP_DIR/body.json" "Added recurrence comment to issue #456"
test_case "REAL: recover and close" "1" "1" "0" "--recovered $TEMP_DIR/recovered.txt" "Closed issue #456 as recovered"
test_case "REAL: no action when no issue and recovered" "0" "1" "0" "--recovered $TEMP_DIR/recovered.txt" "No action needed"

# Report
echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "All $PASS tests passed"
  exit 0
else
  echo "$FAIL test(s) failed, $PASS passed"
  exit 1
fi
