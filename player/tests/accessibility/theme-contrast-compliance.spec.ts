// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Locator, Page } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import { PLAYER_THEMES, applyPlayerTheme } from '../../fixtures';

/**
 * Accessibility — real WCAG contrast on the Player home surface, in both themes.
 *
 * The sibling `color-contrast.spec.ts` only asserts that content stays *visible*
 * after switching to dark mode; it never measures a contrast ratio, so a theme that
 * rendered dark-grey-on-black would still pass it. This spec closes that gap: it
 * samples the colours the app actually paints and checks each foreground / background
 * pair against WCAG 2.1 AA 1.4.3 (normal text >= 4.5:1, large text >= 3:1), once per
 * theme.
 *
 * Read-only: it navigates and reads computed styles, seeds nothing, and depends on
 * no table rows (it measures the always-present heading, column headers, and the
 * Menu button), so it needs no cleanup.
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

for (const theme of PLAYER_THEMES) {
  test.describe(`${theme} theme › Accessibility`, () => {
    // WCAG 1.4.3 — text contrast.
    test('Theme Contrast Compliance (WCAG 1.4.3 text)', async ({ page }: { page: Page }) => {
      await authenticateWithKeycloak(page, Services.Player.UI);
      await applyPlayerTheme(page, theme);

      // Sanity: we are actually measuring the theme we asked for.
      const isDark = await page.evaluate(() => document.body.classList.contains('darkMode'));
      expect(isDark, `expected ${theme} theme to be active`).toBe(theme === 'dark');

      await page.goto(Services.Player.UI);
      const heading = page.getByText('My Views');
      await expect(heading).toBeVisible();
      await expect(page.getByRole('table')).toBeVisible();

      // 1. "My Views" heading text against the page surface.
      await assertReadable(heading, `${theme}: My Views heading`);

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
    // Menu button (which contains an icon) must maintain >= 3:1 contrast against
    // its surface in both themes.
    test('Primary action button contrast (WCAG 1.4.11)', async ({ page }: { page: Page }) => {
      await authenticateWithKeycloak(page, Services.Player.UI);
      await applyPlayerTheme(page, theme);
      await page.goto(Services.Player.UI);
      await expect(page.getByRole('table')).toBeVisible();

      const menuButton = page.getByRole('button', { name: 'Menu' });
      await expect(menuButton).toBeVisible();

      // Non-text contrast bar is a flat 3:1 regardless of size.
      const s = await sample(menuButton);
      expect(s.surface, 'Menu button: no painted background found').not.toBeNull();
      const ratio = contrastRatio(s.color, s.surface!);
      expect(
        ratio,
        `${theme}: Menu button contrast ${ratio.toFixed(2)}:1 ` +
          `(${s.color} on ${s.surface}) must be >= 3:1 (WCAG 1.4.11)`
      ).toBeGreaterThanOrEqual(3);
    });
  });
}
