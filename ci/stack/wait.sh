#!/usr/bin/env bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

# Waits until each named compose service is ready, polling from the host.
#
# Usage: ci/stack/wait.sh <service...>
#
#   WAIT_TIMEOUT_SECONDS  overall limit, default 300. 0 checks once.
#   COMPOSE_FILE / COMPOSE_PROJECT_NAME  as for docker compose; COMPOSE_FILE
#                         defaults to ci/stack/compose.yaml (project crucible-ci).
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
# Fails at once when a container has exited (other than keycloak-config with 0),
# and on timeout; either way it prints `docker compose logs --tail=200` for each
# service that isn't ready, and exits 1.

set -uo pipefail

STACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export COMPOSE_FILE="${COMPOSE_FILE:-$STACK_DIR/compose.yaml}"
TIMEOUT="${WAIT_TIMEOUT_SECONDS:-300}"
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

# Returns 0 when the service passes its readiness probe.
probe() {
  local service="$1" health="$2" port code
  port="$(port_of "$service")"
  case "$service" in
    keycloak)
      [[ "$(http_status https://localhost:8443/realms/crucible/.well-known/openid-configuration)" == 200 ]] ;;
    topomojo-api|gameboard-api)
      code="$(http_status "http://localhost:$port/api/version")"
      [[ "$code" == 2?? || "$code" == 401 ]] && return 0
      [[ "$code" == 404 ]] && (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null ;;
    *-api)
      [[ -n "$port" && "$(http_status "http://localhost:$port/api/health/ready")" == 200 ]] ;;
    *-ui)
      [[ -n "$port" && "$(http_status "http://localhost:$port/")" == 200 ]] ;;
    *)
      [[ "$health" == healthy ]] ;;
  esac
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
    if [[ "$status" == running ]] && probe "$service" "$health"; then
      echo "ready: $service ($((SECONDS - start))s)"
      continue
    fi
    still+=("$service")
  done
  pending=("${still[@]+"${still[@]}"}")

  if [[ ${#pending[@]} -eq 0 ]]; then
    echo "all services ready ($((SECONDS - start))s)"
    exit 0
  fi
  if (( SECONDS + POLL_SECONDS > deadline )); then
    echo "FAIL: not ready after ${TIMEOUT}s: ${pending[*]}"
    for service in "${pending[@]}"; do
      echo "  $service: $(container_state "$service")"
    done
    dump_logs "${pending[@]}"
    exit 1
  fi
  sleep "$POLL_SECONDS"
done
