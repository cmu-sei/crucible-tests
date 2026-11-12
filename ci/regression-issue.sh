#!/usr/bin/env bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

# Upsert regression issue for a specific app.
#
# Usage:
#   regression-issue.sh <app> <body-file|-recovered>
#
# When body-file is '-recovered', adds a recovered comment and closes the issue, or does nothing if no issue exists.
# When body-file is a path, creates a new issue or adds a recurrence comment to the existing one.
#
# Environment:
#   GH_TOKEN or GITHUB_TOKEN: GitHub token with issues: write
#   GH_REPO or GITHUB_REPOSITORY: owner/repo
#   REGRESSION_ISSUE_DRY_RUN: if set, print action instead of executing

set -euo pipefail

LABEL='e2e-regression'

if [[ $# -ne 2 ]]; then
  echo "Usage: regression-issue.sh <app> <body-file|-recovered>" >&2
  exit 1
fi

APP="$1"
BODY_ARG="$2"

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
if [[ "$BODY_ARG" == "-recovered" ]]; then
  # Recovered
  if [[ -n "$EXISTING_ISSUE" ]]; then
    ACTION="recover"
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
      # Parse title and body from JSON
      TITLE=$(jq -r '.title' < "$BODY_ARG")
      BODY=$(jq -r '.body' < "$BODY_ARG")

      # Create issue
      echo "$BODY" | gh issue create --repo "$REPO" --title "$TITLE" --label "$LABEL" --body-file - > /dev/null
      echo "Created regression issue for $APP"
      ;;
    recurrence)
      # Parse body from JSON
      BODY=$(jq -r '.body' < "$BODY_ARG")

      # Add comment
      echo "$BODY" | gh issue comment "$EXISTING_ISSUE" --repo "$REPO" --body-file - > /dev/null
      echo "Added recurrence comment to issue #$EXISTING_ISSUE"
      ;;
    recover)
      # Add recovered comment and close
      RECOVERED_COMMENT=$(cat "$BODY_ARG")
      echo "$RECOVERED_COMMENT" | gh issue comment "$EXISTING_ISSUE" --repo "$REPO" --body-file - > /dev/null
      gh issue close "$EXISTING_ISSUE" --repo "$REPO" > /dev/null
      echo "Closed issue #$EXISTING_ISSUE as recovered"
      ;;
    none)
      echo "No action needed for $APP"
      ;;
  esac
fi
