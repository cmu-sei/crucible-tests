#!/usr/bin/env bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

# Waits until each named compose service is ready, polling from the host.
#
# Usage: ci/stack/wait.sh <service...>
#
#   WAIT_TIMEOUT_SECONDS          overall limit, default 300. 0 checks once.
#   WAIT_STALL_RESTART_SECONDS    restart a stalled HTTP-probed service once after this
#                                 many seconds, default 90. 0 disables restarts.
#   WAIT_PROBE_<SVC>              (test-only) override the HTTP probe URL for <SVC> (name
#                                 uppercased, - -> _); when set, treats it as port-probed.
#   COMPOSE_FILE / COMPOSE_PROJECT_NAME  as for docker compose; COMPOSE_FILE
#                                 defaults to ci/stack/compose.yaml (project crucible-ci).
#
# Readiness, by service:
#   postgres            container healthcheck reports healthy
#   keycloak            GET https://localhost:8443/realms/crucible/.well-known/openid-configuration -> 200
#   keycloak-config     container exited with code 0
#   Crucible APIs       GET http://localhost:<port>/api/health/ready -> 200
#   topomojo/gameboard  GET http://localhost:<port>/api/version -> 2xx or 401; a 404 falls back to a TCP connect
#   UIs                 GET http://localhost:<port>/ -> 200
#   anything else       container healthcheck reports healthy
#
# Restart behavior: If a service with an HTTP probe (APIs, UIs, topomojo-api, gameboard-api)
# is running but not ready for WAIT_STALL_RESTART_SECONDS, it is restarted once. Subsequent
# polls wait for it within the overall timeout. postgres, keycloak, keycloak-config and
# healthcheck-only services are never restarted.
#
# Fails at once when a container has exited (other than keycloak-config with 0),
# and on timeout; either way it prints `docker compose logs --tail=200` for each
# service that isn't ready, and exits 1. On timeout, it also reports each pending
# service's container state, last probe result, and whether it was restarted.

set -uo pipefail

STACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export COMPOSE_FILE="${COMPOSE_FILE:-$STACK_DIR/compose.yaml}"
TIMEOUT="${WAIT_TIMEOUT_SECONDS:-300}"
STALL_RESTART_SECONDS="${WAIT_STALL_RESTART_SECONDS:-90}"
POLL_SECONDS=3

if [[ $# -eq 0 ]]; then
  echo "usage: $0 <service...>" >&2
  exit 2
fi

# The port each service is published on (same as .env.aspire).
port_of() {
  case "$1" in
    player-api) echo 4300 ;;      player-ui) echo 4301 ;;
    vm-api) echo 4302 ;;          vm-ui) echo 4303 ;;
    console-ui) echo 4305 ;;
    caster-api) echo 4309 ;;      caster-ui) echo 4310 ;;
    steamfitter-api) echo 4400 ;; steamfitter-ui) echo 4401 ;;
    alloy-api) echo 4402 ;;       alloy-ui) echo 4403 ;;
    cite-api) echo 4720 ;;        cite-ui) echo 4721 ;;
    gallery-api) echo 4722 ;;     gallery-ui) echo 4723 ;;
    blueprint-api) echo 4724 ;;   blueprint-ui) echo 4725 ;;
    topomojo-api) echo 5000 ;;    topomojo-ui) echo 4201 ;;
    gameboard-api) echo 5002 ;;   gameboard-ui) echo 4202 ;;
  esac
}

http_status() {
  curl -ks -o /dev/null -w '%{http_code}' --max-time 5 "$1" 2>/dev/null
}

# "<status> <exit code> <health>" of the service's container, or "missing".
container_state() {
  local id
  id="$(docker compose ps -a -q "$1" 2>/dev/null | head -n1)"
  if [[ -z "$id" ]]; then
    echo "missing"
    return
  fi
  docker inspect -f '{{.State.Status}} {{.State.ExitCode}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id" 2>/dev/null || echo "missing"
}

# Probes the service and echoes "ready" if it passes, or a probe status otherwise.
# For HTTP probes: the status code, or "no-connection" when curl gets 000.
# For healthcheck-only: "healthcheck:<health>".
# For TCP fallback: "tcp-refused" or "tcp-ok".
# Sets PROBE_RESULT to the same value; returns 0 when ready, 1 otherwise.
probe() {
  local service="$1" health="$2" port code url_var
  PROBE_RESULT=""

  # Test hook: WAIT_PROBE_<SVC> (SVC uppercased, - -> _) overrides the probe URL
  url_var="WAIT_PROBE_$(echo "$service" | tr '[:lower:]-' '[:upper:]_')"
  if [[ -n "${!url_var:-}" ]]; then
    code="$(http_status "${!url_var}")"
    PROBE_RESULT="$code"
    [[ "$code" == "000" ]] && PROBE_RESULT="no-connection"
    [[ "$code" == 200 ]] && PROBE_RESULT="ready" && return 0
    return 1
  fi

  port="$(port_of "$service")"
  case "$service" in
    keycloak)
      code="$(http_status https://localhost:8443/realms/crucible/.well-known/openid-configuration)"
      PROBE_RESULT="$code"
      [[ "$code" == "000" ]] && PROBE_RESULT="no-connection"
      [[ "$code" == 200 ]] && PROBE_RESULT="ready" && return 0
      return 1 ;;
    topomojo-api|gameboard-api)
      code="$(http_status "http://localhost:$port/api/version")"
      PROBE_RESULT="$code"
      [[ "$code" == "000" ]] && PROBE_RESULT="no-connection"
      if [[ "$code" == 2?? || "$code" == 401 ]]; then
        PROBE_RESULT="ready"
        return 0
      fi
      if [[ "$code" == 404 ]] && (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
        PROBE_RESULT="tcp-ok"
        return 0
      fi
      [[ "$code" == 404 ]] && PROBE_RESULT="tcp-refused"
      return 1 ;;
    *-api)
      if [[ -n "$port" ]]; then
        code="$(http_status "http://localhost:$port/api/health/ready")"
        PROBE_RESULT="$code"
        [[ "$code" == "000" ]] && PROBE_RESULT="no-connection"
        [[ "$code" == 200 ]] && PROBE_RESULT="ready" && return 0
        return 1
      fi
      PROBE_RESULT="healthcheck:$health"
      [[ "$health" == healthy ]] && PROBE_RESULT="ready" && return 0
      return 1 ;;
    *-ui)
      if [[ -n "$port" ]]; then
        code="$(http_status "http://localhost:$port/")"
        PROBE_RESULT="$code"
        [[ "$code" == "000" ]] && PROBE_RESULT="no-connection"
        [[ "$code" == 200 ]] && PROBE_RESULT="ready" && return 0
        return 1
      fi
      PROBE_RESULT="healthcheck:$health"
      [[ "$health" == healthy ]] && PROBE_RESULT="ready" && return 0
      return 1 ;;
    *)
      PROBE_RESULT="healthcheck:$health"
      [[ "$health" == healthy ]] && PROBE_RESULT="ready" && return 0
      return 1 ;;
  esac
}

# Returns 0 if the service is eligible for restart (HTTP-probed services only).
is_restartable() {
  local service="$1" url_var
  url_var="WAIT_PROBE_$(echo "$service" | tr '[:lower:]-' '[:upper:]_')"
  [[ -n "${!url_var:-}" ]] && return 0
  [[ -n "$(port_of "$service")" ]] && return 0
  [[ "$service" == keycloak ]] && return 0
  return 1
}

dump_logs() {
  local service
  for service in "$@"; do
    if [[ "${GITHUB_ACTIONS:-}" == true ]]; then echo "::group::logs: $service"; fi
    echo "===== docker compose logs --tail=200 $service ====="
    docker compose logs --no-color --tail=200 "$service" 2>&1
    if [[ "${GITHUB_ACTIONS:-}" == true ]]; then echo "::endgroup::"; fi
  done
}

pending=("$@")
start=$SECONDS
deadline=$((start + TIMEOUT))

# Track first-seen-running time, last probe result, and restart flag per service.
declare -A first_running last_probe restarted
for service in "${pending[@]}"; do
  first_running[$service]=0
  last_probe[$service]=""
  restarted[$service]=no
done

while :; do
  still=()
  for service in "${pending[@]}"; do
    read -r status exit_code health <<<"$(container_state "$service")"

    if [[ "$service" == keycloak-config && "$status" == exited && "$exit_code" == 0 ]]; then
      echo "ready: $service (completed, $((SECONDS - start))s)"
      continue
    fi
    if [[ "$status" == exited || "$status" == dead ]]; then
      echo "FAIL: $service exited with code $exit_code during startup"
      remaining=()
      for s in "${pending[@]}"; do [[ "$s" != "$service" ]] && remaining+=("$s"); done
      dump_logs "$service"
      if [[ ${#remaining[@]} -gt 0 ]]; then echo "not checked further: ${remaining[*]}"; fi
      exit 1
    fi

    # Track when the service first became running
    if [[ "$status" == running && ${first_running[$service]} -eq 0 ]]; then
      first_running[$service]=$SECONDS
    fi

    if [[ "$status" == running ]] && probe "$service" "$health"; then
      echo "ready: $service ($((SECONDS - start))s)"
      continue
    fi

    # Track the last probe result
    last_probe[$service]="$PROBE_RESULT"

    # Restart logic: if the service is running, restartable, not yet restarted, and has been
    # running for >= STALL_RESTART_SECONDS without becoming ready, restart it once.
    if [[ "$status" == running && ${restarted[$service]} == no && $STALL_RESTART_SECONDS -gt 0 ]] && is_restartable "$service"; then
      running_duration=$((SECONDS - first_running[$service]))
      if (( running_duration >= STALL_RESTART_SECONDS )); then
        echo "wait.sh: $service not ready after ${running_duration}s while running — restarting once (last probe: ${last_probe[$service]})"
        if [[ "${GITHUB_ACTIONS:-}" == true ]]; then
          echo "::warning title=Stalled service restarted::$service was restarted after ${running_duration}s (last probe: ${last_probe[$service]})"
        fi
        docker compose restart "$service" >/dev/null 2>&1
        restarted[$service]=yes
        # Reset first_running so the stall clock restarts at the restart command
        first_running[$service]=$SECONDS
      fi
    fi

    still+=("$service")
  done
  pending=("${still[@]+"${still[@]}"}")

  if [[ ${#pending[@]} -eq 0 ]]; then
    echo "all services ready ($((SECONDS - start))s)"
    exit 0
  fi
  if (( SECONDS >= deadline )); then
    echo "FAIL: not ready after ${TIMEOUT}s: ${pending[*]}"
    for service in "${pending[@]}"; do
      read -r status exit_code health <<<"$(container_state "$service")"
      echo "  $service: state=$status last-probe=${last_probe[$service]} restarted=${restarted[$service]}"
    done
    dump_logs "${pending[@]}"
    exit 1
  fi
  # Sleep only the remaining time if we're close to the deadline
  time_left=$((deadline - SECONDS))
  sleep_duration=$((time_left < POLL_SECONDS ? time_left : POLL_SECONDS))
  sleep "$sleep_duration"
done
