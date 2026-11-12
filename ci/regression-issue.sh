#!/usr/bin/env bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

# Upsert regression issue for a specific app.
#
# Usage:
#   regression-issue.sh <app> <body-file>
#   regression-issue.sh <app> --recovered <body-file>
#
# When --recovered is specified, adds the recovered comment from body-file and closes the issue, or does nothing if no issue exists.
# Otherwise, body-file contains JSON with {action, title, body}; creates a new issue or adds a recurrence comment.
#
# Environment:
#   GH_TOKEN or GITHUB_TOKEN: GitHub token with issues: write
#   GH_REPO or GITHUB_REPOSITORY: owner/repo
#   REGRESSION_ISSUE_DRY_RUN: if set, print action instead of executing

set -euo pipefail

LABEL='e2e-regression'

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Usage: regression-issue.sh <app> <body-file> | regression-issue.sh <app> --recovered <body-file>" >&2
  exit 1
fi

APP="$1"
BODY_ARG="$2"
BODY_FILE_ARG="${3:-}"

# Ensure gh is available
if ! command -v gh &> /dev/null; then
  echo "Error: gh CLI not found" >&2
  exit 1
fi

# Get repo from environment
REPO="${GH_REPO:-${GITHUB_REPOSITORY:-}}"
if [[ -z "$REPO" ]]; then
  echo "Error: GH_REPO or GITHUB_REPOSITORY must be set" >&2
  exit 1
fi

# Ensure label exists
if [[ "${REGRESSION_ISSUE_DRY_RUN:-}" != "1" ]]; then
  # Check if label exists
  if ! gh label list --repo "$REPO" --search "$LABEL" --json name --jq '.[] | select(.name == "'"$LABEL"'")' | grep -q .; then
    gh label create "$LABEL" --repo "$REPO" --description "E2E regression detected in weekly CI run" --color "d73a4a" || true
  fi
fi

MARKER="<!-- crucible-tests:e2e-regression:$APP -->"

# Find existing issue by marker
EXISTING_ISSUE=$(gh issue list --repo "$REPO" --label "$LABEL" --state open --json number,body --jq ".[] | select(.body | contains(\"$MARKER\")) | .number" | head -n 1 || true)
EXISTING_ISSUE="${EXISTING_ISSUE// /}"  # Trim whitespace

# Determine action
if [[ "$BODY_ARG" == "--recovered" ]]; then
  # Recovered
  if [[ -z "$BODY_FILE_ARG" ]]; then
    echo "Error: --recovered requires a body file path" >&2
    exit 1
  fi

  if [[ ! -f "$BODY_FILE_ARG" ]]; then
    echo "Error: Body file not found: $BODY_FILE_ARG" >&2
    exit 1
  fi

  if [[ -n "$EXISTING_ISSUE" ]]; then
    ACTION="recover"
    BODY_FILE="$BODY_FILE_ARG"
  else
    ACTION="none"
  fi
else
  # Read body from file
  if [[ ! -f "$BODY_ARG" ]]; then
    echo "Error: Body file not found: $BODY_ARG" >&2
    exit 1
  fi

  BODY_CONTENT=$(cat "$BODY_ARG")

  if [[ -z "$BODY_CONTENT" ]]; then
    echo "Error: Body file is empty" >&2
    exit 1
  fi

  BODY_FILE="$BODY_ARG"

  if [[ -n "$EXISTING_ISSUE" ]]; then
    ACTION="recurrence"
  else
    ACTION="create"
  fi
fi

# Execute or dry-run
if [[ "${REGRESSION_ISSUE_DRY_RUN:-}" == "1" ]]; then
  case "$ACTION" in
    create)
      echo "DRY-RUN: Would create issue with label $LABEL for $APP"
      ;;
    recurrence)
      echo "DRY-RUN: Would add recurrence comment to issue #$EXISTING_ISSUE"
      ;;
    recover)
      echo "DRY-RUN: Would add recovered comment and close issue #$EXISTING_ISSUE"
      ;;
    none)
      echo "DRY-RUN: No action needed"
      ;;
  esac
else
  case "$ACTION" in
    create)
      # Parse title and issue body from JSON
      TITLE=$(jq -r '.title' < "$BODY_FILE")
      BODY=$(jq -r '.issueBody' < "$BODY_FILE")

      # Create issue
      echo "$BODY" | gh issue create --repo "$REPO" --title "$TITLE" --label "$LABEL" --body-file - > /dev/null
      echo "Created regression issue for $APP"
      ;;
    recurrence)
      # Parse recurrence body from JSON
      BODY=$(jq -r '.recurrenceBody' < "$BODY_FILE")

      # Add comment
      echo "$BODY" | gh issue comment "$EXISTING_ISSUE" --repo "$REPO" --body-file - > /dev/null
      echo "Added recurrence comment to issue #$EXISTING_ISSUE"
      ;;
    recover)
      # Add recovered comment and close
      RECOVERED_COMMENT=$(cat "$BODY_FILE")
      echo "$RECOVERED_COMMENT" | gh issue comment "$EXISTING_ISSUE" --repo "$REPO" --body-file - > /dev/null
      gh issue close "$EXISTING_ISSUE" --repo "$REPO" > /dev/null
      echo "Closed issue #$EXISTING_ISSUE as recovered"
      ;;
    none)
      echo "No action needed for $APP"
      ;;
  esac
fi
