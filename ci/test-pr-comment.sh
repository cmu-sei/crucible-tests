#!/usr/bin/env bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

# Test pr-comment.sh by stubbing gh CLI.
# Verifies the branches (create, update, resolve, none), that the resolved body posted is
# the one rendered in JS, and that a failed comment lookup fails without posting.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

# Create a fake gh command that records calls
GH_STUB="$TEMP_DIR/gh"
GH_LOG="$TEMP_DIR/gh.log"
POSTED="$TEMP_DIR/posted.md"

cat > "$GH_STUB" << 'EOF'
#!/usr/bin/env bash
echo "$@" >> "${GH_LOG}"

# Writes: record the body file that would be posted
if [[ "$1" == "api" && "$2" == "-X" ]]; then
  for arg in "$@"; do
    if [[ "$arg" == body=@* ]]; then
      cp "${arg#body=@}" "${POSTED}"
    fi
  done
  exit 0
fi

# Simulate the comment lookup
if [[ "$1" == "api" && "$2" =~ repos/.*/issues/.*/comments ]]; then
  if [[ "${LOOKUP_FAIL:-}" == "1" ]]; then
    echo "HTTP 502: Bad Gateway" >&2
    exit 1
  fi
  if [[ "${EXISTING_COMMENT:-}" == "1" ]]; then
    JSON='[{"id": 1, "body": "unrelated"}, {"id": 12345, "body": "<!-- crucible-tests:e2e-now-passing -->\nOld content"}, {"id": 67890, "body": "<!-- crucible-tests:e2e-now-passing -->\nDuplicate"}]'
  else
    JSON='[{"id": 1, "body": "unrelated"}]'
  fi

  JQ_EXPR=""
  for ((i=1; i<=$#; i++)); do
    if [[ "${!i}" == "--jq" ]]; then
      j=$((i+1))
      JQ_EXPR="${!j}"
      break
    fi
  done
  if [[ -n "$JQ_EXPR" ]]; then
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
export GH_LOG POSTED

RUN_URL="https://github.com/owner/repo/actions/runs/424242"
node --no-warnings "$REPO_ROOT/scripts/render-pr-comment.mjs" --resolved --run-url "$RUN_URL" --sha abcdef1234567 > "$TEMP_DIR/resolved.md"

PASS=0
FAIL=0

pass() { echo "✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "✗ $1"; shift; for line in "$@"; do echo "  $line"; done; FAIL=$((FAIL + 1)); }

# test_case <desc> <existing> <expected output> <pr-comment.sh args after the PR number...>
test_case() {
  local desc="$1" existing="$2" expected="$3"
  shift 3
  : > "$GH_LOG"
  export EXISTING_COMMENT="$existing" PR_COMMENT_DRY_RUN=1

  local output
  output=$("$SCRIPT_DIR/pr-comment.sh" 123 "$@" 2>&1) || true

  if grep -q -- "$expected" <<<"$output"; then
    pass "$desc"
  else
    fail "$desc" "Expected: $expected" "Got: $output"
  fi
}

echo "Test content" > "$TEMP_DIR/body.md"
: > "$TEMP_DIR/empty.md"

test_case "create new comment" 0 "Would create comment" "$TEMP_DIR/body.md"
test_case "update existing comment (first marker match)" 1 "Would update comment 12345 on PR 123$" "$TEMP_DIR/body.md"
test_case "empty body leaves an existing comment alone" 1 "No action needed" "$TEMP_DIR/empty.md"
test_case "no action when no comment and empty body" 0 "No action needed" "$TEMP_DIR/empty.md"
test_case "resolve existing comment" 1 "Would update comment 12345 on PR 123 to resolved text" --resolve "$TEMP_DIR/resolved.md"
test_case "resolve with no comment does nothing" 0 "No action needed" --resolve "$TEMP_DIR/resolved.md"

# Real resolve: the posted body is the JS-rendered one, with real line breaks and the run link
: > "$GH_LOG"
rm -f "$POSTED"
unset PR_COMMENT_DRY_RUN
export EXISTING_COMMENT=1
if output=$("$SCRIPT_DIR/pr-comment.sh" 123 --resolve "$TEMP_DIR/resolved.md" 2>&1) \
  && grep -qF "api -X PATCH repos/owner/repo/issues/comments/12345" "$GH_LOG" \
  && [[ -f "$POSTED" ]] \
  && [[ "$(head -n 1 "$POSTED")" == "<!-- crucible-tests:e2e-now-passing -->" ]] \
  && [[ "$(wc -l < "$POSTED")" -ge 2 ]] \
  && ! grep -qF '\n' "$POSTED" \
  && grep -qF "($RUN_URL)" "$POSTED"; then
  pass "resolve posts the JS-rendered body (real newline, run URL)"
else
  fail "resolve posts the JS-rendered body (real newline, run URL)" "Output: ${output:-}" "Log: $(cat "$GH_LOG")" "Posted: $(cat "$POSTED" 2>/dev/null)"
fi

# A failed lookup must fail the script and never post
for mode in upsert resolve; do
  : > "$GH_LOG"
  export LOOKUP_FAIL=1 EXISTING_COMMENT=0
  if [[ "$mode" == "upsert" ]]; then args=("$TEMP_DIR/body.md"); else args=(--resolve "$TEMP_DIR/resolved.md"); fi
  status=0
  output=$("$SCRIPT_DIR/pr-comment.sh" 123 "${args[@]}" 2>&1) || status=$?
  if [[ $status -ne 0 ]] && ! grep -q -- "-X POST\|-X PATCH" "$GH_LOG"; then
    pass "failed lookup ($mode) exits non-zero without posting"
  else
    fail "failed lookup ($mode) exits non-zero without posting" "Exit: $status" "Output: $output" "Log: $(cat "$GH_LOG")"
  fi
  unset LOOKUP_FAIL
done

# Report
echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "All $PASS tests passed"
  exit 0
else
  echo "$FAIL test(s) failed, $PASS passed"
  exit 1
fi
