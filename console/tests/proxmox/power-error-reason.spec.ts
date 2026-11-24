// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: console/console-test-plan.md
// seed: seed.spec.ts

import { test, expect, CONSOLE_THEMES, gotoProxmoxConsole, openConsoleMenu } from '../../fixtures';
import { requireProxmoxConsoleVm, ProxmoxConsoleVm } from '../../../playerVm/vm-helpers';

/**
 * A refused power operation shows the API's reason, not Angular's "Http failure
 * response for ...", and shows it once.
 *
 * Power On is the one power item that is safe to drive against a running VM:
 * Proxmox refuses it ("VM <vmid> already running") without touching the
 * machine, and it has no confirmation dialog. The VM API already names the
 * operation in that reason ("Power On failed: ..."), so the console must not add
 * its own "Power On failed: " in front of it a second time.
 */

// These drive a real VM's console, so one browser project is enough.
test.skip(({ browserName }) => browserName !== 'chromium', 'live-VM test; runs on one project only');

for (const theme of CONSOLE_THEMES) {
  test.describe(`${theme} theme › Proxmox Console Power Errors`, () => {
    let vm: ProxmoxConsoleVm;

    test.beforeEach(async ({ consoleAuthenticatedPage: page }) => {
      // Requires the VM to be running, which is what makes Power On a refusal.
      vm = await requireProxmoxConsoleVm();
      await gotoProxmoxConsole(page, vm.record.id, theme);
    });

    test("Power On on a running VM shows Proxmox's reason once", async ({
      consoleAuthenticatedPage: page,
    }) => {
      // 1. Power › Power On, paired with the API call it makes.
      const power = await openConsoleMenu(page, 'Power');
      const response = page.waitForResponse(
        (r) => r.request().method() === 'POST' && /\/actions\/power-on$/.test(new URL(r.url()).pathname)
      );
      await power.getByRole('menuitem', { name: 'Power On', exact: true }).click();
      expect((await response).status()).toBe(400);

      // 2. The snackbar carries the reason exactly as the API phrased it: one
      //    "Power On failed:" prefix, then Proxmox's own words.
      const label = page.locator('mat-snack-bar-container .mdc-snackbar__label');
      await expect(label).toHaveText(`Power On failed: VM ${vm.target.id} already running`);
      await expect(label).not.toContainText('Http failure response');
      await expect(page.locator('mat-snack-bar-container').getByRole('button', { name: 'Close' })).toBeVisible();
    });
  });
}
