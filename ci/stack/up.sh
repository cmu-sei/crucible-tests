#!/usr/bin/env bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

# Pulls and starts one app's slice of the CI stack - Postgres, Keycloak and
# keycloak-config plus the services ci/slices.json lists for the app - then waits
# for all of them with wait.sh.
#
# Usage: ci/stack/up.sh <app>     (run ci/stack/prepare.sh first)

set -euo pipefail

STACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SLICES="$STACK_DIR/../slices.json"
export COMPOSE_FILE="${COMPOSE_FILE:-$STACK_DIR/compose.yaml}"

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <app>   (apps: $(jq -r 'keys | join(", ")' "$SLICES"))" >&2
  exit 2
fi
app="$1"

if ! slice="$(jq -er --arg app "$app" '.[$app].services | join(" ")' "$SLICES" 2>/dev/null)"; then
  echo "up.sh: no slice for '$app' in ci/slices.json (apps: $(jq -r 'keys | join(", ")' "$SLICES"))" >&2
  exit 2
fi

for generated in keycloak.crt keycloak.key ca-bundle.pem realm-bootstrap.json realm.json ui/settings.shared.json; do
  if [[ ! -f "$STACK_DIR/.generated/$generated" ]]; then
    echo "up.sh: ci/stack/.generated/$generated is missing; run ci/stack/prepare.sh <crucible-development-dir> first" >&2
    exit 1
  fi
done

# shellcheck disable=SC2206 # word-splitting the service list is intended
services=(postgres keycloak keycloak-config $slice)
echo "up.sh: $app -> ${services[*]}"

docker compose pull --quiet "${services[@]}"

# `up` blocks until postgres is healthy and keycloak-config has completed, because the
# APIs depend on both. If that fails, one wait.sh pass reports which service and why.
if ! docker compose up -d "${services[@]}"; then
  echo "up.sh: docker compose up failed"
  WAIT_TIMEOUT_SECONDS=0 "$STACK_DIR/wait.sh" "${services[@]}" || true
  exit 1
fi

exec "$STACK_DIR/wait.sh" "${services[@]}"
