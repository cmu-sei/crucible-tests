// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Page } from '@playwright/test';

/**
 * Themes every Console functional spec is parameterized over. Each spec runs once
 * per entry so every screen is exercised in both light and dark mode.
 */
export const CONSOLE_THEMES = ['light', 'dark'] as const;
export type ConsoleTheme = (typeof CONSOLE_THEMES)[number];

/** True when the Console UI is currently rendering in dark mode. */
export async function consoleIsDarkTheme(page: Page): Promise<boolean> {
  return page.evaluate(() => document.body.classList.contains('darkMode'));
}

/**
 * Put the Console UI into the requested theme via the options-bar gear menu's
 * "Dark Theme" switch, then wait until <body> reflects the change.
 *
 * Console persists the selected theme through @cmusei/crucible-common's auth store
 * (localStorage key 'akita-console-ui'), so a theme set here survives the
 * client-side navigations a test performs afterward — it only needs applying
 * once, right after authentication. A fresh browser context defaults to light,
 * so requesting 'light' is a no-op.
 *
 * Mirrors alloy's applyAlloyTheme: we drive the real UI control (not the
 * `?theme=` query param, which only applies on a fresh app bootstrap) and
 * confirm the switch took effect via the body class with a MutationObserver
 * rather than a fixed wait.
 */
export async function applyConsoleTheme(page: Page, theme: ConsoleTheme): Promise<void> {
  const wantDark = theme === 'dark';
  if ((await consoleIsDarkTheme(page)) === wantDark) {
    return;
  }

  // The Console UI's theme toggle is in the options-bar gear menu. The gear
  // icon is an SVG mat-icon-button, not always labelled — we locate it by the
  // gear svgIcon attribute.
  const gearButton = page.locator('button[mat-icon-button]').filter({ has: page.locator('mat-icon[svgicon="gear"]') });
  await gearButton.click();

  const toggle = page.getByRole('switch', { name: 'Dark Theme' });
  await toggle.waitFor({ state: 'visible', timeout: 10000 });
  await toggle.click();
  await page.keyboard.press('Escape');

  // Wait for the gear menu overlay to fully tear down before returning. A test
  // that opens the menu next would otherwise race a lingering CDK backdrop that
  // silently intercepts its clicks.
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
          reject(new Error(`Console theme did not become ${expected ? 'dark' : 'light'}`));
        }, 10000);
      }),
    wantDark
  );
}
