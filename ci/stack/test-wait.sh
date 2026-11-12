#!/usr/bin/env bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

# Self-check for wait.sh: a container that exits during startup must fail the wait
# within its timeout and dump that service's logs, not hang until the job timeout.
#
# Starts a throwaway `crashy` service (busybox that prints a line and exits 3) from a
# temporary compose override, in its own compose project so it never touches the
# crucible-ci stack, then runs `WAIT_TIMEOUT_SECONDS=20 wait.sh crashy`. A second
# service, `hangy`, keeps running but never becomes ready, for the timeout path.
#
# Usage: bash ci/stack/test-wait.sh

set -uo pipefail

STACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="crucible-ci-waittest"
TMP_DIR="$(mktemp -d)"
OVERRIDE="$TMP_DIR/crashy.override.yaml"

cleanup() {
  docker compose -p "$PROJECT" -f "$STACK_DIR/compose.yaml" -f "$OVERRIDE" down -v --remove-orphans --timeout 0 >/dev/null 2>&1
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cat > "$OVERRIDE" <<'YAML'
services:
  crashy:
    image: busybox:1.37
    command: ["sh", "-c", "echo 'crashy: startup failed, database not ready'; exit 3"]
  hangy:
    image: busybox:1.37
    command: ["sh", "-c", "echo 'hangy: still starting'; exec sleep 600"]
YAML

failures=0
fail() { echo "FAIL $*"; failures=$((failures + 1)); }
pass() { echo "ok   $*"; }

if [[ ! -x "$STACK_DIR/wait.sh" ]]; then
  fail "ci/stack/wait.sh does not exist or is not executable"
  exit 1
fi

if ! docker compose -p "$PROJECT" -f "$STACK_DIR/compose.yaml" -f "$OVERRIDE" up -d crashy hangy >/dev/null 2>&1; then
  fail "could not start the crashy service"
  exit 1
fi

start=$SECONDS
output="$(COMPOSE_PROJECT_NAME="$PROJECT" COMPOSE_FILE="$STACK_DIR/compose.yaml:$OVERRIDE" \
  WAIT_TIMEOUT_SECONDS=20 "$STACK_DIR/wait.sh" crashy 2>&1)"
status=$?
elapsed=$((SECONDS - start))

echo "--- wait.sh output (exit $status, ${elapsed}s) ---"
echo "$output"
echo "---"

if [[ $status -ne 0 ]]; then pass "wait.sh exits non-zero ($status)"; else fail "wait.sh exited 0 for a crashed service"; fi
if [[ $elapsed -lt 30 ]]; then pass "wait.sh finished in under 30s (${elapsed}s)"; else fail "wait.sh took ${elapsed}s (limit 30s)"; fi
if grep -Eq '^crashy-1 +\| crashy: startup failed' <<<"$output"; then
  pass "output contains the crashy service's log lines"
else
  fail "output is missing the crashy service's log lines"
fi
if grep -q 'crashy.*exited with code 3' <<<"$output"; then
  pass "output names the crashed service and its exit code"
else
  fail "output does not say crashy exited with code 3"
fi

# Timeout path: a running container that never passes its probe.
start=$SECONDS
output="$(COMPOSE_PROJECT_NAME="$PROJECT" COMPOSE_FILE="$STACK_DIR/compose.yaml:$OVERRIDE" \
  WAIT_TIMEOUT_SECONDS=6 "$STACK_DIR/wait.sh" hangy 2>&1)"
status=$?
elapsed=$((SECONDS - start))

echo "--- wait.sh output (exit $status, ${elapsed}s) ---"
echo "$output"
echo "---"

if [[ $status -ne 0 ]]; then pass "timeout: wait.sh exits non-zero ($status)"; else fail "timeout: wait.sh exited 0 for a service that never became ready"; fi
if [[ $elapsed -ge 6 && $elapsed -lt 16 ]]; then pass "timeout: wait.sh gave up after its timeout (${elapsed}s)"; else fail "timeout: wait.sh took ${elapsed}s (expected 6-15s)"; fi
if grep -q 'not ready after 6s: hangy' <<<"$output"; then pass "timeout: output names the service"; else fail "timeout: output does not name hangy"; fi
if grep -Eq '^hangy-1 +\| hangy: still starting' <<<"$output"; then
  pass "timeout: output contains the hangy service's log lines"
else
  fail "timeout: output is missing the hangy service's log lines"
fi

if [[ $failures -gt 0 ]]; then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all wait.sh checks passed"
