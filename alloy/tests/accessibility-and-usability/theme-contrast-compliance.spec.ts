// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect, Locator, Page } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import { ALLOY_THEMES, applyAlloyTheme } from '../../test-helpers';

/**
 * Accessibility and Usability — real WCAG contrast on the Alloy admin surface, in
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
 * no table rows (it measures the always-present heading, column headers, the
 * "Add Event Template" button, and an unsaved create dialog), so it needs no cleanup.
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
 * The effective color settings, layered the way `ComnSettingsService` layers them:
 * `settings.json`, then `settings.shared.json`, then `settings.env.json`. The color
 * keys are all top-level, so a shallow merge is enough. A missing overlay is skipped.
 */
async function effectiveColorSettings(page: Page): Promise<ColorSettings> {
  return page.evaluate(async () => {
    const merged: Record<string, unknown> = {};
    for (const file of ['settings.json', 'settings.shared.json', 'settings.env.json']) {
      const res = await fetch(`/assets/config/${file}`, { cache: 'no-store' });
      if (res.ok) Object.assign(merged, await res.json());
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

for (const theme of ALLOY_THEMES) {
  test.describe(`${theme} theme › Accessibility and Usability`, () => {
    // WCAG 1.4.3 — text contrast. Passes in both themes today.
    test('Theme Contrast Compliance (WCAG 1.4.3 text)', async ({ page }: { page: Page }) => {
      await authenticateWithKeycloak(page, Services.Alloy.UI);
      await applyAlloyTheme(page, theme);

      // Sanity: we are actually measuring the theme we asked for.
      const isDark = await page.evaluate(() => document.body.classList.contains('darkMode'));
      expect(isDark, `expected ${theme} theme to be active`).toBe(theme === 'dark');

      await page.goto(`${Services.Alloy.UI}/admin`);
      const heading = page.getByRole('heading', { name: 'Administration' });
      await expect(heading).toBeVisible();
      await expect(page.getByRole('table')).toBeVisible();

      // 1. Page heading text against the page surface.
      await assertReadable(heading, `${theme}: Administration heading`);

      // 2. A table column header — always present regardless of how many rows exist.
      const columnHeader = page.getByRole('columnheader').first();
      await expect(columnHeader).toBeVisible();
      await assertReadable(columnHeader, `${theme}: table column header`);

      // 3. Direction check: dark theme must be light-on-dark, light theme dark-on-light.
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

    // WCAG 1.4.11 — non-text (icon) contrast for the primary action control. The
    // "Add Event Template" mat-icon-button draws its mdi-plus-circle glyph in
    // `--mat-sys-primary`; both themes must keep it >= 3:1 against the surface it
    // sits on. Threshold stays generic: `primary` comes from each mode's configured
    // setting, so don't hardcode a specific hex.
    test('Primary action icon contrast (WCAG 1.4.11)', async ({ page }: { page: Page }) => {
      await authenticateWithKeycloak(page, Services.Alloy.UI);
      await applyAlloyTheme(page, theme);
      await page.goto(`${Services.Alloy.UI}/admin`);
      await expect(page.getByRole('table')).toBeVisible();

      const addButton = page.getByRole('button', { name: 'Add Event Template' });
      await expect(addButton).toBeVisible();

      // Non-text contrast bar is a flat 3:1 regardless of size.
      const s = await sample(addButton);
      expect(s.surface, 'Add Event Template icon: no painted background found').not.toBeNull();
      const ratio = contrastRatio(s.color, s.surface!);
      expect(
        ratio,
        `${theme}: "Add Event Template" icon contrast ${ratio.toFixed(2)}:1 ` +
          `(${s.color} on ${s.surface}) must be >= 3:1 (WCAG 1.4.11)`
      ).toBeGreaterThanOrEqual(3);
    });

    // Colors design spec §3–§4: the top bar keeps the same colors in both modes,
    // and `primary` / `on-primary` take the active mode's settings verbatim (dark
    // falls back to light when its key is absent). Nothing is derived or corrected.
    test('Color settings applied per theme (design spec)', async ({ page }: { page: Page }) => {
      await authenticateWithKeycloak(page, Services.Alloy.UI);
      await applyAlloyTheme(page, theme);
      await page.goto(`${Services.Alloy.UI}/admin`);
      await expect(page.getByRole('table')).toBeVisible();

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
      expect(await cssVar(page, '--app-topbar-background')).toBe(settings.AppTopBarHexColor!.toUpperCase());
      expect(await cssVar(page, '--app-topbar-text')).toBe(settings.AppTopBarHexTextColor!.toUpperCase());
      const toolbar = page.locator('mat-toolbar.toolbar');
      await expect(toolbar).toHaveCSS('background-color', hexToRgb(settings.AppTopBarHexColor!));

      // Material primary roles: the active mode's pair, verbatim.
      expect(await cssVar(page, '--mat-sys-primary'), `${theme}: --mat-sys-primary`).toBe(
        expectedPrimary.toUpperCase()
      );
      expect(await cssVar(page, '--mat-sys-on-primary'), `${theme}: --mat-sys-on-primary`).toBe(
        expectedOnPrimary.toUpperCase()
      );
    });

    // Colors design spec §3b checks 1 and 3 (WCAG 1.4.3): `primary` used as text on
    // the surface (a text/outlined button label) and `on-primary` on a filled
    // `primary` button must each reach 4.5:1. Uses the create dialog without saving.
    test('Primary and on-primary text contrast (WCAG 1.4.3)', async ({ page }: { page: Page }) => {
      await authenticateWithKeycloak(page, Services.Alloy.UI);
      await applyAlloyTheme(page, theme);
      await page.goto(`${Services.Alloy.UI}/admin`);
      await expect(page.getByRole('table')).toBeVisible();

      const createDialog = page.getByRole('dialog', { name: 'Create New Event Template' });
      await page.getByRole('button', { name: 'Add Event Template' }).click();
      await expect(createDialog).toBeVisible();

      // Save stays disabled (and greyed) until the required fields are filled; fill
      // them so the button renders in its enabled filled-primary state. Nothing is
      // POSTed until Save is clicked, and this test never clicks it.
      await createDialog.getByRole('textbox', { name: /^Name/ }).fill('Contrast probe');
      await createDialog.getByRole('spinbutton', { name: 'Duration Hours' }).fill('1');
      const saveButton = createDialog.getByRole('button', { name: 'Save' });
      await expect(saveButton).toBeEnabled();

      // `on-primary` label on the filled `primary` Save button.
      const primary = await cssVar(page, '--mat-sys-primary');
      await expect(saveButton).toHaveCSS('background-color', hexToRgb(primary));
      await assertReadable(saveButton, `${theme}: filled Save button label`);

      // `primary` used as text on the dialog surface.
      const cancelButton = createDialog.getByRole('button', { name: 'Cancel' });
      await expect(cancelButton).toHaveCSS('color', hexToRgb(primary));
      await assertReadable(cancelButton, `${theme}: Cancel button label`);

      await cancelButton.click();
      await expect(createDialog).toBeHidden();
    });
  });
}
