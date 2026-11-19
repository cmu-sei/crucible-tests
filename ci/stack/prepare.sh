#!/usr/bin/env bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

# Writes everything compose.yaml mounts from ci/stack/.generated/, from a
# crucible-development checkout (the realm and the UI settings live there):
#
#   keycloak.crt, keycloak.key  self-signed, CN=localhost, SAN DNS:localhost,IP:127.0.0.1
#   ca-bundle.pem               the system CA bundle plus keycloak.crt, for the APIs
#   realm-bootstrap.json        the realm and the seed users' fixed IDs (Keycloak's own import)
#   realm.json                  crucible-realm.json (keycloak-config-cli)
#   ui/<app>.ui.json            the UI settings files
#   ui/settings.shared.json     from settings.shared.json.template
#   alloy-api.secrets.env,      client secrets the APIs need, read from crucible-realm.json
#   gameboard-api.secrets.env   so they are never copied into this repo
#
# Usage: ci/stack/prepare.sh <crucible-development-dir>

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <crucible-development-dir>" >&2
  exit 2
fi

STACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESOURCES="$1/Crucible.AppHost/resources"
REALM="$RESOURCES/crucible-realm.json"
OUT="$STACK_DIR/.generated"
SYSTEM_CA_BUNDLE="${SYSTEM_CA_BUNDLE:-/etc/ssl/certs/ca-certificates.crt}"

for required in "$REALM" "$RESOURCES/ui/settings.shared.json.template" "$SYSTEM_CA_BUNDLE"; do
  if [[ ! -f "$required" ]]; then
    echo "prepare.sh: missing $required" >&2
    exit 1
  fi
done
shopt -s nullglob
ui_settings=("$RESOURCES"/ui/settings/*.ui.json)
if [[ ${#ui_settings[@]} -eq 0 ]]; then
  echo "prepare.sh: no UI settings in $RESOURCES/ui/settings" >&2
  exit 1
fi

rm -rf "$OUT"
mkdir -p "$OUT/ui"

# Keycloak's HTTPS certificate. Self-signed and CI-only, so the key is made world-readable:
# Keycloak's container runs as uid 1000, and the runner user (uid 1001) would otherwise
# leave openssl's mode-600 key unreadable to it.
openssl req -x509 -newkey rsa:2048 -nodes -days 30 -sha256 \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
  -keyout "$OUT/keycloak.key" -out "$OUT/keycloak.crt" 2>/dev/null
cat "$SYSTEM_CA_BUNDLE" "$OUT/keycloak.crt" > "$OUT/ca-bundle.pem"

# Port of Crucible.AppHost/KeycloakRealmBootstrap.cs: Keycloak's realm import only creates
# the realm and each seed user's ID and username (keycloak-config-cli can't set user IDs;
# the apps and test data refer to the seed users by ID). Users without an ID - service
# accounts - are left out. The import only grants the roles it lists, so each user gets
# the realm's default role, which keycloak-config-cli never adds.
jq -c '.realm as $realm | {
  realm: $realm,
  enabled: true,
  users: [ (.users // [])[] | select(.id != null)
           | { id, username, realmRoles: ["default-roles-\($realm)"] } ]
}' "$REALM" > "$OUT/realm-bootstrap.json"

cp "$REALM" "$OUT/realm.json"
cp "${ui_settings[@]}" "$OUT/ui/"
cp "$RESOURCES/ui/settings.shared.json.template" "$OUT/ui/settings.shared.json"

client_secret() {
  jq -er --arg id "$1" '.clients[] | select(.clientId == $id) | .secret // empty' "$REALM" \
    || { echo "prepare.sh: no secret for client $1 in $REALM" >&2; exit 1; }
}
alloy_admin_secret="$(client_secret alloy.admin)"
topomojo_api_secret="$(client_secret topomojo.api)"
echo "ResourceOwnerAuthorization__ClientSecret=$alloy_admin_secret" > "$OUT/alloy-api.secrets.env"
echo "GameEngine__ClientSecret=$topomojo_api_secret" > "$OUT/gameboard-api.secrets.env"

# Containers run as other users (Keycloak uid 1000, nginx, the .NET app user).
find "$OUT" -type d -exec chmod 755 {} +
find "$OUT" -type f -exec chmod 644 {} +

echo "prepare.sh: wrote $OUT"
