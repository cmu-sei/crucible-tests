// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import { test, expect, Locator, Page, Services } from '../../fixtures';
import { getFirstViewId } from '../../fixtures';
import { PLAYERVM_THEMES, applyPlayerVmTheme } from '../../test-helpers';

/**
 * Accessibility — real WCAG contrast on the PlayerVm Map surface, in both themes.
 *
 * Samples the colours the app actually paints and checks each foreground /
 * background pair against WCAG 2.1 AA 1.4.3 (normal text >= 4.5:1, large text >= 3:1),
 * once per theme.
 *
 * Read-only: it navigates and reads computed styles, seeds nothing, and depends on
 * the first view having either a map or the "No Map is assigned" state, so it needs
 * no cleanup.
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

for (const theme of PLAYERVM_THEMES) {
  test.describe(`${theme} theme › Accessibility`, () => {
    // WCAG 1.4.3 — text contrast.
    test('Theme Contrast Compliance (WCAG 1.4.3 text)', async ({
      playerVmAuthenticatedPage: page,
    }: {
      playerVmAuthenticatedPage: Page;
    }) => {
      await applyPlayerVmTheme(page, theme);

      // Sanity: we are actually measuring the theme we asked for.
      const isDark = await page.evaluate(() => document.body.classList.contains('darkMode'));
      expect(isDark, `expected ${theme} theme to be active`).toBe(theme === 'dark');

      // Navigate to the Map application for the first view.
      const viewId = await getFirstViewId(page);
      test.skip(!viewId, 'No views available to test contrast against');

      await page.goto(`${Services.PlayerVM.UI}/views/${viewId}/map`);

      // Wait for the page to settle into one of its known states. The page may
      // show either "View Not Found", "No Map is assigned to this Team", or a
      // rendered map. For contrast measurement, we'll check whatever is visible.
      const viewNotFound = page.getByRole('heading', { name: 'View Not Found' });
      const noMap = page.getByRole('heading', { name: 'No Map is assigned to this Team' });
      const newMapButton = page.getByRole('button', { name: 'New Map' });

      await expect(async () => {
        const hasViewNotFound = await viewNotFound.isVisible();
        const hasNoMap = await noMap.isVisible();
        const hasMapControls = await newMapButton.isVisible();
        expect(hasViewNotFound || hasNoMap || hasMapControls).toBeTruthy();
      }).toPass({ timeout: 30000 });

      // 1. Measure a heading — whichever state we landed in, there's a heading.
      let heading: Locator;
      if (await viewNotFound.isVisible()) {
        heading = viewNotFound;
      } else if (await noMap.isVisible()) {
        heading = noMap;
      } else {
        // If map controls are present but no heading, find any visible heading
        heading = page.locator('h1, h2, h3').first();
      }
      await expect(heading).toBeVisible();
      await assertReadable(heading, `${theme}: page heading`);

      // 2. Direction check: dark theme = light text on darker surface; light theme = the reverse.
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

    // WCAG 1.4.11 — non-text (icon/button) contrast for a primary action control.
    test('Primary action button contrast (WCAG 1.4.11)', async ({
      playerVmAuthenticatedPage: page,
    }: {
      playerVmAuthenticatedPage: Page;
    }) => {
      await applyPlayerVmTheme(page, theme);

      const viewId = await getFirstViewId(page);
      test.skip(!viewId, 'No views available to test contrast against');

      await page.goto(`${Services.PlayerVM.UI}/views/${viewId}/map`);

      // Wait for the New Map button to appear (if the user has edit rights).
      // If it doesn't appear, skip this test for this environment.
      const newMapButton = page.getByRole('button', { name: 'New Map' });
      try {
        await newMapButton.waitFor({ state: 'visible', timeout: 30000 });
      } catch {
        test.skip(true, 'No editable view available to test button contrast');
      }

      // Non-text contrast bar is a flat 3:1 regardless of size.
      const s = await sample(newMapButton);
      expect(s.surface, 'New Map button: no painted background found').not.toBeNull();
      const ratio = contrastRatio(s.color, s.surface!);
      expect(
        ratio,
        `${theme}: "New Map" button contrast ${ratio.toFixed(2)}:1 ` +
          `(${s.color} on ${s.surface}) must be >= 3:1 (WCAG 1.4.11)`
      ).toBeGreaterThanOrEqual(3);
    });
  });
}
