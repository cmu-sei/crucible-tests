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
 * The Proxmox console's options bar (`app-options-bar2`) against a live Proxmox
 * VM: the menus that bring it up to the vSphere console, and the items it
 * disables, with a reason, when the VM can't support them.
 *
 * The VM is the one `PROXMOX_CONSOLE_VMID`/`PROXMOX_CONSOLE_NODE` name (see
 * `proxmoxConsoleTarget`). Whether a gated item is enabled depends on that
 * machine's Proxmox config, so each gate is asserted against what
 * `GET api/vms/proxmox/{id}` reports for it rather than against a fixed
 * expectation. Nothing here changes the VM: menus are opened and closed, and the
 * Send Text dialog is cancelled.
 */

// These drive a real VM's console, so one browser project is enough.
test.skip(({ browserName }) => browserName !== 'chromium', 'live-VM test; runs on one project only');

/** The disabled-item reasons the Proxmox bar shows, verbatim from console.ui. */
const GUEST_AGENT_TOOLTIP = 'Requires the QEMU guest agent';
const VNC_CLIPBOARD_TOOLTIP =
  'Copy from the VM needs the VNC clipboard (clipboard=vnc) enabled on this VM';

for (const theme of CONSOLE_THEMES) {
  test.describe(`${theme} theme › Proxmox Console Options`, () => {
    let vm: ProxmoxConsoleVm;

    test.beforeEach(async ({ consoleAuthenticatedPage: page }) => {
      vm = await requireProxmoxConsoleVm();
      await gotoProxmoxConsole(page, vm.record.id, theme);
    });

    test('Console options lists the vSphere console controls', async ({
      consoleAuthenticatedPage: page,
    }) => {
      // 1. Every top-level item of the vSphere bar is on the Proxmox bar too.
      //    Snapshots and Files only appear for a user who may revert / upload or
      //    download / mount, which the admin user can.
      const menu = await openConsoleMenu(page);
      for (const name of [
        'Fullscreen',
        'Reconnect',
        'Resolution',
        'Power',
        'Snapshots',
        'Files',
        'Keyboard',
        'Clipboard',
      ]) {
        await expect(menu.getByRole('menuitem', { name, exact: true }), name).toBeVisible();
      }
      // Read Only and Dark Theme are switches inside their menu items.
      await expect(menu.getByRole('switch', { name: 'Read Only' })).toBeVisible();
      await expect(menu.getByRole('switch', { name: 'Dark Theme' })).toBeVisible();
      await closeConsoleMenus(page);

      // 2. The toolbar carries Copy, Paste and Ctrl-Alt-Del, as the vSphere bar
      //    does.
      const bar = page.locator('app-options-bar2');
      for (const name of ['Copy', 'Paste', 'Ctrl-Alt-Del']) {
        await expect(bar.getByRole('button', { name, exact: true }), name).toBeVisible();
      }
    });

    test('Power menu offers Shutdown OS, as the vSphere console names it', async ({
      consoleAuthenticatedPage: page,
    }) => {
      const power = await openConsoleMenu(page, 'Power');
      await expect(power.getByRole('menuitem')).toHaveText([
        'Power On',
        'Power Off',
        'Reboot',
        'Shutdown OS',
      ]);
      await closeConsoleMenus(page);
    });

    test('Keyboard menu offers Send Text, which opens the Send Text dialog', async ({
      consoleAuthenticatedPage: page,
    }) => {
      // 1. Ctrl-Alt-Del, Send Text and Paste to Clipboard.
      const keyboard = await openConsoleMenu(page, 'Keyboard');
      await expect(keyboard.getByRole('menuitem')).toHaveText([
        'Send Ctrl-Alt-Del',
        'Send Text',
        'Paste to Clipboard',
      ]);

      // 2. Send Text opens the shared Send Text dialog. It is cancelled, never
      //    sent, so nothing is typed into the guest.
      await keyboard.getByRole('menuitem', { name: 'Send Text', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Enter Text to Send' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('textbox', { name: 'Text to send' })).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(dialog).toBeHidden();
    });

    test('Files menu needs the guest agent to send or download a file', async ({
      consoleAuthenticatedPage: page,
    }) => {
      // Send File To VM and Download File From VM go through the QEMU guest
      // agent, so they are disabled, with that as the reason, when the API
      // reports none running. Mount ISO only needs Proxmox.
      const files = await openConsoleMenu(page, 'Files');
      await expectGatedControl(
        page,
        files.getByRole('menuitem', { name: 'Send File To VM', exact: true }),
        vm.state.guestAgentRunning,
        GUEST_AGENT_TOOLTIP
      );
      await expectGatedControl(
        page,
        files.getByRole('menuitem', { name: 'Download File From VM', exact: true }),
        vm.state.guestAgentRunning,
        GUEST_AGENT_TOOLTIP
      );
      const mountIso = files.getByRole('menuitem', { name: 'Mount ISO', exact: true });
      await expect(mountIso).toBeVisible();
      await expect(mountIso).toBeEnabled();
      await closeConsoleMenus(page);
    });

    test("Copy needs the VM's VNC clipboard", async ({ consoleAuthenticatedPage: page }) => {
      // QEMU only passes the guest clipboard out over VNC when the VM's `vga`
      // config sets clipboard=vnc, which the API reports as vncClipboardEnabled.
      // Copy is gated on it in both places it appears; Paste never is.

      // 1. The toolbar's Copy and Paste.
      const bar = page.locator('app-options-bar2');
      await expectGatedControl(
        page,
        bar.getByRole('button', { name: 'Copy', exact: true }),
        vm.state.vncClipboardEnabled,
        VNC_CLIPBOARD_TOOLTIP
      );
      await expect(bar.getByRole('button', { name: 'Paste', exact: true })).toBeEnabled();

      // 2. The Clipboard menu's Copy and Paste.
      const clipboard = await openConsoleMenu(page, 'Clipboard');
      await expectGatedControl(
        page,
        clipboard.getByRole('menuitem', { name: 'Copy', exact: true }),
        vm.state.vncClipboardEnabled,
        VNC_CLIPBOARD_TOOLTIP
      );
      await expect(clipboard.getByRole('menuitem', { name: 'Paste', exact: true })).toBeEnabled();
      await closeConsoleMenus(page);
    });

    test('Snapshots is available only when the VM has a snapshot', async ({
      consoleAuthenticatedPage: page,
    }) => {
      // The state poller syncs hasSnapshot from Proxmox. Without one there is
      // nothing to revert to, so the item is disabled and says so. Its tooltip is
      // on the item itself, so it is read as the item's accessible description
      // (a disabled item can't be hovered).
      const menu = await openConsoleMenu(page);
      const snapshots = menu.getByRole('menuitem', { name: 'Snapshots', exact: true });
      if (vm.state.hasSnapshot) {
        await expect(snapshots).toBeEnabled();
        await expect(snapshots).toHaveAccessibleDescription('Select a snapshot to revert to');
      } else {
        await expect(snapshots).toBeDisabled();
        await expect(snapshots).toHaveAccessibleDescription('No snapshots available');
      }
      await closeConsoleMenus(page);
    });
  });
}
