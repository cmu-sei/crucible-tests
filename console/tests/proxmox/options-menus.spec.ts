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
  expectTooltip,
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

/** Tooltips the Proxmox bar shows, verbatim from console.ui. */
const GUEST_AGENT_TOOLTIP = 'Requires the QEMU guest agent';
const CLIPBOARD_SETUP =
  "this VM's display has clipboard=vnc set and spice-vdagent is running in the guest";
const COPY_TOOLTIP =
  "Copies the text last copied inside the VM from the VM's clipboard to your clipboard.";
const COPY_DISABLED_TOOLTIP = `Disabled: copying from the VM's clipboard works only when ${CLIPBOARD_SETUP}, and clipboard=vnc isn't set on this VM.`;
const TOOLBAR_COPY_TOOLTIP =
  COPY_TOOLTIP +
  ' If your browser blocks writing to your clipboard, shows the text so you can copy it by hand.';
const PASTE_TOOLTIP =
  "Puts your clipboard's text on the VM's clipboard. Then press Ctrl+V in the VM to paste it.";
const PASTE_DISABLED_TOOLTIP = `Disabled: pasting to the VM's clipboard works only when ${CLIPBOARD_SETUP}, and clipboard=vnc isn't set on this VM. Keyboard > Text types text into the VM instead.`;
const TOOLBAR_PASTE_TOOLTIP =
  PASTE_TOOLTIP +
  ' If your browser blocks reading your clipboard, opens a dialog for text to type into the VM instead.';
const TOOLBAR_PASTE_TYPES_TOOLTIP = `Opens a dialog for text to type into the VM as keystrokes (the * marks this). Pasting to the VM's clipboard works only when ${CLIPBOARD_SETUP}, and clipboard=vnc isn't set on this VM.`;
const CTRL_ALT_DEL_TOOLTIP = 'Sends Ctrl-Alt-Del to the VM.';
const TEXT_TOOLTIP =
  'Opens a dialog for text to type into the VM as keystrokes. Works on any VM, with no clipboard setup.';

/**
 * The toolbar's Paste types text (through Send Text) instead of filling the
 * VM's clipboard when the VM has no VNC clipboard, and its label carries a `*`
 * to say so.
 */
function pasteLabel(vm: ProxmoxConsoleVm): string {
  return vm.state.vncClipboardEnabled ? 'Paste' : 'Paste *';
}

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
      for (const name of ['Copy', pasteLabel(vm), 'Ctrl-Alt-Del']) {
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

    test('Keyboard menu offers Ctrl-Alt-Del and Text, which opens the Send Text dialog', async ({
      consoleAuthenticatedPage: page,
    }) => {
      // 1. Ctrl-Alt-Del and Text, the same two items as the vSphere console's
      //    Keyboard menu, each with a tooltip that says what it does.
      const keyboard = await openConsoleMenu(page, 'Keyboard');
      await expect(keyboard.getByRole('menuitem')).toHaveText(['Ctrl-Alt-Del', 'Text']);
      await expect(keyboard.getByRole('menuitem', { name: 'Ctrl-Alt-Del', exact: true })).toHaveAccessibleDescription(
        CTRL_ALT_DEL_TOOLTIP
      );
      await expect(keyboard.getByRole('menuitem', { name: 'Text', exact: true })).toHaveAccessibleDescription(
        TEXT_TOOLTIP
      );

      // 2. Text opens the shared Send Text dialog. It is cancelled, never sent,
      //    so nothing is typed into the guest.
      await keyboard.getByRole('menuitem', { name: 'Text', exact: true }).click();
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
      // reports none running. Mount ISO needs only an ISO source, which the API
      // reports as canMountIso; without one the item isn't offered at all.
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
      if (vm.state.canMountIso) {
        await expect(mountIso).toBeVisible();
        await expect(mountIso).toBeEnabled();
      } else {
        await expect(mountIso).toHaveCount(0);
      }
      await closeConsoleMenus(page);
    });

    test("Copy and Paste follow the VM's VNC clipboard", async ({ consoleAuthenticatedPage: page }) => {
      // QEMU only passes the clipboard between the guest and the console when the
      // VM's `vga` config sets clipboard=vnc, which the API reports as
      // vncClipboardEnabled. Every Copy and Paste says what it does, or why it is
      // disabled.
      const clipboard = vm.state.vncClipboardEnabled;

      // 1. The toolbar's Copy needs the VNC clipboard. Its Paste never is
      //    disabled: without the VNC clipboard it reads "Paste *" and types the
      //    text through Send Text instead.
      const bar = page.locator('app-options-bar2');
      const copy = bar.getByRole('button', { name: 'Copy', exact: true });
      await expectGatedControl(page, copy, clipboard, COPY_DISABLED_TOOLTIP);
      if (clipboard) {
        await expectTooltip(page, copy, TOOLBAR_COPY_TOOLTIP);
      }
      const paste = bar.getByRole('button', { name: pasteLabel(vm), exact: true });
      await expect(paste).toBeEnabled();
      await expectTooltip(page, paste, clipboard ? TOOLBAR_PASTE_TOOLTIP : TOOLBAR_PASTE_TYPES_TOOLTIP);

      // 2. The Clipboard menu's Copy and Paste move text between clipboards only,
      //    with no fallback, so both need the VNC clipboard.
      const menu = await openConsoleMenu(page, 'Clipboard');
      await expect(menu.getByRole('menuitem')).toHaveText(['Copy', 'Paste']);
      const menuCopy = menu.getByRole('menuitem', { name: 'Copy', exact: true });
      const menuPaste = menu.getByRole('menuitem', { name: 'Paste', exact: true });
      await expectGatedControl(page, menuCopy, clipboard, COPY_DISABLED_TOOLTIP);
      await expectGatedControl(page, menuPaste, clipboard, PASTE_DISABLED_TOOLTIP);
      if (clipboard) {
        await expectTooltip(page, menuCopy, COPY_TOOLTIP);
        await expectTooltip(page, menuPaste, PASTE_TOOLTIP);
      }
      await closeConsoleMenus(page);
    });

    test('Snapshots is available only when the VM has a snapshot', async ({
      consoleAuthenticatedPage: page,
    }) => {
      // The state poller syncs hasSnapshot from Proxmox. Without one there is
      // nothing to revert to, so the item is disabled and says so.
      const menu = await openConsoleMenu(page);
      const snapshots = menu.getByRole('menuitem', { name: 'Snapshots', exact: true });
      await expectGatedControl(page, snapshots, vm.state.hasSnapshot, 'No snapshots available');
      if (vm.state.hasSnapshot) {
        await expectTooltip(page, snapshots, 'Select a snapshot to revert to');
      }
      await closeConsoleMenus(page);
    });
  });
}
