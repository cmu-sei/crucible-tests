// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: console/console-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  CONSOLE_THEMES,
  closeConsoleMenus,
  expectGatedControl,
  gotoProxmoxConsole,
  openConsoleMenu,
} from '../../fixtures';
import { requireProxmoxConsoleVm, ProxmoxConsoleVm } from '../../../playerVm/vm-helpers';

/**
 * Console options › Resolution on the Proxmox console: Scale to Fit, the
 * default, or Match Window Size, which asks the guest to take the window's
 * size.
 *
 * Whether the guest can take it depends on the VM's display adapter: QEMU
 * passes a resize request only to virtio-gpu (`vga: virtio` or `virtio-gl`).
 * The VM API reports that as `canResizeDisplay`, and the console offers Match
 * Window Size only where it is true; elsewhere the item is disabled with the
 * reason. When it is offered, the spec chooses it and then puts the console
 * back on Scale to Fit (the mode is held by the page only). The guest keeps
 * the window's resolution, which is the feature working rather than state the
 * spec seeded.
 */

// These drive a real VM's console, so one browser project is enough.
test.skip(({ browserName }) => browserName !== 'chromium', 'live-VM test; runs on one project only');

/** The check mark the Resolution menu puts in front of the active mode. */
const CHECK = '✔';
const RESIZE_UNSUPPORTED_TOOLTIP = "This VM's display adapter can't change resolution from the console";

for (const theme of CONSOLE_THEMES) {
  test.describe(`${theme} theme › Proxmox Console Resolution`, () => {
    let vm: ProxmoxConsoleVm;

    test.beforeEach(async ({ consoleAuthenticatedPage: page }) => {
      vm = await requireProxmoxConsoleVm();
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

    test("Match Window Size is offered only where the VM's display can resize", async ({
      consoleAuthenticatedPage: page,
    }) => {
      // Recorded so the report shows which branch this VM took.
      test.info().annotations.push({
        type: 'canResizeDisplay',
        description: String(vm.state.canResizeDisplay),
      });

      // 1. Match Window Size follows canResizeDisplay, with the adapter as the
      //    reason when it is disabled.
      let resolution = await openConsoleMenu(page, 'Resolution');
      const match = resolution.getByRole('menuitem', { name: /Match Window Size/ });
      await expectGatedControl(page, match, vm.state.canResizeDisplay, RESIZE_UNSUPPORTED_TOOLTIP);
      if (!vm.state.canResizeDisplay) {
        await closeConsoleMenus(page);
        return;
      }

      // 2. Choosing it checks it, and the console stays on it.
      await match.click();
      await expect(page.getByRole('menu')).toHaveCount(0);
      resolution = await openConsoleMenu(page, 'Resolution');
      const items = resolution.getByRole('menuitem');
      await expect(items.nth(0)).toHaveText('Scale to Fit');
      await expect(items.nth(1)).toHaveText(`${CHECK} Match Window Size`);

      // 3. Put the console back on Scale to Fit.
      await items.nth(0).click();
      await expect(page.getByRole('menu')).toHaveCount(0);
      resolution = await openConsoleMenu(page, 'Resolution');
      await expect(resolution.getByRole('menuitem').nth(0)).toHaveText(`${CHECK} Scale to Fit`);
      await closeConsoleMenus(page);
    });
  });
}
