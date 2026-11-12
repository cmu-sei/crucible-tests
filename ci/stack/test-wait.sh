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
if [[ $elapsed -ge 4 && $elapsed -lt 16 ]]; then pass "timeout: wait.sh gave up after its timeout (${elapsed}s)"; else fail "timeout: wait.sh took ${elapsed}s (expected 4-15s)"; fi
if grep -q 'not ready after 6s: hangy' <<<"$output"; then pass "timeout: output names the service"; else fail "timeout: output does not name hangy"; fi
if grep -Eq '^hangy-1 +\| hangy: still starting' <<<"$output"; then
  pass "timeout: output contains the hangy service's log lines"
else
  fail "timeout: output is missing the hangy service's log lines"
fi

# Test the restart behavior: a service that stalls then recovers after restart.
# Uses a bind-mounted state directory: no /state/started -> stall; exists -> serve HTTP 200.
STALL_PORT=19123
STALL_DIR="$TMP_DIR/stall-state"
STALL_OVERRIDE="$TMP_DIR/stall.override.yaml"
mkdir -p "$STALL_DIR"

# First verify the port is free
if (exec 3<>"/dev/tcp/127.0.0.1/$STALL_PORT") 2>/dev/null; then
  fail "test port $STALL_PORT is already in use"
  exit 1
fi

cat > "$STALL_OVERRIDE" <<YAML
services:
  stall-then-recover:
    image: busybox:1.37
    network_mode: host
    command:
      - sh
      - -c
      - |
        if [ ! -f /state/started ]; then
          echo 'stall-then-recover: initial start, not listening'
          touch /state/started
          exec sleep 3600
        else
          echo 'stall-then-recover: restarted, now serving HTTP 200'
          while true; do
            printf 'HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok' | nc -l -p $STALL_PORT
          done
        fi
    volumes:
      - type: bind
        source: $STALL_DIR
        target: /state
YAML

if ! docker compose -p "$PROJECT" -f "$STACK_DIR/compose.yaml" -f "$STALL_OVERRIDE" up -d stall-then-recover >/dev/null 2>&1; then
  fail "could not start the stall-then-recover service"
  exit 1
fi

start=$SECONDS
output="$(COMPOSE_PROJECT_NAME="$PROJECT" COMPOSE_FILE="$STACK_DIR/compose.yaml:$STALL_OVERRIDE" \
  WAIT_STALL_RESTART_SECONDS=5 WAIT_TIMEOUT_SECONDS=60 WAIT_PROBE_STALL_THEN_RECOVER="http://127.0.0.1:$STALL_PORT/" \
  "$STACK_DIR/wait.sh" stall-then-recover 2>&1)"
status=$?
elapsed=$((SECONDS - start))

echo "--- stall-then-recover output (exit $status, ${elapsed}s) ---"
echo "$output"
echo "---"

if [[ $status -eq 0 ]]; then pass "stall-then-recover: wait.sh exits 0"; else fail "stall-then-recover: wait.sh exited $status"; fi
if [[ $elapsed -lt 60 ]]; then pass "stall-then-recover: finished in under 60s (${elapsed}s)"; else fail "stall-then-recover: took ${elapsed}s"; fi
if grep -q 'restarting once' <<<"$output"; then
  pass "stall-then-recover: output contains 'restarting once'"
else
  fail "stall-then-recover: output is missing 'restarting once'"
fi
restart_lines=$(grep -c 'restarting once' <<<"$output" || true)
if [[ $restart_lines -eq 1 ]]; then
  pass "stall-then-recover: exactly one restart line"
else
  fail "stall-then-recover: found $restart_lines restart lines (expected 1)"
fi

docker compose -p "$PROJECT" -f "$STACK_DIR/compose.yaml" -f "$STALL_OVERRIDE" down -v --timeout 0 >/dev/null 2>&1
rm -f "$STALL_DIR/started"

# Test: a service that never recovers even after restart
cat > "$STALL_OVERRIDE" <<YAML
services:
  stall-never-recovers:
    image: busybox:1.37
    network_mode: host
    command: ["sh", "-c", "echo 'stall-never-recovers: running but never listening'; exec sleep 3600"]
YAML

if ! docker compose -p "$PROJECT" -f "$STACK_DIR/compose.yaml" -f "$STALL_OVERRIDE" up -d stall-never-recovers >/dev/null 2>&1; then
  fail "could not start the stall-never-recovers service"
  exit 1
fi

start=$SECONDS
output="$(COMPOSE_PROJECT_NAME="$PROJECT" COMPOSE_FILE="$STACK_DIR/compose.yaml:$STALL_OVERRIDE" \
  WAIT_STALL_RESTART_SECONDS=5 WAIT_TIMEOUT_SECONDS=25 WAIT_PROBE_STALL_NEVER_RECOVERS="http://127.0.0.1:$STALL_PORT/" \
  "$STACK_DIR/wait.sh" stall-never-recovers 2>&1)"
status=$?
elapsed=$((SECONDS - start))

echo "--- stall-never-recovers output (exit $status, ${elapsed}s) ---"
echo "$output"
echo "---"

if [[ $status -ne 0 ]]; then pass "stall-never-recovers: wait.sh exits non-zero ($status)"; else fail "stall-never-recovers: wait.sh exited 0"; fi
if [[ $elapsed -ge 5 && $elapsed -lt 40 ]]; then pass "stall-never-recovers: finished in under 40s (${elapsed}s)"; else fail "stall-never-recovers: took ${elapsed}s (expected 5-40s)"; fi
restart_lines=$(grep -c 'restarting once' <<<"$output" || true)
if [[ $restart_lines -eq 1 ]]; then
  pass "stall-never-recovers: exactly one 'restarting once' line"
else
  fail "stall-never-recovers: found $restart_lines restart lines (expected 1)"
fi
if grep -q 'last-probe=no-connection' <<<"$output"; then
  pass "stall-never-recovers: pending summary contains 'last-probe=no-connection'"
else
  fail "stall-never-recovers: pending summary missing 'last-probe=no-connection'"
fi
if grep -q 'restarted=yes' <<<"$output"; then
  pass "stall-never-recovers: pending summary contains 'restarted=yes'"
else
  fail "stall-never-recovers: pending summary missing 'restarted=yes'"
fi

docker compose -p "$PROJECT" -f "$STACK_DIR/compose.yaml" -f "$STALL_OVERRIDE" down -v --timeout 0 >/dev/null 2>&1

# Test: restarts disabled with WAIT_STALL_RESTART_SECONDS=0
cat > "$STALL_OVERRIDE" <<YAML
services:
  restarts-disabled:
    image: busybox:1.37
    network_mode: host
    command: ["sh", "-c", "echo 'restarts-disabled: running but never listening'; exec sleep 3600"]
YAML

if ! docker compose -p "$PROJECT" -f "$STACK_DIR/compose.yaml" -f "$STALL_OVERRIDE" up -d restarts-disabled >/dev/null 2>&1; then
  fail "could not start the restarts-disabled service"
  exit 1
fi

start=$SECONDS
output="$(COMPOSE_PROJECT_NAME="$PROJECT" COMPOSE_FILE="$STACK_DIR/compose.yaml:$STALL_OVERRIDE" \
  WAIT_STALL_RESTART_SECONDS=0 WAIT_TIMEOUT_SECONDS=8 WAIT_PROBE_RESTARTS_DISABLED="http://127.0.0.1:$STALL_PORT/" \
  "$STACK_DIR/wait.sh" restarts-disabled 2>&1)"
status=$?
elapsed=$((SECONDS - start))

echo "--- restarts-disabled output (exit $status, ${elapsed}s) ---"
echo "$output"
echo "---"

if [[ $status -ne 0 ]]; then pass "restarts-disabled: wait.sh exits non-zero ($status)"; else fail "restarts-disabled: wait.sh exited 0"; fi
if grep -q 'restarting once' <<<"$output"; then
  fail "restarts-disabled: output contains 'restarting once' (should not restart)"
else
  pass "restarts-disabled: no 'restarting once' line"
fi
if grep -q 'restarted=no' <<<"$output"; then
  pass "restarts-disabled: pending summary contains 'restarted=no'"
else
  fail "restarts-disabled: pending summary missing 'restarted=no'"
fi

if [[ $failures -gt 0 ]]; then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all wait.sh checks passed"
