#!/usr/bin/env bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATE="${SCRIPT_DIR}/result-gate.sh"

# Test cases: <plan_result> <e2e_result> <expected_exit_code>
cases=(
  "success skipped 0"
  "success success 0"
  "success failure 1"
  "success cancelled 1"
  "failure skipped 1"
)

echo "Testing ci/result-gate.sh..."
failed=0

for case in "${cases[@]}"; do
  read -r plan e2e expected <<< "$case"

  if bash "$GATE" "$plan" "$e2e" &>/dev/null; then
    actual=0
  else
    actual=$?
  fi

  if [[ "$actual" -eq "$expected" ]]; then
    echo "✓ gate($plan, $e2e) → $actual"
  else
    echo "✗ gate($plan, $e2e) → $actual (expected $expected)"
    ((failed++))
  fi
done

if [[ $failed -eq 0 ]]; then
  echo "All tests passed."
  exit 0
else
  echo "FAILED: $failed test(s) failed."
  exit 1
fi
