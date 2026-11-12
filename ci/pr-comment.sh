#!/usr/bin/env bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

# Upsert sticky PR comment for nowPassing tests.
#
# Usage:
#   pr-comment.sh <pr-number> <body-file|->
#
# When body-file is '-', updates existing comment to resolved text, or does nothing if no comment exists.
# When body-file is a path, creates or updates the comment with the file contents.
#
# Environment:
#   GH_TOKEN or GITHUB_TOKEN: GitHub token with pull-requests: write
#   GH_REPO or GITHUB_REPOSITORY: owner/repo
#   PR_COMMENT_DRY_RUN: if set, print action instead of executing

set -euo pipefail

MARKER='<!-- crucible-tests:e2e-now-passing -->'

if [[ $# -ne 2 ]]; then
  echo "Usage: pr-comment.sh <pr-number> <body-file|->" >&2
  exit 1
fi

PR_NUMBER="$1"
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

# Find existing comment by marker
EXISTING_ID=$(gh api "repos/$REPO/issues/$PR_NUMBER/comments" --paginate --jq ".[] | select(.body | contains(\"$MARKER\")) | .id" | head -n 1 || true)
EXISTING_ID="${EXISTING_ID// /}"  # Trim whitespace

# Determine action
if [[ "$BODY_ARG" == "-" ]]; then
  # Resolved text
  if [[ -n "$EXISTING_ID" ]]; then
    ACTION="update"
    BODY="$MARKER\n\nAll known failures previously reported as passing on this PR have been removed from the list, or no longer pass."
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
    # Empty body means no nowPassing items
    if [[ -n "$EXISTING_ID" ]]; then
      ACTION="resolve"
      BODY="$MARKER\n\nAll known failures previously reported as passing on this PR have been removed from the list, or no longer pass."
    else
      ACTION="none"
    fi
  else
    # Non-empty body
    if [[ -n "$EXISTING_ID" ]]; then
      ACTION="update"
      BODY="$BODY_CONTENT"
    else
      ACTION="create"
      BODY="$BODY_CONTENT"
    fi
  fi
fi

# Execute or dry-run
if [[ "${PR_COMMENT_DRY_RUN:-}" == "1" ]]; then
  case "$ACTION" in
    create)
      echo "DRY-RUN: Would create comment on PR $PR_NUMBER"
      ;;
    update)
      echo "DRY-RUN: Would update comment $EXISTING_ID on PR $PR_NUMBER"
      ;;
    resolve)
      echo "DRY-RUN: Would update comment $EXISTING_ID on PR $PR_NUMBER to resolved text"
      ;;
    none)
      echo "DRY-RUN: No action needed"
      ;;
  esac
else
  case "$ACTION" in
    create)
      echo "$BODY" | gh api -X POST "repos/$REPO/issues/$PR_NUMBER/comments" -F body=@- > /dev/null
      echo "Created PR comment"
      ;;
    update|resolve)
      echo "$BODY" | gh api -X PATCH "repos/$REPO/issues/comments/$EXISTING_ID" -F body=@- > /dev/null
      echo "Updated PR comment"
      ;;
    none)
      echo "No action needed"
      ;;
  esac
fi
