// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: blueprint/blueprint-test-plan.md

import type { Locator, Page } from '@playwright/test';
import { test, expect, Services, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';

/**
 * Accessibility and Usability — real WCAG contrast on the Blueprint Build page and admin dialogs, in
 * both themes.
 *
 * The sibling `color-contrast-compliance.spec.ts` only asserts that content stays
 * *visible* after switching to dark mode; it never measures a contrast ratio, so a
 * theme that rendered dark-grey-on-black would still pass it. This spec closes that
 * gap: it samples the colours the app actually paints and checks each foreground /
 * background pair against WCAG 2.1 AA 1.4.3 (normal text >= 4.5:1, large text >= 3:1),
 * once per theme.
 *
 * It also checks the color settings contract from the Crucible colors design spec
 * (`crucible-development/design-specs/angular/colors.md`): the top bar keeps its
 * colors in both themes, and Material's `primary` / `on-primary` roles take each
 * mode's configured value verbatim. Expected colors are read from the app's own
 * settings files rather than hardcoded, so an environment that overrides them
 * still passes as long as the app applies what it was given.
 *
 * Read-only: it navigates and reads computed styles, seeds nothing, and depends on
 * no table rows (it measures the always-present "My MSELs" title, column headers, the
 * "Add blank MSEL" button, and an unsaved Admin → Units "Add Unit" dialog), so it
 * needs no cleanup.
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

/** Open the Build page and wait for the MSEL table shell (header row is always present). */
async function gotoBuild(page: Page): Promise<void> {
  await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('table')).toBeVisible({ timeout: 15000 });
}

for (const theme of BLUEPRINT_THEMES) {
  test.describe(`${theme} theme › Accessibility and Usability`, () => {
    // WCAG 1.4.3 — text contrast on the page surface.
    test('Theme Contrast Compliance (WCAG 1.4.3 text)', async ({ blueprintAuthenticatedPage: page }) => {
      await applyBlueprintTheme(page, theme);

      // Sanity: we are actually measuring the theme we asked for.
      const isDark = await page.evaluate(() => document.body.classList.contains('darkMode'));
      expect(isDark, `expected ${theme} theme to be active`).toBe(theme === 'dark');

      await gotoBuild(page);

      // 1. The MSEL list title ("My MSELs" / "All MSELs") against the page surface.
      const title = page.locator('.msels-title .center-self');
      await expect(title).toHaveText(/(My|All) MSELs/, { timeout: 10000 });
      await assertReadable(title, `${theme}: MSEL list title`);

      // 2. A table column header — always present regardless of how many rows exist.
      //    Skip the first (action) column: it holds only icon buttons, no text.
      const columnHeader = page.getByRole('columnheader').filter({ hasText: /\w/ }).first();
      await expect(columnHeader).toBeVisible();
      await assertReadable(columnHeader, `${theme}: table column header`);

      // 3. Top bar text against the top bar (it keeps its brand pair in both themes).
      const toolbar = page.locator('mat-toolbar.toolbar');
      await expect(toolbar).toBeVisible();
      await assertReadable(toolbar, `${theme}: top bar text`);

      // 4. Direction check on page content (not the top bar, which is the same brand
      //    color in both themes): dark must be light-on-dark, light dark-on-light.
      const titleSample = await sample(title);
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

    // WCAG 1.4.11 — non-text (icon) contrast for the primary action control. The
    // "Add blank MSEL" mat-icon-button draws its mdi-plus-circle glyph in
    // `--mat-sys-primary` (styles.scss icon-button-overrides); both themes must keep
    // it >= 3:1 against the surface it sits on. Threshold stays generic: `primary`
    // comes from each mode's configured setting, so don't hardcode a specific hex.
    test('Primary action icon contrast (WCAG 1.4.11)', async ({ blueprintAuthenticatedPage: page }) => {
      await applyBlueprintTheme(page, theme);
      await gotoBuild(page);

      const addButton = page.getByRole('button', { name: 'Add blank MSEL' });
      await expect(addButton).toBeVisible({ timeout: 10000 });
      // A disabled button is painted in the disabled on-surface tint, not primary.
      await expect(addButton).toBeEnabled();

      // The button's computed color is the icon color the glyph inherits.
      const primary = await cssVar(page, '--mat-sys-primary');
      await expect(addButton).toHaveCSS('color', hexToRgb(primary));

      // Non-text contrast bar is a flat 3:1 regardless of size.
      const s = await sample(addButton);
      expect(s.surface, 'Add blank MSEL icon: no painted background found').not.toBeNull();
      const ratio = contrastRatio(s.color, s.surface!);
      expect(
        ratio,
        `${theme}: "Add blank MSEL" icon contrast ${ratio.toFixed(2)}:1 ` +
          `(${s.color} on ${s.surface}) must be >= 3:1 (WCAG 1.4.11)`
      ).toBeGreaterThanOrEqual(3);
    });

    // Colors design spec §3–§4: the top bar keeps the same colors in both modes,
    // and `primary` / `on-primary` take the active mode's settings verbatim (dark
    // falls back to light when its key is absent). Nothing is derived or corrected.
    test('Color settings applied per theme (design spec)', async ({ blueprintAuthenticatedPage: page }) => {
      await applyBlueprintTheme(page, theme);
      await gotoBuild(page);

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
      const toolbar = page.locator('mat-toolbar.toolbar');
      await expect(toolbar).toHaveCSS('background-color', hexToRgb(settings.AppTopBarHexColor!));
      await expect(toolbar).toHaveCSS('color', hexToRgb(settings.AppTopBarHexTextColor!));

      // Material primary roles: the active mode's pair, verbatim.
      expect(await cssVar(page, '--mat-sys-primary'), `${theme}: --mat-sys-primary`).toBe(
        expectedPrimary.toUpperCase()
      );
      expect(await cssVar(page, '--mat-sys-on-primary'), `${theme}: --mat-sys-on-primary`).toBe(
        expectedOnPrimary.toUpperCase()
      );
    });

    // Colors design spec §3b checks 1 and 3 (WCAG 1.4.3): `primary` used as text on
    // the surface (the outlined Cancel label) and `on-primary` on a filled `primary`
    // button (Save) must each reach 4.5:1. Uses Admin → Units "Add Unit" without saving.
    test('Primary and on-primary text contrast (WCAG 1.4.3)', async ({ blueprintAuthenticatedPage: page }) => {
      await applyBlueprintTheme(page, theme);
      await page.goto(`${Services.Blueprint.UI}/admin`, { waitUntil: 'domcontentloaded' });

      const unitsNav = page.getByText('Units', { exact: true }).first();
      await expect(unitsNav).toBeVisible({ timeout: 15000 });
      await unitsNav.click();

      const addButton = page.getByRole('button', { name: 'Add Unit' });
      await expect(addButton).toBeVisible({ timeout: 10000 });
      await addButton.click();

      const dialog = page.getByRole('dialog', { name: 'Add Unit' });
      await expect(dialog).toBeVisible({ timeout: 10000 });

      // Save stays disabled (and greyed) until Name and Short Name are valid; fill
      // them so the button renders in its enabled filled-primary state. The unit is
      // only POSTed on Save, and this test never clicks it.
      await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Contrast probe');
      await dialog.getByRole('textbox', { name: 'Short Name' }).fill('CPRB');
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

      await cancelButton.click();
      await expect(dialog).toBeHidden();
    });
  });
}
