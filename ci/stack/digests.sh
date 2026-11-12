#!/usr/bin/env bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

# Prints a markdown table of the image digest behind each container of the CI stack,
# so a run records exactly which :main builds it tested.
#
# Usage: ci/stack/digests.sh >> "$GITHUB_STEP_SUMMARY"

set -euo pipefail

STACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export COMPOSE_FILE="${COMPOSE_FILE:-$STACK_DIR/compose.yaml}"

echo "| service | image | digest |"
echo "|---|---|---|"
docker compose ps -a --format '{{.Service}} {{.Image}}' | sort -u | while read -r service image; do
  digest="$(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$image" 2>/dev/null | head -n1)"
  digest="${digest#*@}"
  echo "| $service | \`$image\` | \`${digest:-unknown}\` |"
done
