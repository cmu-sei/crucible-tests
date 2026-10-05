// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import type { Locator, Page } from '@playwright/test';
import { test, expect, Services, setSteamfitterTheme, STEAMFITTER_THEMES } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

/**
 * Accessibility — real WCAG contrast on the Steamfitter home page and an admin
 * dialog, in both themes.
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
 * Read-only: it navigates and reads computed styles, seeds nothing, and depends on
 * no table rows (it measures the always-present "My Scenarios" section title,
 * column headers, the Administration icon button, and an unsaved Admin → Groups
 * "Create New Group?" dialog), so it needs no cleanup. The theme is persisted in
 * localStorage, so it is restored in afterEach to leave the context as it found it.
 */

/** WCAG relative luminance for an `rgb(...)` / `rgba(...)` string. */
function luminance(rgb: string): number {
  const [r, g, b] = rgb
    .match(/\d+(\.\d+)?/g)!
    .slice(0, 3)
    .map((v) => {
      const channel = Number(v) / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two `rgb()` colours. */
function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

interface Sample {
  color: string;
  surface: string | null;
  fontSizePx: number;
  fontWeight: number;
}

/**
 * Sample the text colour, the first non-transparent painted background behind the
 * element, and the font metrics (so the caller can apply the large-text threshold).
 *
 * Walking up for a painted background matters: many M3 elements compute to a
 * transparent `background-color` and inherit the surface from an ancestor, so
 * comparing text against the element's own background would divide by the wrong
 * colour and report a bogus ratio.
 */
async function sample(locator: Locator): Promise<Sample> {
  return locator.evaluate((el) => {
    const paintedBackground = (from: Element) => {
      let node: Element | null = from;
      while (node) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        node = node.parentElement;
      }
      return null;
    };
    const style = getComputedStyle(el);
    return {
      color: style.color,
      surface: paintedBackground(el),
      fontSizePx: parseFloat(style.fontSize),
      fontWeight: Number(style.fontWeight) || 400,
    };
  });
}

/** WCAG large-text bar: >= 24px, or >= 18.66px when bold. */
function requiredRatio(s: Sample): number {
  const isLarge = s.fontSizePx >= 24 || (s.fontSizePx >= 18.66 && s.fontWeight >= 700);
  return isLarge ? 3 : 4.5;
}

async function assertReadable(locator: Locator, label: string): Promise<number> {
  const s = await sample(locator);
  expect(s.surface, `${label}: could not find a painted background to measure against`).not.toBeNull();
  const ratio = contrastRatio(s.color, s.surface!);
  const min = requiredRatio(s);
  expect(
    ratio,
    `${label}: contrast ${ratio.toFixed(2)}:1 (${s.color} on ${s.surface}, ` +
      `${s.fontSizePx}px/${s.fontWeight}) must be >= ${min}:1 (WCAG 1.4.3)`
  ).toBeGreaterThanOrEqual(min);
  return ratio;
}

/** The six color keys defined by the colors design spec (§4). */
interface ColorSettings {
  AppTopBarHexColor?: string;
  AppTopBarHexTextColor?: string;
  AppLightModePrimaryHexColor?: string;
  AppLightModePrimaryHexTextColor?: string;
  AppDarkModePrimaryHexColor?: string;
  AppDarkModePrimaryHexTextColor?: string;
}

/**
 * The effective settings, layered the way `ComnSettingsService` layers them:
 * `settings.json`, then `settings.shared.json`, then `settings.env.json`, each
 * deep-merged over the last. A missing overlay is skipped. Fetched from the app's
 * own origin so the result reflects what is actually served.
 */
async function effectiveColorSettings(page: Page): Promise<ColorSettings> {
  return page.evaluate(async () => {
    const isObject = (v: unknown): v is Record<string, unknown> =>
      !!v && typeof v === 'object' && !Array.isArray(v);
    const deepMerge = (target: Record<string, unknown>, source: Record<string, unknown>) => {
      const result: Record<string, unknown> = { ...target, ...source };
      for (const key of Object.keys(source)) {
        if (isObject(source[key]) && isObject(target[key])) {
          result[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
        }
      }
      return result;
    };
    let merged: Record<string, unknown> = {};
    for (const file of ['settings.json', 'settings.shared.json', 'settings.env.json']) {
      const res = await fetch(`/assets/config/${file}`, { cache: 'no-store' });
      if (!res.ok) continue;
      const body = await res.json().catch(() => null);
      if (isObject(body)) merged = deepMerge(merged, body);
    }
    return merged;
  });
}

/** Read a CSS custom property as set on `<body>`, trimmed and uppercased for comparison. */
async function cssVar(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (n) => getComputedStyle(document.body).getPropertyValue(n).trim().toUpperCase(),
    name
  );
}

/** `#rrggbb` → `rgb(r, g, b)`, matching how computed styles serialize colors. */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Open the home page on its default Scenarios section and wait for the section
 * title and the list's header row (both are always present, rows or not).
 */
async function gotoHome(page: Page): Promise<void> {
  await page.goto(Services.Steamfitter.UI, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('button.section-menu-trigger')).toContainText('My Scenarios', {
    timeout: 15000,
  });
  await expect(page.getByRole('columnheader').filter({ hasText: /\w/ }).first()).toBeVisible({
    timeout: 15000,
  });
}

for (const theme of STEAMFITTER_THEMES) {
  test.describe(`${theme} theme › UI Responsiveness and Accessibility`, () => {
    test.afterEach(async ({ steamfitterAuthenticatedPage: page }) => {
      // Restore light even when the test above failed, so nothing that reuses this
      // context inherits dark. Reload first: a failed dialog test leaves its CDK
      // backdrop over the user menu.
      await gotoHome(page);
      await setSteamfitterTheme(page, 'light');
    });

    // WCAG 1.4.3 — text contrast on the page surface.
    test('Theme Contrast Compliance (WCAG 1.4.3 text)', async ({ steamfitterAuthenticatedPage: page }) => {
      await gotoHome(page);
      await setSteamfitterTheme(page, theme);

      // 1. The "My Scenarios" section title against the page surface. It is a text
      //    button drawn in `primary`, at 24px bold, so the large-text bar applies.
      const title = page.locator('button.section-menu-trigger');
      await assertReadable(title, `${theme}: section title`);

      // 2. A table column header — present regardless of how many rows exist.
      const columnHeader = page.getByRole('columnheader').filter({ hasText: /\w/ }).first();
      await expect(columnHeader).toBeVisible();
      await assertReadable(columnHeader, `${theme}: table column header`);

      // 3. Top bar text against the top bar (it keeps its brand pair in both themes).
      const toolbar = page.locator('app-topbar mat-toolbar.toolbar');
      await expect(toolbar).toBeVisible();
      await assertReadable(toolbar.locator('.view-text'), `${theme}: top bar title`);
      await assertReadable(toolbar.locator('button.menu-trigger'), `${theme}: top bar user menu`);

      // 4. Direction check on page content (not the top bar, which is the same brand
      //    color in both themes): dark must be light-on-dark, light dark-on-light.
      //    Uses the on-surface column header rather than the primary-colored title.
      const titleSample = await sample(columnHeader);
      if (theme === 'dark') {
        expect(
          luminance(titleSample.color),
          'dark theme should render light text on a darker surface'
        ).toBeGreaterThan(luminance(titleSample.surface!));
      } else {
        expect(
          luminance(titleSample.color),
          'light theme should render dark text on a lighter surface'
        ).toBeLessThan(luminance(titleSample.surface!));
      }
    });

    // WCAG 1.4.11 — non-text (icon) contrast for a primary action control. The
    // home page's Administration mat-icon-button draws its mdi-cog glyph in
    // `--mat-sys-primary` (styles.scss icon-button-overrides); both themes must keep
    // it >= 3:1 against the surface it sits on. Threshold stays generic: `primary`
    // comes from each mode's configured setting, so don't hardcode a specific hex.
    test('Primary action icon contrast (WCAG 1.4.11)', async ({ steamfitterAuthenticatedPage: page }) => {
      await gotoHome(page);
      await setSteamfitterTheme(page, theme);

      const adminButton = page.getByRole('button', { name: 'Show Administration Page' });
      await expect(adminButton).toBeVisible({ timeout: 10000 });

      // The button's computed color is the icon color the glyph inherits.
      const primary = await cssVar(page, '--mat-sys-primary');
      await expect(adminButton).toHaveCSS('color', hexToRgb(primary));

      // Non-text contrast bar is a flat 3:1 regardless of size.
      const s = await sample(adminButton);
      expect(s.surface, 'Administration icon: no painted background found').not.toBeNull();
      const ratio = contrastRatio(s.color, s.surface!);
      expect(
        ratio,
        `${theme}: Administration icon contrast ${ratio.toFixed(2)}:1 ` +
          `(${s.color} on ${s.surface}) must be >= 3:1 (WCAG 1.4.11)`
      ).toBeGreaterThanOrEqual(3);
    });

    // Colors design spec §3–§4: the top bar keeps the same colors in both modes,
    // and `primary` / `on-primary` take the active mode's settings verbatim (dark
    // falls back to light when its key is absent). Nothing is derived or corrected.
    test('Color settings applied per theme (design spec)', async ({ steamfitterAuthenticatedPage: page }) => {
      await gotoHome(page);
      await setSteamfitterTheme(page, theme);

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
      const homeLink = toolbar.getByRole('link').first();
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
    // (Save) must each reach 4.5:1. Uses Admin → Groups "Add New Group" (the shared
    // crucible-dialog NameDialog) without submitting.
    test('Primary and on-primary text contrast (WCAG 1.4.3)', async ({ steamfitterAuthenticatedPage: page }) => {
      await setSteamfitterTheme(page, theme);
      await navigateToAdminSection(page, 'Groups');
      await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: 'Add New Group', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Create New Group?' });
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Save stays disabled (and greyed) until the form is valid and dirty; fill the
      // name so the button renders in its enabled filled-primary state. The group is
      // only POSTed on submit, and this test never submits.
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
