#!/usr/bin/env bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

# Test regression-issue.sh by stubbing gh CLI.
# Verifies the four branches: create, recurrence, recover, none.
# Tests both dry-run and real execution modes with gh call assertions.

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
    JSON='[{"name": "e2e-regression"}]'
  else
    JSON='[]'
  fi

  # Honor --jq like issue list does
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
elif [[ "$1" == "label" && "$2" == "create" ]]; then
  # Label creation returns success
  exit 0
elif [[ "$1" == "issue" && "$2" == "create" ]]; then
  # Issue creation returns issue JSON
  echo '{"number": 789, "url": "https://github.com/owner/repo/issues/789"}'
elif [[ "$1" == "issue" && "$2" == "comment" ]]; then
  # Comment creation returns success
  exit 0
elif [[ "$1" == "issue" && "$2" == "close" ]]; then
  # Issue close returns success
  exit 0
fi
EOF

chmod +x "$GH_STUB"

# Export environment for regression-issue.sh
export PATH="$TEMP_DIR:$PATH"
export GH_REPO="owner/repo"
export GH_LOG

# Test cases
PASS=0
FAIL=0

test_dry_run() {
  local desc="$1"
  local existing="$2"
  local label_exists="$3"
  local call_args="$4"
  local expected="$5"

  > "$GH_LOG"
  export EXISTING_ISSUE="$existing"
  export LABEL_EXISTS="$label_exists"
  export REGRESSION_ISSUE_DRY_RUN=1

  local output
  output=$(eval "$SCRIPT_DIR/regression-issue.sh cite $call_args" 2>&1) || true

  if echo "$output" | grep -q "$expected"; then
    echo "✓ DRY-RUN: $desc"
    PASS=$((PASS + 1))
  else
    echo "✗ DRY-RUN: $desc"
    echo "  Expected: $expected"
    echo "  Got: $output"
    FAIL=$((FAIL + 1))
  fi
}

test_real() {
  local desc="$1"
  local existing="$2"
  local label_exists="$3"
  local call_args="$4"
  local expected_output="$5"
  shift 5
  local expected_calls=("$@")

  > "$GH_LOG"
  export EXISTING_ISSUE="$existing"
  export LABEL_EXISTS="$label_exists"
  unset REGRESSION_ISSUE_DRY_RUN

  local output
  output=$(eval "$SCRIPT_DIR/regression-issue.sh cite $call_args" 2>&1) || true

  # Check output message
  if ! echo "$output" | grep -q "$expected_output"; then
    echo "✗ REAL: $desc (output)"
    echo "  Expected output: $expected_output"
    echo "  Got: $output"
    FAIL=$((FAIL + 1))
    return
  fi

  # Check gh calls
  local all_found=true
  for expected_call in "${expected_calls[@]}"; do
    if ! grep -qF -- "$expected_call" "$GH_LOG"; then
      if $all_found; then
        echo "✗ REAL: $desc (gh calls)"
        echo "  Missing call: $expected_call"
        echo "  Actual GH_LOG:"
        cat "$GH_LOG"
        all_found=false
      else
        echo "  Also missing: $expected_call"
      fi
      FAIL=$((FAIL + 1))
      return
    fi
  done

  if $all_found; then
    echo "✓ REAL: $desc"
    PASS=$((PASS + 1))
  fi
}

# Prepare test body files
echo '{"title": "E2E regression: cite", "issueBody": "Test issue body", "recurrenceBody": "Test recurrence body"}' > "$TEMP_DIR/body.json"
echo "Passing again; closing." > "$TEMP_DIR/recovered.txt"

# Dry-run tests
test_dry_run "create new issue" "0" "1" "$TEMP_DIR/body.json" "Would create issue"
test_dry_run "add recurrence comment" "1" "1" "$TEMP_DIR/body.json" "Would add recurrence comment to issue #456"
test_dry_run "recover and close" "1" "1" "--recovered $TEMP_DIR/recovered.txt" "Would add recovered comment and close issue #456"
test_dry_run "no action when no issue and recovered" "0" "1" "--recovered $TEMP_DIR/recovered.txt" "No action needed"

# Real execution tests with gh call assertions
test_real "create new issue (label exists)" "0" "1" "$TEMP_DIR/body.json" \
  "Created regression issue" \
  "issue create" "--repo owner/repo" "--title E2E regression: cite" "--label e2e-regression" "--body-file"

test_real "add recurrence comment" "1" "1" "$TEMP_DIR/body.json" \
  "Added recurrence comment to issue #456" \
  "issue comment 456" "--repo owner/repo" "--body-file"

test_real "recover and close" "1" "1" "--recovered $TEMP_DIR/recovered.txt" \
  "Closed issue #456 as recovered" \
  "issue comment 456" "issue close 456"

test_real "no action when no issue and recovered" "0" "1" "--recovered $TEMP_DIR/recovered.txt" \
  "No action needed"

test_real "create with missing label" "0" "0" "$TEMP_DIR/body.json" \
  "Created regression issue" \
  "label create e2e-regression" "issue create"

# Report
echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "All $PASS tests passed"
  exit 0
else
  echo "$FAIL test(s) failed, $PASS passed"
  exit 1
fi
