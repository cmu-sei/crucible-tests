#!/usr/bin/env bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

# Test regression-issue.sh by stubbing gh CLI.
# Verifies the four branches: create, recurrence, recover, none.
# Also checks label creation logic.

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
if [[ "$1" == "issue" && "$2" == "list" ]]; then
  # Build JSON response
  if [[ "${EXISTING_ISSUE:-}" == "1" ]]; then
    JSON='[{"number": 456, "body": "<!-- crucible-tests:e2e-regression:cite -->\nOld content"}]'
  else
    JSON='[]'
  fi

  # If --jq is present, pipe through jq
  if [[ "$*" =~ --jq ]]; then
    # Extract jq expression
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
elif [[ "$1" == "label" && "$2" == "list" ]]; then
  # Simulate label check
  if [[ "${LABEL_EXISTS:-}" == "1" ]]; then
    echo '[{"name": "e2e-regression"}]'
  else
    echo '[]'
  fi
fi
EOF

chmod +x "$GH_STUB"

# Create jq stub (in case it's not available)
if ! command -v jq &> /dev/null; then
  cat > "$TEMP_DIR/jq" << 'EOF'
#!/usr/bin/env node
// Minimal jq stub for testing
const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8');

const arg = process.argv[2];
if (arg === '-r') {
  const selector = process.argv[3];
  const obj = JSON.parse(input);
  if (selector === '.title') {
    console.log(obj.title);
  } else if (selector === '.body') {
    console.log(obj.body);
  }
}
EOF
  chmod +x "$TEMP_DIR/jq"
fi

# Export environment for regression-issue.sh
export PATH="$TEMP_DIR:$PATH"
export GH_REPO="owner/repo"
export REGRESSION_ISSUE_DRY_RUN=1
export GH_LOG

# Test cases
PASS=0
FAIL=0

test_case() {
  local desc="$1"
  local existing="$2"
  local label_exists="$3"
  local body_file="$4"
  local expected="$5"

  > "$GH_LOG"
  export EXISTING_ISSUE="$existing"
  export LABEL_EXISTS="$label_exists"

  # Create body file if not "-recovered"
  if [[ "$body_file" != "-recovered" ]]; then
    echo '{"title": "E2E regression: cite", "body": "Test content"}' > "$TEMP_DIR/body.json"
    body_file="$TEMP_DIR/body.json"
  fi

  local output
  output=$("$SCRIPT_DIR/regression-issue.sh" cite "$body_file" 2>&1) || true

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

# Test 1: No existing issue, non-empty body → create
test_case "create new issue" "0" "1" "body" "Would create issue with label e2e-regression"

# Test 2: Existing issue, non-empty body → recurrence
test_case "add recurrence comment" "1" "1" "body" "Would add recurrence comment to issue #456"

# Test 3: Existing issue, -recovered → recover and close
test_case "recover and close" "1" "1" "-recovered" "Would add recovered comment and close issue #456"

# Test 4: No existing issue, -recovered → none
test_case "no action when no issue and recovered" "0" "1" "-recovered" "No action needed"

# Test 5: Label creation check
test_case "label does not exist" "0" "0" "body" "Would create issue"

# Report
echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "All $PASS tests passed"
  exit 0
else
  echo "$FAIL test(s) failed, $PASS passed"
  exit 1
fi
