#!/usr/bin/env bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

# Prints a markdown table of the image digest behind each container of the CI stack,
# so a run records exactly which :main builds it tested.
# Also writes ci-artifacts/digests.json with { "service": "image@digest" }.
#
# Usage: ci/stack/digests.sh [--json <path>] >> "$GITHUB_STEP_SUMMARY"

set -euo pipefail

STACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export COMPOSE_FILE="${COMPOSE_FILE:-$STACK_DIR/compose.yaml}"

# Parse args
JSON_PATH=""
if [[ "${1:-}" == "--json" && -n "${2:-}" ]]; then
  JSON_PATH="$2"
fi

# Default JSON path (outside test-results which Playwright cleans)
if [[ -z "$JSON_PATH" ]]; then
  JSON_PATH="ci-artifacts/digests.json"
fi

# Ensure directory exists
mkdir -p "$(dirname "$JSON_PATH")"

echo "| service | image | digest |"
echo "|---|---|---|"

# Collect digests into associative array
declare -A DIGESTS

docker compose ps -a --format '{{.Service}} {{.Image}}' | sort -u | while read -r service image; do
  digest="$(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$image" 2>/dev/null | head -n1)"
  digest="${digest#*@}"

  echo "| $service | \`$image\` | \`${digest:-unknown}\` |"

  # Write to temp file for JSON generation (pipes run in subshells)
  if [[ -n "${digest:-}" ]]; then
    echo "$service $image@$digest" >> "${JSON_PATH}.tmp"
  fi
done

# Generate JSON from temp file
if [[ -f "${JSON_PATH}.tmp" ]]; then
  echo "{" > "$JSON_PATH"
  first=1
  while read -r service imageDigest; do
    if [[ $first -eq 0 ]]; then
      echo "," >> "$JSON_PATH"
    fi
    echo -n "  \"$service\": \"$imageDigest\"" >> "$JSON_PATH"
    first=0
  done < "${JSON_PATH}.tmp"
  echo "" >> "$JSON_PATH"
  echo "}" >> "$JSON_PATH"
  rm -f "${JSON_PATH}.tmp"
else
  # No digests collected
  echo "{}" > "$JSON_PATH"
fi
