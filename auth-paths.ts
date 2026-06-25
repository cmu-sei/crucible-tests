// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import path from 'path';

/**
 * Single source of truth for the per-app authentication state files written by
 * `global-setup.ts` and consumed by each app's `fixtures.ts`.
 *
 * The global setup authenticates each provisioned app once and saves its browser
 * `storageState` (cookies + localStorage, including the OIDC token) to
 * `.auth/<app>.json`. Per-test browser contexts load that file so Angular finds a
 * valid token on startup and skips the full Keycloak redirect dance.
 *
 * `.auth/` is gitignored — these files are regenerated on every run.
 *
 * Keep this as the only place that knows the path layout so the setup and the
 * fixtures can never drift apart.
 */
export function authStatePath(app: string): string {
  return path.resolve(__dirname, '.auth', `${app}.json`);
}
