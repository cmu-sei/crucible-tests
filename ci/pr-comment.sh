#!/usr/bin/env bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

# Upsert sticky PR comment for nowPassing tests.
#
# Usage:
#   pr-comment.sh <pr-number> <body-file>
#   pr-comment.sh <pr-number> --resolve <resolved-body-file>
#
# With a body file, creates the comment or updates the existing one. An empty body
# file means nothing is now passing, and the comment is left as it is.
# With --resolve, updates the existing comment to the given resolved body (rendered by
# `scripts/render-pr-comment.mjs --resolved`), or does nothing if no comment exists.
#
# A failed comment lookup fails the script: guessing "no comment" would post a duplicate.
#
# Environment:
#   GH_TOKEN or GITHUB_TOKEN: GitHub token with pull-requests: write
#   GH_REPO or GITHUB_REPOSITORY: owner/repo
#   PR_COMMENT_DRY_RUN: if set to 1, print action instead of executing

set -euo pipefail

MARKER='<!-- crucible-tests:e2e-now-passing -->'

usage() {
  echo "Usage: pr-comment.sh <pr-number> <body-file> | pr-comment.sh <pr-number> --resolve <body-file>" >&2
  exit 1
}

PR_NUMBER="${1:-}"
MODE="upsert"
if [[ $# -eq 2 ]]; then
  BODY_FILE="$2"
elif [[ $# -eq 3 && "$2" == "--resolve" ]]; then
  MODE="resolve"
  BODY_FILE="$3"
else
  usage
fi

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

if [[ ! -f "$BODY_FILE" ]]; then
  echo "Error: Body file not found: $BODY_FILE" >&2
  exit 1
fi
BODY_CONTENT=$(cat "$BODY_FILE")

# Find the existing comment by marker. --paginate runs the --jq filter once per page,
# so each page yields at most one id; keep the first line. A failed gh call aborts here.
EXISTING_ID=$(gh api "repos/$REPO/issues/$PR_NUMBER/comments" --paginate \
  --jq "[.[] | select(.body | contains(\"$MARKER\")) | .id] | first // empty")
EXISTING_ID="${EXISTING_ID%%$'\n'*}"

# Determine action
if [[ "$MODE" == "resolve" ]]; then
  if [[ -z "$BODY_CONTENT" ]]; then
    echo "Error: Resolved body file is empty" >&2
    exit 1
  fi
  if [[ -n "$EXISTING_ID" ]]; then
    ACTION="resolve"
  else
    ACTION="none"
  fi
elif [[ -z "$BODY_CONTENT" ]]; then
  ACTION="none"
elif [[ -n "$EXISTING_ID" ]]; then
  ACTION="update"
else
  ACTION="create"
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
      gh api -X POST "repos/$REPO/issues/$PR_NUMBER/comments" -F body=@"$BODY_FILE" > /dev/null
      echo "Created PR comment"
      ;;
    update|resolve)
      gh api -X PATCH "repos/$REPO/issues/comments/$EXISTING_ID" -F body=@"$BODY_FILE" > /dev/null
      echo "Updated PR comment"
      ;;
    none)
      echo "No action needed"
      ;;
  esac
fi
