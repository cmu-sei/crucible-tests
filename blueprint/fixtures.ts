// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, expect, Locator, Page } from '@playwright/test';
import fs from 'fs';
import {
  Services,
  serviceUrlPattern,
  oidcStorageKey,
  authenticateWithKeycloak,
  waitForFirstVisible,
} from '../shared-fixtures';
import { authSessionStatePath, authStatePath } from '../auth-paths';

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

/**
 * Path to the Blueprint storageState saved by global-setup.ts. May not exist if the
 * global setup failed to provision (stack down at startup) — handled below.
 */
const blueprintStatePath = authStatePath('blueprint');
const blueprintStateExists = fs.existsSync(blueprintStatePath);
const blueprintSessionStatePath = authSessionStatePath('blueprint');
const blueprintSessionState: Array<[string, string]> = fs.existsSync(blueprintSessionStatePath)
  ? JSON.parse(fs.readFileSync(blueprintSessionStatePath, 'utf8'))
  : [];

/**
 * Extended test with Blueprint-specific fixtures.
 *
 * `storageState` defaults to the pre-authenticated state captured once by
 * global-setup.ts, so every spec's browser context starts with a valid OIDC token.
 * The `blueprintAuthenticatedPage` fixture then just navigates and waits for the
 * Angular shell — no per-test Keycloak round-trip. Auth-flow specs opt out with
 * `test.use({ storageState: { cookies: [], origins: [] } })`.
 */
export const test = base.extend<BlueprintFixtures>({
  // Reuse the authenticated state captured by global-setup. Authentication specs
  // opt out with an empty storageState and retain the interactive login flow.
  storageState: blueprintStateExists ? blueprintStatePath : undefined,

  blueprintAuthenticatedPage: async ({ page, storageState }, use) => {
    // Restore sessionStorage if it was captured during global-setup. The OIDC client
    // may store its token in sessionStorage (like Player) or localStorage (captured
    // by storageState), so we restore both to handle either case.
    if (storageState === blueprintStatePath && blueprintSessionState.length > 0) {
      await page.addInitScript((entries: Array<[string, string]>) => {
        for (const [key, value] of entries) {
          sessionStorage.setItem(key, value);
        }
      }, blueprintSessionState);
    }

    // Fast path: storageState already carries a valid token, so navigating home
    // should render the authenticated shell without redirecting to Keycloak.
    await page.goto(Services.Blueprint.UI, { waitUntil: 'domcontentloaded' });

    const appShell = page.locator('app-root mat-toolbar').first();
    const keycloakField = page.locator('input[name="username"]');

    // Race the authenticated shell against a Keycloak login form. The form appears
    // only if the saved state is missing/expired — in that case fall back to the
    // full interactive login so the test still proceeds (just not as fast).
    const winner = await waitForFirstVisible(
      page,
      [
        { key: 'shell', locator: appShell },
        { key: 'keycloak', locator: keycloakField },
      ],
      { timeout: 20000 }
    );

    if (winner !== 'shell') {
      // Either Keycloak appeared or neither did within the window — do a full login.
      await authenticateBlueprintWithKeycloak(page);
      await appShell.waitFor({ state: 'visible', timeout: 30000 });
    }

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
 * Put the Blueprint UI into the requested theme via the top-bar "Admin User" menu's
 * "Dark Theme" switch, then wait until <body> reflects the change.
 *
 * Blueprint persists the selected theme through localStorage key 'uiState' (JSON with
 * selectedTheme: "dark-theme" or "light-theme"), so a theme set here survives the
 * client-side navigations a test performs afterward — it only needs applying once,
 * right after authentication. A fresh browser context defaults to light, so requesting
 * 'light' is a no-op.
 *
 * Mirrors alloyIsDarkTheme/applyAlloyTheme: we drive the real UI control (not the
 * `?theme=` query param, which only applies on a fresh app bootstrap) and confirm
 * the switch took effect via the body class with a MutationObserver rather than a
 * fixed wait.
 */
export async function applyBlueprintTheme(page: Page, theme: BlueprintTheme): Promise<void> {
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
