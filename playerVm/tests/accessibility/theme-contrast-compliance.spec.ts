// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import type { Page } from '@playwright/test';
import { test, expect, gotoPlayerVm, setPlayerVmTheme, PLAYERVM_THEMES, PlayerVmTheme } from '../../fixtures';
import { luminance, contrastRatio, sample, assertReadable, effectiveColorSettings, cssVar, hexToRgb } from '../../../theme-helpers';

/**
 * Accessibility — real WCAG contrast on the Player VM UI's VM list and Map pages,
 * and its New Map dialog, in both themes.
 *
 * It samples the colours the app actually paints and checks each foreground /
 * background pair against WCAG 2.1 AA: 1.4.3 for text (normal >= 4.5:1, large
 * >= 3:1) and 1.4.11 for the primary "Clear Search" icon (>= 3:1).
 *
 * It also checks the color settings contract from the Crucible colors design spec
 * (`crucible-development/design-specs/angular/colors.md`): the top bar keeps its
 * colors in both themes, and Material's `primary` / `on-primary` roles take each
 * mode's configured value verbatim. Expected colors are read from the app's own
 * settings files rather than hardcoded, so an environment that overrides them
 * still passes as long as the app applies what it was given.
 *
 * Each test runs against a view the `playerVmView` fixture seeds through the
 * Player API (it has no VMs and no map) and deletes afterwards. The New Map
 * dialog is opened and cancelled, never saved.
 *
 * Theme: each page loads light, then `setPlayerVmTheme` flips it through the user
 * menu's "Dark Theme" switch, so the switch itself is exercised here (the
 * functional specs boot straight into the theme via `?theme=`). The VM UI does
 * not persist the theme, so nothing needs restoring afterwards.
 */

/**
 * Load a VM UI route in light, then switch to `theme` through the user menu.
 */
async function openInTheme(page: Page, path: string, theme: PlayerVmTheme): Promise<void> {
  await gotoPlayerVm(page, path, 'light');
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible({ timeout: 30000 });
  await setPlayerVmTheme(page, theme);
}

const NO_MAP_HEADING = 'No Map is assigned to this Team';

for (const theme of PLAYERVM_THEMES) {
  test.describe(`${theme} theme › Responsive Design and Accessibility`, () => {
    // WCAG 1.4.3 — text contrast on the top bar and the page surface.
    test('Theme Contrast Compliance (WCAG 1.4.3 text)', async ({
      playerVmAuthenticatedPage: page,
      playerVmView: view,
    }) => {
      await openInTheme(page, `/views/${view.id}/map`, theme);

      // 1. Top bar text against the top bar (it keeps its brand pair in both themes).
      const toolbar = page.locator('app-topbar mat-toolbar.toolbar');
      await expect(toolbar).toBeVisible();
      await assertReadable(toolbar.locator('.view-text'), `${theme}: top bar title`);
      await assertReadable(
        toolbar.getByRole('button', { name: 'Menu', exact: true }),
        `${theme}: top bar user menu`
      );

      // 2. The Map page's "No Map is assigned to this Team" heading on the page
      //    surface (the seeded view never has a map).
      const heading = page.getByRole('heading', { name: NO_MAP_HEADING });
      await expect(heading).toBeVisible({ timeout: 30000 });
      await assertReadable(heading, `${theme}: no-map heading`);

      // 3. Direction check on page content (not the top bar, which is the same brand
      //    color in both themes): dark must be light-on-dark, light dark-on-light.
      const headingSample = await sample(heading);
      if (theme === 'dark') {
        expect(
          luminance(headingSample.color),
          'dark theme should render light text on a darker surface'
        ).toBeGreaterThan(luminance(headingSample.surface!));
      } else {
        expect(
          luminance(headingSample.color),
          'light theme should render dark text on a lighter surface'
        ).toBeLessThan(luminance(headingSample.surface!));
      }
    });

    // WCAG 1.4.11 — non-text (icon) contrast for a primary control. The VM list's
    // "Clear Search" mat-icon-button (color="primary") appears once the search
    // field has text, and draws its mdi-close-circle glyph in `--mat-sys-primary`;
    // both themes must keep it >= 3:1 against the surface it sits on. Threshold
    // stays generic: `primary` comes from each mode's configured setting.
    test('Primary action icon contrast (WCAG 1.4.11)', async ({
      playerVmAuthenticatedPage: page,
      playerVmView: view,
    }) => {
      await openInTheme(page, `/views/${view.id}`, theme);

      const search = page.getByRole('textbox', { name: 'Search' });
      await expect(search).toBeVisible({ timeout: 30000 });
      await search.fill('contrast probe');
      const clearButton = page.getByRole('button', { name: 'Clear Search', exact: true });
      await expect(clearButton).toBeVisible({ timeout: 10000 });

      // The button's computed color is the icon color the glyph inherits.
      const primary = await cssVar(page, '--mat-sys-primary');
      await expect(clearButton).toHaveCSS('color', hexToRgb(primary));

      // Non-text contrast bar is a flat 3:1 regardless of size.
      const s = await sample(clearButton);
      expect(s.surface, 'Clear Search icon: no painted background found').not.toBeNull();
      const ratio = contrastRatio(s.color, s.surface!);
      expect(
        ratio,
        `${theme}: Clear Search icon contrast ${ratio.toFixed(2)}:1 ` +
          `(${s.color} on ${s.surface}) must be >= 3:1 (WCAG 1.4.11)`
      ).toBeGreaterThanOrEqual(3);

      // Clearing the search removes the button again.
      await clearButton.click();
      await expect(search).toHaveValue('');
      await expect(clearButton).toHaveCount(0);
    });

    // Colors design spec §3–§4: the top bar keeps the same colors in both modes,
    // and `primary` / `on-primary` take the active mode's settings verbatim (dark
    // falls back to light when its key is absent). Nothing is derived or corrected.
    test('Color settings applied per theme (design spec)', async ({
      playerVmAuthenticatedPage: page,
      playerVmView: view,
    }) => {
      await openInTheme(page, `/views/${view.id}`, theme);

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

      // Top bar: same pair in both themes, and actually painted on the toolbar.
      expect(await cssVar(page, '--crucible-topbar-background'), `${theme}: --crucible-topbar-background`).toBe(
        settings.AppTopBarHexColor!.toUpperCase()
      );
      expect(await cssVar(page, '--crucible-topbar-text'), `${theme}: --crucible-topbar-text`).toBe(
        settings.AppTopBarHexTextColor!.toUpperCase()
      );
      const toolbar = page.locator('app-topbar mat-toolbar.toolbar');
      await expect(toolbar).toHaveCSS('background-color', hexToRgb(settings.AppTopBarHexColor!));
      await expect(toolbar).toHaveCSS('color', hexToRgb(settings.AppTopBarHexTextColor!));

      // The home logo keeps the top-bar pair too: the monitor glyph in the top-bar
      // color on a disc of the top-bar text color.
      const homeLogo = toolbar.getByRole('button', { name: 'Player VM', exact: true });
      await expect(homeLogo).toHaveCSS('background-color', hexToRgb(settings.AppTopBarHexTextColor!));
      await expect(homeLogo.locator('mat-icon')).toHaveCSS('color', hexToRgb(settings.AppTopBarHexColor!));

      // Material primary roles: the active mode's pair, verbatim.
      expect(await cssVar(page, '--mat-sys-primary'), `${theme}: --mat-sys-primary`).toBe(
        expectedPrimary.toUpperCase()
      );
      expect(await cssVar(page, '--mat-sys-on-primary'), `${theme}: --mat-sys-on-primary`).toBe(
        expectedOnPrimary.toUpperCase()
      );
    });

    // Colors design spec §3b checks 1 and 3 (WCAG 1.4.3): `primary` used as text on
    // the surface (the Cancel label) and `on-primary` on a filled `primary` button
    // (Save) must each reach 4.5:1. Uses the Map page's "New Map" dialog (the
    // shared crucible-dialog) without submitting.
    test('Primary and on-primary text contrast (WCAG 1.4.3)', async ({
      playerVmAuthenticatedPage: page,
      playerVmView: view,
    }) => {
      await openInTheme(page, `/views/${view.id}/map`, theme);

      await page.getByRole('button', { name: 'New Map' }).click({ timeout: 30000 });
      const dialog = page.getByRole('dialog', { name: 'New Map' });
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Save stays disabled (and greyed) until the form is valid (name, image URL
      // and at least one team); fill it so the button renders in its enabled
      // filled-primary state. The map is only POSTed on submit, and this test
      // never submits.
      await dialog.getByRole('textbox', { name: 'Name' }).fill('Contrast probe');
      await dialog.getByRole('textbox', { name: 'External Image URL' }).fill('https://example.com/map.png');
      await dialog.getByRole('combobox', { name: 'Teams' }).click();
      await page.getByRole('option').first().click();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('listbox')).toHaveCount(0);
      const saveButton = dialog.getByRole('button', { name: 'Save', exact: true });
      await expect(saveButton).toBeEnabled();

      // `on-primary` label on the filled `primary` Save button.
      const primary = await cssVar(page, '--mat-sys-primary');
      await expect(saveButton).toHaveCSS('background-color', hexToRgb(primary));
      await assertReadable(saveButton, `${theme}: filled Save button label`);

      // `primary` used as text on the dialog surface.
      const cancelButton = dialog.getByRole('button', { name: 'Cancel', exact: true });
      await expect(cancelButton).toHaveCSS('color', hexToRgb(primary));
      await assertReadable(cancelButton, `${theme}: Cancel button label`);

      // Cancel always closes a crucible-dialog, even with unsaved input.
      await cancelButton.click();
      await expect(dialog).toBeHidden();
    });
  });
}
