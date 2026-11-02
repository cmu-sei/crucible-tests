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
import { requireProxmoxConsoleVm, ProxmoxConsoleVm } from '../../../playerVm/vm-helpers';

/**
 * Console options › Read Only on the Proxmox console, which it now has as the
 * vSphere console does. A read-only console still shows the screen and can
 * still scale it, but offers nothing that changes the VM: no power, snapshot,
 * file, keyboard or clipboard controls, and no Match Window Size, which would
 * resize the guest under whoever is driving it.
 *
 * Read Only is a `?readOnly=` query parameter on the page, not a setting on the
 * VM, so turning it on and off again leaves nothing behind.
 */

// These drive a real VM's console, so one browser project is enough.
test.skip(({ browserName }) => browserName !== 'chromium', 'live-VM test; runs on one project only');

/** Main-menu items that change the VM, which a read-only console leaves out. */
const WRITE_ITEMS = ['Power', 'Snapshots', 'Files', 'Keyboard', 'Clipboard'];
const RESIZE_READ_ONLY_TOOLTIP = "A read-only console can't change this VM's resolution";
const RESIZE_UNSUPPORTED_TOOLTIP = "This VM's display adapter can't change resolution from the console";

for (const theme of CONSOLE_THEMES) {
  test.describe(`${theme} theme › Proxmox Console Read Only`, () => {
    let vm: ProxmoxConsoleVm;

    test.beforeEach(async ({ consoleAuthenticatedPage: page }) => {
      vm = await requireProxmoxConsoleVm();
      await gotoProxmoxConsole(page, vm.record.id, theme);
    });

    test('Read Only hides the controls that change the VM', async ({ consoleAuthenticatedPage: page }) => {
      const bar = page.locator('app-options-bar2');

      // 1. Turn Read Only on from the main menu.
      let menu = await openConsoleMenu(page);
      await menu.getByRole('switch', { name: 'Read Only' }).click();
      await expect(page).toHaveURL(/[?&]readOnly=true/);
      await closeConsoleMenus(page);

      // 2. The bar says so, and the toolbar's Copy / Paste / Ctrl-Alt-Del are gone.
      await expect(bar.getByText(`${vm.record.name} (Read Only)`, { exact: true })).toBeVisible();
      for (const name of ['Copy', 'Paste', 'Ctrl-Alt-Del']) {
        await expect(bar.getByRole('button', { name, exact: true }), name).toHaveCount(0);
      }

      // 3. The main menu keeps the viewing controls and drops the ones that act on
      //    the VM. The Read Only switch stays, checked, so it can be turned off.
      menu = await openConsoleMenu(page);
      for (const name of ['Fullscreen', 'Reconnect', 'Resolution']) {
        await expect(menu.getByRole('menuitem', { name, exact: true }), name).toBeVisible();
      }
      for (const name of WRITE_ITEMS) {
        await expect(menu.getByRole('menuitem', { name, exact: true }), name).toHaveCount(0);
      }
      await expect(menu.getByRole('switch', { name: 'Read Only' })).toBeChecked();
      await closeConsoleMenus(page);

      // 4. Resolution still scales, but Match Window Size is disabled. Its reason
      //    is the read-only one, unless noVNC has not (yet) seen the server accept
      //    resize requests, in which case the adapter reason takes precedence.
      const resolution = await openConsoleMenu(page, 'Resolution');
      const match = resolution.getByRole('menuitem', { name: /Match Window Size/ });
      await expect(resolution.getByRole('menuitem', { name: /Scale to Fit/ })).toBeEnabled();
      await expect(match).toBeDisabled();
      await match.locator('..').hover();
      await expect(page.locator('.mat-mdc-tooltip').last()).toHaveText(
        new RegExp(`^(${RESIZE_READ_ONLY_TOOLTIP}|${RESIZE_UNSUPPORTED_TOOLTIP})$`)
      );
      await closeConsoleMenus(page);

      // 5. Turning Read Only off brings the controls back.
      menu = await openConsoleMenu(page);
      await menu.getByRole('switch', { name: 'Read Only' }).click();
      await expect(page).toHaveURL(/[?&]readOnly=false/);
      await closeConsoleMenus(page);
      await expect(bar.getByRole('button', { name: 'Paste', exact: true })).toBeVisible();
      menu = await openConsoleMenu(page);
      for (const name of WRITE_ITEMS) {
        await expect(menu.getByRole('menuitem', { name, exact: true }), name).toBeVisible();
      }
      await closeConsoleMenus(page);
    });
  });
}
