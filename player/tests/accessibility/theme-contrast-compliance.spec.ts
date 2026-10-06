// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import type { Page } from '@playwright/test';
import { test, expect, Services, setPlayerTheme, PLAYER_THEMES } from '../../fixtures';
import { luminance, contrastRatio, sample, assertReadable, effectiveColorSettings, cssVar, hexToRgb } from '../../../theme-helpers';

/**
 * Accessibility — real WCAG contrast on the Player home page and its Create New
 * View dialog, in both themes.
 *
 * It samples the colours the app actually paints and checks each foreground /
 * background pair against WCAG 2.1 AA: 1.4.3 for text (normal >= 4.5:1, large
 * >= 3:1) and 1.4.11 for the primary action icon (>= 3:1).
 *
 * It also checks the color settings contract from the Crucible colors design spec
 * (`crucible-development/design-specs/angular/colors.md`): the top bar keeps its
 * colors in both themes, and Material's `primary` / `on-primary` roles take each
 * mode's configured value verbatim. Expected colors are read from the app's own
 * settings files rather than hardcoded, so an environment that overrides them
 * still passes as long as the app applies what it was given.
 *
 * Read-only: it navigates and reads computed styles, and depends on no table rows
 * (it measures the always-present "My Views" title, column headers, the "Add New
 * View" icon button, and an unsaved "Create New View?" dialog). The fixture's own
 * seeded views are cleaned up by the fixture. The theme is persisted in
 * localStorage, so it is restored in afterEach to leave the context as it found it.
 */

/**
 * Open the home page and wait for the "My Views" title and the list's header row
 * (both are always present, rows or not).
 */
async function gotoHome(page: Page): Promise<void> {
  await page.goto(Services.Player.UI, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.views-title')).toHaveText('My Views', { timeout: 15000 });
  await expect(page.getByRole('columnheader').filter({ hasText: /\w/ }).first()).toBeVisible({
    timeout: 15000,
  });
}

for (const theme of PLAYER_THEMES) {
  test.describe(`${theme} theme › Responsive Design and Accessibility`, () => {
    test.afterEach(async ({ playerAuthenticatedPage: page }) => {
      // Restore light even when the test above failed, so nothing that reuses this
      // context inherits dark. Reload first: a failed dialog test leaves its CDK
      // backdrop over the user menu.
      await gotoHome(page);
      await setPlayerTheme(page, 'light');
    });

    // WCAG 1.4.3 — text contrast on the page surface.
    test('Theme Contrast Compliance (WCAG 1.4.3 text)', async ({ playerAuthenticatedPage: page }) => {
      await gotoHome(page);
      await setPlayerTheme(page, theme);

      // 1. The "My Views" title against the page surface (24px, so the large-text
      //    bar applies).
      const title = page.locator('.views-title');
      await assertReadable(title, `${theme}: My Views title`);

      // 2. A table column header — present regardless of how many rows exist.
      const columnHeader = page.getByRole('columnheader').filter({ hasText: /\w/ }).first();
      await expect(columnHeader).toBeVisible();
      await assertReadable(columnHeader, `${theme}: table column header`);

      // 3. Top bar text against the top bar (it keeps its brand pair in both themes).
      const toolbar = page.locator('app-topbar mat-toolbar.toolbar');
      await expect(toolbar).toBeVisible();
      await assertReadable(toolbar.locator('.view-text'), `${theme}: top bar title`);
      await assertReadable(
        toolbar.getByRole('button', { name: 'Menu', exact: true }),
        `${theme}: top bar user menu`
      );

      // 4. Direction check on page content (not the top bar, which is the same brand
      //    color in both themes): dark must be light-on-dark, light dark-on-light.
      const headerSample = await sample(columnHeader);
      if (theme === 'dark') {
        expect(
          luminance(headerSample.color),
          'dark theme should render light text on a darker surface'
        ).toBeGreaterThan(luminance(headerSample.surface!));
      } else {
        expect(
          luminance(headerSample.color),
          'light theme should render dark text on a lighter surface'
        ).toBeLessThan(luminance(headerSample.surface!));
      }
    });

    // WCAG 1.4.11 — non-text (icon) contrast for a primary action control. The home
    // page's "Add New View" mat-icon-button draws its mdi-plus-circle glyph in
    // `--mat-sys-primary`; both themes must keep it >= 3:1 against the surface it
    // sits on. Threshold stays generic: `primary` comes from each mode's configured
    // setting, so don't hardcode a specific hex.
    test('Primary action icon contrast (WCAG 1.4.11)', async ({ playerAuthenticatedPage: page }) => {
      await gotoHome(page);
      await setPlayerTheme(page, theme);

      const addButton = page.getByRole('button', { name: 'Add New View', exact: true });
      await expect(addButton).toBeVisible({ timeout: 10000 });

      // The button's computed color is the icon color the glyph inherits.
      const primary = await cssVar(page, '--mat-sys-primary');
      await expect(addButton).toHaveCSS('color', hexToRgb(primary));

      // Non-text contrast bar is a flat 3:1 regardless of size.
      const s = await sample(addButton);
      expect(s.surface, 'Add New View icon: no painted background found').not.toBeNull();
      const ratio = contrastRatio(s.color, s.surface!);
      expect(
        ratio,
        `${theme}: Add New View icon contrast ${ratio.toFixed(2)}:1 ` +
          `(${s.color} on ${s.surface}) must be >= 3:1 (WCAG 1.4.11)`
      ).toBeGreaterThanOrEqual(3);
    });

    // Colors design spec §3–§4: the top bar keeps the same colors in both modes,
    // and `primary` / `on-primary` take the active mode's settings verbatim (dark
    // falls back to light when its key is absent). Nothing is derived or corrected.
    test('Color settings applied per theme (design spec)', async ({ playerAuthenticatedPage: page }) => {
      await gotoHome(page);
      await setPlayerTheme(page, theme);

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

      // The home logo keeps the top-bar pair too: the shape in the top-bar color on
      // a disc of the top-bar text color.
      const homeLink = toolbar.getByRole('link', { name: 'Player home', exact: true });
      await expect(homeLink).toHaveCSS('background-color', hexToRgb(settings.AppTopBarHexTextColor!));
      await expect(homeLink.locator('mat-icon')).toHaveCSS('color', hexToRgb(settings.AppTopBarHexColor!));

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
    // (Save) must each reach 4.5:1. Uses the home page's "Add New View" dialog (the
    // shared crucible-dialog NameDialog) without submitting.
    test('Primary and on-primary text contrast (WCAG 1.4.3)', async ({ playerAuthenticatedPage: page }) => {
      await gotoHome(page);
      await setPlayerTheme(page, theme);

      await page.getByRole('button', { name: 'Add New View', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Create New View?' });
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Save stays disabled (and greyed) until the form is valid; fill the name so
      // the button renders in its enabled filled-primary state. The view is only
      // POSTed on submit, and this test never submits.
      await dialog.getByRole('textbox', { name: 'Name' }).fill('Contrast probe');
      const saveButton = dialog.getByRole('button', { name: 'Save' });
      await expect(saveButton).toBeEnabled();

      // `on-primary` label on the filled `primary` Save button.
      const primary = await cssVar(page, '--mat-sys-primary');
      await expect(saveButton).toHaveCSS('background-color', hexToRgb(primary));
      await assertReadable(saveButton, `${theme}: filled Save button label`);

      // `primary` used as text on the dialog surface.
      const cancelButton = dialog.getByRole('button', { name: 'Cancel' });
      await expect(cancelButton).toHaveCSS('color', hexToRgb(primary));
      await assertReadable(cancelButton, `${theme}: Cancel button label`);

      // Cancel always closes a crucible-dialog, even with unsaved input.
      await cancelButton.click();
      await expect(dialog).toBeHidden();
    });
  });
}
