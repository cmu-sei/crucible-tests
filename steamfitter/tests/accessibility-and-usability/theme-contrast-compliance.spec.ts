// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Locator, Page } from '@playwright/test';
import { Services } from '../../../shared-fixtures';
import { authenticateSteamfitterWithKeycloak } from '../../fixtures';
import { STEAMFITTER_THEMES, applySteamfitterTheme, navigateToHomeSection } from '../../test-helpers';

/**
 * Accessibility and Usability — real WCAG contrast on the Steamfitter home surface,
 * in both themes.
 *
 * This spec samples the colours the app actually paints and checks each foreground /
 * background pair against WCAG 2.1 AA 1.4.3 (normal text >= 4.5:1, large text >= 3:1),
 * once per theme. It also validates WCAG 2.1 AA 1.4.11 (non-text contrast >= 3:1) for
 * the primary action button.
 *
 * Read-only: it navigates and reads computed styles, seeds nothing, and depends on
 * always-present elements (heading, column headers, Add button), so it needs no cleanup.
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

for (const theme of STEAMFITTER_THEMES) {
  test.describe(`${theme} theme › Accessibility and Usability`, () => {
    // WCAG 1.4.3 — text contrast. Validates heading and table column header contrast.
    test('Theme Contrast Compliance (WCAG 1.4.3 text)', async ({ page }: { page: Page }) => {
      await page.goto(Services.Steamfitter.UI);
      await authenticateSteamfitterWithKeycloak(page);
      await applySteamfitterTheme(page, theme);

      // Sanity: we are actually measuring the theme we asked for.
      const isDark = await page.evaluate(() => document.body.classList.contains('darkMode'));
      expect(isDark, `expected ${theme} theme to be active`).toBe(theme === 'dark');

      // Navigate to Scenario Templates home section (the default landing page)
      await navigateToHomeSection(page, 'Scenario Templates');

      // 1. The section menu trigger button — always present, top-level navigation
      const sectionTrigger = page.locator('button.section-menu-trigger');
      await expect(sectionTrigger).toBeVisible({ timeout: 10000 });
      await assertReadable(sectionTrigger, `${theme}: section menu trigger`);

      // 2. A table column header — always present regardless of how many rows exist
      const columnHeader = page.getByRole('columnheader', { name: 'Name' });
      await expect(columnHeader).toBeVisible();
      await assertReadable(columnHeader, `${theme}: table column header`);

      // 3. Direction check: dark theme must be light-on-dark, light theme dark-on-light
      const triggerSample = await sample(sectionTrigger);
      if (theme === 'dark') {
        expect(
          luminance(triggerSample.color),
          'dark theme should render light text on a darker surface'
        ).toBeGreaterThan(luminance(triggerSample.surface!));
      } else {
        expect(
          luminance(triggerSample.color),
          'light theme should render dark text on a lighter surface'
        ).toBeLessThan(luminance(triggerSample.surface!));
      }
    });

    // WCAG 1.4.11 — non-text (icon) contrast for the primary action control. The
    // "Add Scenario Template" button's icon must clear 3:1 against the surface it
    // sits on. Threshold stays generic — accent is derived from brand colour.
    test('Primary action icon contrast (WCAG 1.4.11)', async ({ page }: { page: Page }) => {
      await page.goto(Services.Steamfitter.UI);
      await authenticateSteamfitterWithKeycloak(page);
      await applySteamfitterTheme(page, theme);
      await navigateToHomeSection(page, 'Scenario Templates');

      const addButton = page.locator('button[title="Add Scenario Template"]');
      await expect(addButton).toBeVisible({ timeout: 10000 });

      // Non-text contrast bar is a flat 3:1 regardless of size.
      const s = await sample(addButton);
      expect(s.surface, 'Add Scenario Template icon: no painted background found').not.toBeNull();
      const ratio = contrastRatio(s.color, s.surface!);
      expect(
        ratio,
        `${theme}: "Add Scenario Template" icon contrast ${ratio.toFixed(2)}:1 ` +
          `(${s.color} on ${s.surface}) must be >= 3:1 (WCAG 1.4.11)`
      ).toBeGreaterThanOrEqual(3);
    });
  });
}
