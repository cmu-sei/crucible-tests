#!/bin/bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

# Publishes this directory as the module catalog Caster's dev module source serves,
# so the Designer and file-editor specs have modules to add and insert.
#
# Caster can only learn about a module from a git module source (POST /api/modules
# cannot create one), and the dev stack's only source is the Gitea repository
# crucible/crucible-terraform-modules, which the AppHost starts with Launch__Gitea=true.
#
# This force-pushes `main` and the tags v1.0.0 and v1.1.0 over that repository. If
# you also mirror the real module catalog into it (gitea-seed does, when
# /mnt/data/crucible/crucible-terraform-modules is cloned), whichever ran last wins:
# re-run gitea-seed to get the real catalog back, and this script to get the test one.
#
# Caster picks the new tags up on its next module listing; no restart needed.

set -euo pipefail

GITEA_URL="${GITEA_URL:-http://localhost:3010}"
GITEA_USER="${GITEA_USER:-crucible-admin}"
GITEA_PASSWORD="${GITEA_PASSWORD:-admin}"
GITEA_ORG="${GITEA_ORG:-crucible}"
CATALOG_REPO="${CATALOG_REPO:-crucible-terraform-modules}"

CATALOG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf -- "$WORK_DIR"' EXIT

api() {
  # Prints the status code; 409/422 mean the org or repo already exists.
  curl -s -o /dev/null -w '%{http_code}' -u "$GITEA_USER:$GITEA_PASSWORD" \
    -H 'Content-Type: application/json' -X POST "$GITEA_URL/api/v1/$1" -d "$2"
}

echo "Create org $GITEA_ORG: $(api orgs "{\"username\":\"$GITEA_ORG\",\"visibility\":\"public\"}")"
echo "Create repo $GITEA_ORG/$CATALOG_REPO: $(api "orgs/$GITEA_ORG/repos" "{\"name\":\"$CATALOG_REPO\",\"private\":false}")"

# Every immediate subdirectory is a module (Caster's Subdirectories layout).
for module in "$CATALOG_DIR"/*/; do
  cp -r "$module" "$WORK_DIR/"
done

git_c() {
  git -C "$WORK_DIR" -c user.name=crucible-tests -c user.email=crucible-tests@crucible.local "$@"
}

# Two tags of the same content, so the specs can check that the newest is preselected.
git_c init -q -b main
git_c add -A
git_c commit -q -m "crucible-tests module catalog"
git_c tag v1.0.0
git_c commit -q --allow-empty -m "crucible-tests module catalog v1.1.0"
git_c tag v1.1.0

# credential.helper= stops the VS Code helper from prompting.
git_c -c credential.helper= push -q --force \
  "http://$GITEA_USER:$GITEA_PASSWORD@${GITEA_URL#http://}/$GITEA_ORG/$CATALOG_REPO.git" \
  'refs/heads/main:refs/heads/main' 'refs/tags/v1.0.0:refs/tags/v1.0.0' 'refs/tags/v1.1.0:refs/tags/v1.1.0'

echo "Published the crucible-tests module catalog to $GITEA_URL/$GITEA_ORG/$CATALOG_REPO"
