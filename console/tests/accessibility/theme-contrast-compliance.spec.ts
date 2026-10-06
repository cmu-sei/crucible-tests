// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: console/console-test-plan.md
// seed: seed.spec.ts

import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoConsole, setConsoleTheme, CONSOLE_THEMES, ConsoleTheme } from '../../fixtures';
import { luminance, contrastRatio, sample, assertReadable, effectiveColorSettings, cssVar, hexToRgb } from '../../../theme-helpers';

/**
 * Accessibility — real WCAG contrast on the Console UI's "VM Not Found" page, a
 * console page's options bar and gear menu, and the Send Text dialog, in both
 * themes.
 *
 * It samples the colours the app actually paints and checks each foreground /
 * background pair against WCAG 2.1 AA: 1.4.3 for text (normal >= 4.5:1, large
 * >= 3:1) and 1.4.11 for the primary "Console options" gear icon and the gear
 * menu's "Dark Theme" switch (>= 3:1).
 *
 * It also checks the color settings contract from the Crucible colors design spec
 * (`crucible-development/design-specs/angular/colors.md`): the top-bar properties
 * keep their colors in both themes (Console has no brand top bar that paints
 * with them, so only the properties are checked), and Material's `primary` /
 * `on-primary` roles take each mode's configured value verbatim. Expected colors
 * are read from the app's own settings files rather than hardcoded.
 *
 * Console pages use a VM record the `consoleVm` fixture seeds (no hypervisor, so
 * the console stays "connecting") and deletes afterwards. The Send Text dialog is
 * filled in and cancelled, never sent.
 *
 * Theme: console pages load light, then `setConsoleTheme` flips the theme through
 * the gear menu's "Dark Theme" switch, so the switch itself is exercised here.
 * The "VM Not Found" page has no options bar, so it boots via `?theme=`. The
 * Console UI does not persist the theme, so nothing needs restoring afterwards.
 */

/** Contrast of `a` against `b`, asserted against the WCAG 1.4.11 3:1 non-text bar. */
function assertNonText(fg: string, bg: string, label: string): void {
  const ratio = contrastRatio(fg, bg);
  expect(ratio, `${label}: contrast ${ratio.toFixed(2)}:1 (${fg} on ${bg}) must be >= 3:1 (WCAG 1.4.11)`).toBeGreaterThanOrEqual(3);
}

/** Load a seeded VM's console in light, then switch to `theme` through the gear menu. */
async function openConsoleInTheme(page: Page, vmId: string, theme: ConsoleTheme): Promise<void> {
  await gotoConsole(page, `/vm/${vmId}/console`, 'light');
  await expect(page.getByRole('button', { name: 'Console options' }).first()).toBeVisible({ timeout: 30000 });
  await setConsoleTheme(page, theme);
}

/** Open the options bar gear menu and return its panel. */
async function openGearMenu(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Console options' }).first().click();
  const panel = page.locator('.mat-mdc-menu-panel').first();
  await expect(panel).toBeVisible({ timeout: 10000 });
  return panel;
}

const INVALID_VM_ID = '00000000-0000-0000-0000-000000000000';

for (const theme of CONSOLE_THEMES) {
  test.describe(`${theme} theme › Responsive Design and Accessibility`, () => {
    // WCAG 1.4.3 — text contrast on the not-found page, the options bar and the
    // gear menu, plus a light/dark direction check.
    test('Theme Contrast Compliance (WCAG 1.4.3 text)', async ({
      consoleAuthenticatedPage: page,
      consoleVm: vm,
    }) => {
      // 1. "VM Not Found" page: heading and description on the page surface.
      await gotoConsole(page, `/vm/${INVALID_VM_ID}/console`, theme);
      const heading = page.getByRole('heading', { name: 'VM Not Found' });
      await expect(heading).toBeVisible({ timeout: 30000 });
      await assertReadable(heading, `${theme}: "VM Not Found" heading`);
      await assertReadable(
        page.getByText('The virtual machine you are trying to access', { exact: false }),
        `${theme}: "VM Not Found" description`
      );

      // 2. Direction check: dark must be light-on-dark, light dark-on-light.
      const headingSample = await sample(heading);
      if (theme === 'dark') {
        expect(luminance(headingSample.color), 'dark theme should render light text on a darker surface').toBeGreaterThan(
          luminance(headingSample.surface!)
        );
      } else {
        expect(luminance(headingSample.color), 'light theme should render dark text on a lighter surface').toBeLessThan(
          luminance(headingSample.surface!)
        );
      }

      // 3. A console page: the connected-users label in the options bar (on
      //    --mat-sys-background). The VM name slot stays empty because the seeded
      //    record has no hypervisor VM behind it.
      await openConsoleInTheme(page, vm.id, theme);
      const optionsBar = page.locator('app-options-bar, app-options-bar2').first();
      const connectedUsers = optionsBar.locator('.connected-users');
      await expect(connectedUsers).toContainText('Connected:', { timeout: 30000 });
      await assertReadable(connectedUsers, `${theme}: options bar connected-users label`);

      // 4. Gear menu item labels on the menu panel.
      const panel = await openGearMenu(page);
      for (const name of ['Fullscreen', 'Reconnect', 'Keyboard']) {
        const item = panel.getByRole('menuitem', { name, exact: true });
        await expect(item).toBeVisible();
        await assertReadable(item.locator('.mat-mdc-menu-item-text'), `${theme}: "${name}" menu item`);
      }
      await assertReadable(panel.getByText('Dark Theme', { exact: true }), `${theme}: "Dark Theme" switch label`);
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
    });

    // WCAG 1.4.11 — the "Console options" gear is a mat-icon-button whose glyph is
    // drawn in `--mat-sys-primary` on the options bar (`--mat-sys-background`).
    test('Console options icon contrast (WCAG 1.4.11)', async ({ consoleAuthenticatedPage: page, consoleVm: vm }) => {
      await openConsoleInTheme(page, vm.id, theme);

      const gear = page.getByRole('button', { name: 'Console options' }).first();
      const primary = await cssVar(page, '--mat-sys-primary');
      await expect(gear).toHaveCSS('color', hexToRgb(primary));

      const s = await sample(gear);
      expect(s.surface, 'Console options icon: no painted background found').not.toBeNull();
      // The options bar paints `--mat-sys-background` (resolved through a probe
      // element, since the property may not be a plain hex value).
      const background = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.backgroundColor = 'var(--mat-sys-background)';
        document.body.appendChild(probe);
        const value = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return value;
      });
      await expect(page.locator('app-options-bar, app-options-bar2').first()).toHaveCSS('background-color', background);
      expect(s.surface).toBe(background);
      assertNonText(s.color, s.surface!, `${theme}: Console options icon`);
    });

    // WCAG 1.4.11 — the gear menu's "Dark Theme" switch. Its state indicator is the
    // selected track (primary) against the menu panel when on (dark), and the
    // handle against the unselected track when off (light). M3 paints both on
    // pseudo-elements, so they are read with getComputedStyle(el, '::after').
    test('Dark Theme switch contrast (WCAG 1.4.11)', async ({ consoleAuthenticatedPage: page, consoleVm: vm }) => {
      await openConsoleInTheme(page, vm.id, theme);
      const panel = await openGearMenu(page);
      const toggle = panel.getByRole('switch', { name: 'Dark Theme' });
      await expect(toggle).toHaveAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');

      const colors = await toggle.evaluate((el) => {
        const track = el.querySelector('.mdc-switch__track')!;
        const handle = el.querySelector('.mdc-switch__handle')!;
        return {
          panel: getComputedStyle(el.closest('.mat-mdc-menu-panel')!).backgroundColor,
          selectedTrack: getComputedStyle(track, '::after').backgroundColor,
          unselectedTrack: getComputedStyle(track, '::before').backgroundColor,
          handle: getComputedStyle(handle, '::after').backgroundColor,
        };
      });

      if (theme === 'dark') {
        expect(colors.selectedTrack).toBe(hexToRgb(await cssVar(page, '--mat-sys-primary')));
        assertNonText(colors.selectedTrack, colors.panel, `${theme}: selected "Dark Theme" switch track on menu panel`);
      } else {
        assertNonText(colors.handle, colors.unselectedTrack, `${theme}: "Dark Theme" switch handle on unselected track`);
      }
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
    });

    // Colors design spec §3–§4: the top-bar properties keep the same colors in both
    // modes, and `primary` / `on-primary` take the active mode's settings verbatim
    // (dark falls back to light when its key is absent). Console has no brand top
    // bar, so nothing paints with the top-bar pair; only the properties are checked.
    test('Color settings applied per theme (design spec)', async ({ consoleAuthenticatedPage: page, consoleVm: vm }) => {
      await openConsoleInTheme(page, vm.id, theme);

      const settings = await effectiveColorSettings(page);
      for (const key of [
        'AppTopBarHexColor',
        'AppTopBarHexTextColor',
        'AppLightModePrimaryHexColor',
        'AppLightModePrimaryHexTextColor',
      ] as const) {
        expect(settings[key], `settings must define ${key}`).toBeTruthy();
      }

      const expectedPrimary =
        theme === 'dark'
          ? settings.AppDarkModePrimaryHexColor || settings.AppLightModePrimaryHexColor!
          : settings.AppLightModePrimaryHexColor!;
      const expectedOnPrimary =
        theme === 'dark'
          ? settings.AppDarkModePrimaryHexTextColor || settings.AppLightModePrimaryHexTextColor!
          : settings.AppLightModePrimaryHexTextColor!;

      expect(await cssVar(page, '--crucible-topbar-background'), `${theme}: --crucible-topbar-background`).toBe(
        settings.AppTopBarHexColor!.toUpperCase()
      );
      expect(await cssVar(page, '--crucible-topbar-text'), `${theme}: --crucible-topbar-text`).toBe(
        settings.AppTopBarHexTextColor!.toUpperCase()
      );
      expect(await cssVar(page, '--mat-sys-primary'), `${theme}: --mat-sys-primary`).toBe(expectedPrimary.toUpperCase());
      expect(await cssVar(page, '--mat-sys-on-primary'), `${theme}: --mat-sys-on-primary`).toBe(
        expectedOnPrimary.toUpperCase()
      );
    });

    // Colors design spec §3b checks 1 and 3 (WCAG 1.4.3): `on-primary` on a filled
    // `primary` button (Send) and `primary` used as text on the dialog surface (the
    // Cancel label) must each reach 4.5:1. Uses the gear menu's Keyboard › Send
    // Text dialog (the shared crucible-dialog), filled in but never sent.
    test('Primary and on-primary text contrast (WCAG 1.4.3)', async ({
      consoleAuthenticatedPage: page,
      consoleVm: vm,
    }) => {
      await openConsoleInTheme(page, vm.id, theme);

      await openGearMenu(page);
      await page.getByRole('menuitem', { name: 'Keyboard', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Send Text', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Enter Text to Send' });
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await assertReadable(dialog.getByRole('heading', { name: 'Enter Text to Send' }), `${theme}: dialog title`);

      await dialog.getByRole('textbox', { name: 'Text to send' }).fill('contrast probe');
      const sendButton = dialog.getByRole('button', { name: 'Send', exact: true });
      await expect(sendButton).toBeEnabled();

      // `on-primary` label on the filled `primary` Send button.
      const primary = await cssVar(page, '--mat-sys-primary');
      await expect(sendButton).toHaveCSS('background-color', hexToRgb(primary));
      await expect(sendButton).toHaveCSS('color', hexToRgb(await cssVar(page, '--mat-sys-on-primary')));
      await assertReadable(sendButton, `${theme}: filled Send button label`);

      // `primary` used as text on the dialog surface. Soft, so the options bar's
      // primary-as-text labels below are reported too if this pair falls short.
      const cancelButton = dialog.getByRole('button', { name: 'Cancel', exact: true });
      await expect(cancelButton).toHaveCSS('color', hexToRgb(primary));
      await assertReadable(cancelButton, `${theme}: Cancel button label`, true);

      // Cancel closes the dialog without sending.
      await cancelButton.click();
      await expect(dialog).toBeHidden();

      // `primary` used as text on the options bar: its outlined Copy / Paste /
      // Ctrl-Alt-Del buttons label in `--mat-sys-primary` on `--mat-sys-background`.
      const optionsBar = page.locator('app-options-bar, app-options-bar2').first();
      for (const name of ['Copy', 'Paste', 'Ctrl-Alt-Del']) {
        const button = optionsBar.getByRole('button', { name, exact: true });
        await expect(button).toHaveCSS('color', hexToRgb(primary));
        await assertReadable(button, `${theme}: options bar "${name}" button label`, true);
      }
    });
  });
}
