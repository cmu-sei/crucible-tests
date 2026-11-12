// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: console/console-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  CONSOLE_THEMES,
  closeConsoleMenus,
  gotoProxmoxConsole,
  openConsoleMenu,
} from '../../fixtures';
import { waitForFirstVisible } from '../../../shared-fixtures';
import { requireProxmoxConsoleVm } from '../../../playerVm/vm-helpers';

/**
 * Console options › Resolution on the Proxmox console: Scale to Fit, the
 * default, or Match Window Size, which asks the guest to take the window's
 * size.
 *
 * Whether the guest can take it is the VM's display adapter's call (virtio-gpu
 * with a driver can; the default std VGA accepts the request and keeps its
 * resolution), and the API does not report the adapter. So Match Window Size is
 * asserted on whichever way the guest answers: when it doesn't change size
 * within the console's 3-second check, the console must fall back to Scale to
 * Fit, say so, and disable Match Window Size with the reason. When the guest
 * does resize, the spec puts the console back on Scale to Fit (the mode is held
 * by the page only); the guest keeps the window's resolution, which is the
 * feature working rather than state the spec seeded.
 */

// These drive a real VM's console, so one browser project is enough.
test.skip(({ browserName }) => browserName !== 'chromium', 'live-VM test; runs on one project only');

/** The check mark the Resolution menu puts in front of the active mode. */
const CHECK = '✔';
const RESIZE_FALLBACK_MESSAGE =
  "This VM didn't change resolution, so the console is scaling to fit instead.";
const RESIZE_UNSUPPORTED_TOOLTIP = "This VM's display adapter can't change resolution from the console";

for (const theme of CONSOLE_THEMES) {
  test.describe(`${theme} theme › Proxmox Console Resolution`, () => {
    test.beforeEach(async ({ consoleAuthenticatedPage: page }) => {
      const vm = await requireProxmoxConsoleVm();
      await gotoProxmoxConsole(page, vm.record.id, theme);
    });

    test('Resolution starts on Scale to Fit', async ({ consoleAuthenticatedPage: page }) => {
      const resolution = await openConsoleMenu(page, 'Resolution');
      const items = resolution.getByRole('menuitem');
      await expect(items).toHaveCount(2);
      await expect(items.nth(0)).toHaveText(`${CHECK} Scale to Fit`);
      await expect(items.nth(1)).toHaveText('Match Window Size');
      await closeConsoleMenus(page);
    });

    test('Match Window Size falls back to Scale to Fit, and says so, when the guest keeps its size', async ({
      consoleAuthenticatedPage: page,
    }) => {
      // 1. Choose Match Window Size. On a fresh console noVNC has reported that
      //    the server takes resize requests, so the item is enabled.
      let resolution = await openConsoleMenu(page, 'Resolution');
      const match = resolution.getByRole('menuitem', { name: /Match Window Size/ });
      await expect(match).toBeEnabled();
      await match.click();
      await expect(page.getByRole('menu')).toHaveCount(0);

      // 2. Wait out the console's 3-second check for the fallback message. A guest
      //    that did resize gets no message, so a null here means it matched.
      const fallback = page
        .locator('mat-snack-bar-container .mdc-snackbar__label')
        .getByText(RESIZE_FALLBACK_MESSAGE, { exact: true });
      const outcome = await waitForFirstVisible(page, [{ key: 'fallback', locator: fallback }], {
        timeout: 15000,
      });

      // Recorded so the report shows which way this VM's guest answered.
      test.info().annotations.push({ type: 'guest resize', description: outcome ?? 'matched' });

      resolution = await openConsoleMenu(page, 'Resolution');
      const items = resolution.getByRole('menuitem');
      if (outcome === 'fallback') {
        // 3a. The console went back to scaling, and Match Window Size is now
        //     disabled with the reason, so it can't be chosen again to no effect.
        await expect(items.nth(0)).toHaveText(`${CHECK} Scale to Fit`);
        await expect(items.nth(1)).toHaveText('Match Window Size');
        await expect(items.nth(1)).toBeDisabled();
        await items.nth(1).locator('..').hover();
        await expect(page.locator('.mat-mdc-tooltip').last()).toHaveText(RESIZE_UNSUPPORTED_TOOLTIP);
        await closeConsoleMenus(page);
      } else {
        // 3b. The guest took the window's size: Match Window Size stays checked.
        //     Put the console back on Scale to Fit.
        await expect(items.nth(1)).toHaveText(`${CHECK} Match Window Size`);
        await items.nth(0).click();
        await expect(page.getByRole('menu')).toHaveCount(0);
      }
    });
  });
}
