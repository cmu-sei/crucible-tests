// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Page } from '@playwright/test';
import { Services } from './shared-fixtures';

/**
 * One app to provision authenticated browser state for. `appShellSelector` is a
 * DOM signal that only renders once the Angular app has bootstrapped AND the OIDC
 * client has resolved a user — i.e. "authenticated and ready", not merely "page
 * exists". Waiting on it (rather than a fixed delay) means setup is as fast as the
 * app allows and never saves state before the token is in place.
 */
export interface ProvisionTarget {
  app: string;
  homeUrl: string;
  appShellSelector: string;
  /** App-specific login, called instead of `authenticateWithKeycloak(page, homeUrl)`. */
  authenticate?: (page: Page) => Promise<void>;
  /** Other apps whose tests call this app's API with its token, so need it provisioned too. */
  neededBy?: string[];
}

/**
 * Apps to pre-authenticate. Each entry gets its token captured once here and
 * reused by every test in that app's suite via `storageState`.
 *
 * EXTENSION POINT: other apps should adopt this by (a) adding an entry here and
 * (b) setting their fixture's `storageState` to `freshAuthStatePath('<app>', browser)`
 * and checking the shell with `ensureAuthenticatedShell`, as cite/fixtures.ts does.
 *
 * Built on first call rather than at module load: shared-fixtures.ts imports
 * auth-state.ts, which imports this module, so `Services` (from shared-fixtures) is
 * not yet initialised while this module first loads.
 */
let cached: ProvisionTarget[] | null = null;
export function provisionTargets(): ProvisionTarget[] {
  cached ??= [
  {
    app: 'caster',
    homeUrl: Services.Caster.UI,
    appShellSelector: 'app-root',
    // Blueprint's Caster integration tests seed Caster templates with this token.
    neededBy: ['blueprint'],
  },
  {
    app: 'player',
    homeUrl: Services.Player.UI,
    // The Menu control renders only once Player has resolved the OIDC user.
    appShellSelector: 'app-root button[aria-label="Menu"]',
    // playerVm and console authenticate via Player (Player VM UI and Console UI have
    // no landing pages of their own), so they need Player's saved state too.
    neededBy: ['playerVm', 'console'],
  },
  {
    app: 'cite',
    homeUrl: Services.Cite.UI,
    // mat-toolbar renders only after the OIDC client resolves a user, so it is a
    // reliable "authenticated shell is up" marker for CITE.
    appShellSelector: 'app-root mat-toolbar',
  },
  {
    app: 'gallery',
    homeUrl: Services.Gallery.UI,
    // The topbar's `.options-text` block is guarded by `@if (currentUser$ | async)`,
    // so it renders only once the OIDC client has resolved a user. The surrounding
    // mat-toolbar renders before that and would snapshot state without a token.
    appShellSelector: 'app-topbar .options-text button',
  },
  {
    app: 'steamfitter',
    homeUrl: Services.Steamfitter.UI,
    // app-topbar's mat-toolbar renders only after the OIDC client resolves a user,
    // so it is a reliable "authenticated shell is up" marker for Steamfitter.
    appShellSelector: 'app-root app-topbar mat-toolbar',
  },
  {
    app: 'blueprint',
    homeUrl: Services.Blueprint.UI,
    // mat-toolbar renders only after the OIDC client resolves a user, so it is a
    // reliable "authenticated shell is up" marker for Blueprint.
    appShellSelector: 'app-root mat-toolbar',
  },
  {
    app: 'topomojo',
    homeUrl: Services.TopoMojo.UI,
    // Loaded on use: the app fixtures import shared-fixtures, which (via auth-state)
    // imports this module, so a static import would be a cycle.
    authenticate: page =>
      import('./topomojo/fixtures').then(m => m.authenticateTopoMojoWithKeycloak(page)),
    // The navbar's Logout link replaces the landing page's login button only once
    // TopoMojo has resolved the OIDC user.
    appShellSelector: 'nav.navbar a:has-text("Logout")',
  },
  {
    app: 'gameboard',
    // The home page is public, so /admin is what forces the login flow.
    homeUrl: Services.Gameboard.UI + '/admin',
    authenticate: page =>
      import('./gameboard/fixtures').then(m => m.authenticateGameboardWithKeycloak(page)),
    // "Log out" replaces the Login button only once Gameboard has resolved the OIDC user.
    appShellSelector: 'a:has-text("Log out"), button:has-text("Log out")',
  },
  {
    app: 'alloy',
    homeUrl: Services.Alloy.UI,
    // The user-menu button (alloyUserMenuButton in alloy/test-helpers.ts) shows the
    // signed-in user's name, so it renders only once the OIDC user is resolved.
    appShellSelector: '.user-text button',
  },
  ];
  return cached;
}

/** The provisioning entry for `app`, used by auth-state.ts to re-authenticate it. */
export function provisionTarget(app: string): ProvisionTarget | undefined {
  return provisionTargets().find(target => target.app === app);
}
