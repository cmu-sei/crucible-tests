// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Page } from '@playwright/test';

/**
 * Themes every PlayerVm functional spec is parameterized over. Each spec runs once
 * per entry so every screen is exercised in both light and dark mode.
 */
export const PLAYERVM_THEMES = ['light', 'dark'] as const;
export type PlayerVmTheme = (typeof PLAYERVM_THEMES)[number];

/** True when the PlayerVm UI is currently rendering in dark mode. */
export async function playerVmIsDarkTheme(page: Page): Promise<boolean> {
  return page.evaluate(() => document.body.classList.contains('darkMode'));
}

/**
 * Put the PlayerVm UI into the requested theme via the top-bar menu's "Dark Theme"
 * switch, then wait until <body> reflects the change.
 *
 * PlayerVm uses the crucible-common header bar and persists the selected theme
 * through @cmusei/crucible-common's auth store (localStorage), so a theme set here
 * survives the client-side navigations a test performs afterward — it only needs
 * applying once, right after authentication. A fresh browser context defaults to
 * light, so requesting 'light' is a no-op.
 *
 * PlayerVm authenticates via Player (Keycloak SSO), and the header bar button
 * label may be either "Menu" (like Player) or "Admin User" (like other apps).
 * This helper tries both to be robust across configuration changes.
 */
export async function applyPlayerVmTheme(page: Page, theme: PlayerVmTheme): Promise<void> {
  const wantDark = theme === 'dark';
  if ((await playerVmIsDarkTheme(page)) === wantDark) {
    return;
  }

  // Try to find the menu button - it could be "Menu" (Player-style) or "Admin User" (Caster-style)
  let menuButton = page.getByRole('button', { name: 'Menu' });
  if (!(await menuButton.isVisible({ timeout: 2000 }).catch(() => false))) {
    menuButton = page.getByRole('button', { name: 'Admin User' });
  }

  await menuButton.click();
  const toggle = page.getByRole('switch', { name: 'Dark Theme' });
  await toggle.waitFor({ state: 'visible', timeout: 10000 });
  await toggle.click();
  await page.keyboard.press('Escape');

  // Wait for the user-menu overlay to fully tear down before returning.
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
          reject(new Error(`PlayerVm theme did not become ${expected ? 'dark' : 'light'}`));
        }, 10000);
      }),
    wantDark
  );
}
