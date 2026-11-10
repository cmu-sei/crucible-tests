// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, expect, Locator, Page } from '@playwright/test';
import {
  Services,
  serviceUrlPattern,
  oidcStorageKey,
  authenticateWithKeycloak,
  waitForFirstVisible,
  ensureAuthenticatedShell,
} from '../shared-fixtures';
import { authStatePath } from '../auth-paths';
import { freshAuthStatePath } from '../auth-state';
import { poolUsers, PoolUser } from '../user-pool';
import { createBlueprintUser, deleteBlueprintUser, getBlueprintToken, getBlueprintUser } from './test-helpers';

/**
 * Blueprint-specific authentication helper
 * @param page - Playwright Page object
 * @param username - Keycloak username (default: 'admin')
 * @param password - Keycloak password (default: 'admin')
 */
export async function authenticateBlueprintWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  await authenticateWithKeycloak(page, Services.Blueprint.UI, username, password);
}

/**
 * Open the topbar user menu and wait for its permission-gated contents to be present.
 *
 * The `Administration` entry is rendered under `@if (topbarView !== TopbarView.BLUEPRINT_ADMIN
 * && canViewAdmin)` (`topbar.component.html`), and `canViewAdmin` is assigned from the
 * subscription to `permissionDataService.load()` in `ngOnInit`. TopbarComponent is `OnPush`
 * and `canViewAdmin` is a plain property, so nothing marks the view dirty when it flips: the
 * entry does *not* appear in a panel that is already open when the permissions request lands.
 * It materialises only when the lazy `mat-menu` content is rebuilt — i.e. on the next open.
 *
 * Waiting longer inside a single open panel therefore cannot work; reopening is the only
 * reliable way to pick up late-arriving permissions, so retry the open itself. This mirrors
 * `openGalleryUserMenu` in `gallery/fixtures.ts`; Gallery's topbar has the same shape.
 *
 * @param page - Playwright Page object, on an authenticated Blueprint route
 * @param trigger - The topbar user-menu button (`button.menu-trigger`)
 * @param open - How to open the menu; defaults to clicking the trigger. Pass a keyboard
 *               action to exercise keyboard activation instead.
 */
export async function openBlueprintUserMenu(
  page: Page,
  trigger: Locator,
  open: () => Promise<void> = () => trigger.click()
): Promise<void> {
  const panel = page.locator('.mat-mdc-menu-panel');
  const adminItem = page.getByRole('menuitem', { name: 'Administration' });

  await expect(async () => {
    // Always (re)open from a closed panel so the menu content is built fresh.
    if (await panel.isVisible()) {
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
    }
    await open();
    await expect(adminItem).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30000, intervals: [250, 500, 1000, 2000] });
}

/**
 * Open a `mat-select` and choose one of its options, retrying the *open* if the panel is
 * not there.
 *
 * Clicking a `mat-select` trigger does not reliably leave the panel open. Reproduced on this
 * stack by looping "open the /build status filter -> click an option" 15 times: the run fails
 * partway through with the trigger focused (`combobox [active]`) and no `.mat-mdc-select-panel`
 * in the DOM — so the option never becomes visible, or becomes visible and then detaches
 * mid-click ("element was detached from the DOM, retrying"). Material tears the overlay down
 * with an animation and re-attaches a fresh one per open, so a click that lands during the
 * previous panel's teardown is swallowed and a locator resolved just before it goes stale.
 *
 * This is an overlay-timing quirk, not an app defect: the same click succeeds immediately
 * when reissued, which is exactly what this helper does. Ruled out first — SignalR store
 * churn (an open panel survives MSEL create/delete pushes), component re-creation, and page
 * reloads (the filter state and focus are intact in the failure snapshot).
 *
 * Selecting the same option twice is a no-op for a single-select, so the retry is safe.
 *
 * @param page - Playwright Page object
 * @param trigger - The `mat-select` trigger (e.g. `page.getByRole('combobox').nth(1)`)
 * @param option - The option to click, as a locator, so callers keep control of `exact`
 */
export async function selectMatSelectOption(
  page: Page,
  trigger: Locator,
  option: Locator
): Promise<void> {
  const panel = page.locator('.mat-mdc-select-panel');

  await expect(async () => {
    if (!(await panel.isVisible())) {
      await trigger.click();
    }
    await expect(option).toBeVisible({ timeout: 3000 });
    await option.click({ timeout: 3000 });
    // The panel closing is what confirms the selection was actually applied.
    await expect(panel).toBeHidden({ timeout: 5000 });
  }).toPass({ timeout: 30000, intervals: [250, 500, 1000, 2000] });
}

/**
 * Blueprint-specific fixtures
 */
export type BlueprintFixtures = {
  blueprintAuthenticatedPage: Page;
};

export type BlueprintWorkerFixtures = {
  /**
   * This worker's two pool users (see `user-pool.ts`), each with a Blueprint user row
   * and no role — i.e. no Blueprint system permissions.
   */
  nonAdminUsers: PoolUser[];
  /** The first of `nonAdminUsers`. */
  nonAdminUser: PoolUser;
};

/**
 * Extended test with Blueprint-specific fixtures.
 *
 * `storageState` defaults to the pre-authenticated state captured once by
 * global-setup.ts (refreshed by `freshAuthStatePath` when its token is near expiry),
 * so every spec's browser context starts with a valid OIDC token. The
 * `blueprintAuthenticatedPage` fixture then just navigates and waits for the
 * Angular shell — no per-test Keycloak round-trip. Auth-flow specs opt out with
 * `test.use({ storageState: { cookies: [], origins: [] } })`.
 */
export const test = base.extend<BlueprintFixtures, BlueprintWorkerFixtures>({
  // Reset contract for Blueprint: a test removes the units / unit memberships it added
  // the user to and deletes the MSELs it seeded (UserMselRoles cascade with the MSEL). The
  // user's Blueprint row is ensured here — the same role-less row Blueprint creates on
  // first sign-in — and deleted when the worker ends. Leased by `parallelIndex`, the
  // stable worker slot.
  nonAdminUsers: [
    async ({}, use, workerInfo) => {
      const users = poolUsers(workerInfo.parallelIndex, 2);
      const token = await getBlueprintToken();
      for (const user of users) {
        const existing = await getBlueprintUser(token, user.userId).then(
          (row) => row,
          () => null
        );
        if (!existing) await createBlueprintUser(token, { id: user.userId, name: user.displayName });
      }
      await use(users);
      const teardownToken = await getBlueprintToken();
      for (const user of users) await deleteBlueprintUser(teardownToken, user.userId);
    },
    { scope: 'worker' },
  ],
  nonAdminUser: [async ({ nonAdminUsers }, use) => use(nonAdminUsers[0]), { scope: 'worker' }],

  // `undefined` when global-setup could not provision Blueprint; the shell check
  // below then falls back to an interactive login.
  storageState: async ({ browser }, use) => use(await freshAuthStatePath('blueprint', browser)),

  blueprintAuthenticatedPage: async ({ page, storageState }, use) => {
    // The Blueprint OIDC client keeps its token in sessionStorage, which
    // storageState does not carry, so replay the saved sessionStorage too.
    await ensureAuthenticatedShell(page, {
      app: 'blueprint',
      url: Services.Blueprint.UI,
      shell: page.locator('app-root mat-toolbar').first(),
      login: authenticateBlueprintWithKeycloak,
      restoreSession: storageState === authStatePath('blueprint'),
      fromSavedState: storageState === authStatePath('blueprint'),
    });

    await use(page);
  },
});

export { expect } from '@playwright/test';
export { Services, serviceUrlPattern, oidcStorageKey, waitForFirstVisible };

/**
 * Themes every Blueprint functional spec is parameterized over. Each spec runs once
 * per entry so every screen is exercised in both light and dark mode.
 */
export const BLUEPRINT_THEMES = ['light', 'dark'] as const;
export type BlueprintTheme = (typeof BLUEPRINT_THEMES)[number];

/** True when the Blueprint UI is currently rendering in dark mode. */
export async function blueprintIsDarkTheme(page: Page): Promise<boolean> {
  return page.evaluate(() => document.body.classList.contains('darkMode'));
}

/**
 * Put the Blueprint UI into the requested theme by writing the persisted preference
 * and reloading, then wait until <body> reflects it. No menu clicks.
 *
 * Blueprint's theme lives only in the browser (no server-side user preference):
 * - `uiState` localStorage (UIDataService, `selectedTheme`) — the bootstrap source of
 *   truth: TopbarComponent's constructor calls `authService.setUserTheme(uiDataService
 *   .getTheme())`, overriding whatever the Akita store rehydrated.
 * - `akita-blueprint-ui` (Akita persistState of `auth.ui`, `main.ts`) — what AppComponent
 *   applies before the top bar renders. Akita stores the `auth.ui` slice under the store
 *   name, so the shape is `{"auth":{"theme":"dark-theme"},"$cache":{"auth":false}}`
 *   (captured from blueprint.ui after a UI toggle, crucible-common 0.8.0) — NOT
 *   `{"auth":{"ui":{...}}}`.
 * Both are merged into, not replaced. A fresh browser context defaults to light, so
 * requesting 'light' is a no-op. The `?theme=` query param would also work on bootstrap,
 * but AppComponent then writes it back onto the URL on every later theme change.
 *
 * Specs whose subject is the toggle control use `toggleBlueprintThemeViaMenu`.
 */
export async function applyBlueprintTheme(page: Page, theme: BlueprintTheme): Promise<void> {
  const wantDark = theme === 'dark';
  if ((await blueprintIsDarkTheme(page)) === wantDark) {
    return;
  }

  await page.evaluate((value) => {
    const merge = (key: string, patch: (s: Record<string, any>) => void) => {
      let state: Record<string, any> = {};
      try {
        state = JSON.parse(localStorage.getItem(key) ?? '{}') ?? {};
      } catch {
        state = {};
      }
      patch(state);
      localStorage.setItem(key, JSON.stringify(state));
    };
    merge('uiState', (s) => {
      s.selectedTheme = value;
    });
    merge('akita-blueprint-ui', (s) => {
      s.auth = { ...(s.auth ?? {}), theme: value };
    });
  }, wantDark ? 'dark-theme' : 'light-theme');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible({ timeout: 15000 });
  await expect.poll(() => blueprintIsDarkTheme(page), { timeout: 10000 }).toBe(wantDark);
}

/**
 * Put the Blueprint UI into the requested theme via the top-bar "Admin User" menu's
 * "Dark Theme" switch, then wait until <body> reflects the change. For specs whose
 * subject is the toggle control itself; everything else uses `applyBlueprintTheme`.
 * No-ops when the requested theme is already active.
 */
export async function toggleBlueprintThemeViaMenu(page: Page, theme: BlueprintTheme): Promise<void> {
  const wantDark = theme === 'dark';
  if ((await blueprintIsDarkTheme(page)) === wantDark) {
    return;
  }

  await page.getByRole('button', { name: 'Admin User' }).click();
  const toggle = page.getByRole('switch', { name: 'Dark Theme' });
  await toggle.waitFor({ state: 'visible', timeout: 10000 });
  await toggle.click();
  await page.keyboard.press('Escape');

  // Wait for the user-menu overlay to fully tear down before returning. A test
  // that opens the menu next (e.g. to reach "Administration") would otherwise
  // race a lingering CDK backdrop that silently intercepts its clicks.
  await page
    .locator('.cdk-overlay-backdrop')
    .waitFor({ state: 'detached', timeout: 5000 })
    .catch(() => {});
  await page
    .locator('.mat-mdc-menu-panel')
    .waitFor({ state: 'detached', timeout: 5000 })
    .catch(() => {});

  await page.locator('body').evaluate(
    (body, expected) =>
      new Promise<void>((resolve, reject) => {
        if (body.classList.contains('darkMode') === expected) return resolve();
        const observer = new MutationObserver(() => {
          if (body.classList.contains('darkMode') === expected) {
            observer.disconnect();
            resolve();
          }
        });
        observer.observe(body, { attributes: true, attributeFilter: ['class'] });
        setTimeout(() => {
          observer.disconnect();
          reject(new Error(`Blueprint theme did not become ${expected ? 'dark' : 'light'}`));
        }, 10000);
      }),
    wantDark
  );
}
