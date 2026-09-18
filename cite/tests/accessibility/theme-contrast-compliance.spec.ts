// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Locator, Page, Services } from '../../fixtures';
import { CITE_THEMES, applyCiteTheme } from '../../test-helpers';

/**
 * Accessibility — real WCAG contrast on the CITE admin surface, in both themes.
 *
 * The sibling accessibility specs verify keyboard navigation, focus management,
 * and ARIA labels, but they never measure actual painted colours. This spec
 * closes that gap: it samples the colours the app renders and checks each
 * foreground / background pair against WCAG 2.1 AA 1.4.3 (normal text >= 4.5:1,
 * large text >= 3:1) and 1.4.11 (non-text >= 3:1), once per theme.
 *
 * Read-only: it navigates and reads computed styles, seeds nothing, and depends
 * on no table rows (it measures the always-present heading, column headers, and
 * action buttons), so it needs no cleanup.
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

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Accessibility`, () => {
    // WCAG 1.4.3 — text contrast.
    test('Theme Contrast Compliance (WCAG 1.4.3 text)', async ({ citeAuthenticatedPage: page }: { page: Page }) => {
      await applyCiteTheme(page, theme);

      // Sanity: we are actually measuring the theme we asked for.
      const isDark = await page.evaluate(() => document.body.classList.contains('darkMode'));
      expect(isDark, `expected ${theme} theme to be active`).toBe(theme === 'dark');

      await page.goto(`${Services.Cite.UI}/admin`);
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

    // WCAG 1.4.11 — non-text (icon) contrast for the primary action control.
    test('Primary action icon contrast (WCAG 1.4.11)', async ({ citeAuthenticatedPage: page }: { page: Page }) => {
      await applyCiteTheme(page, theme);
      await page.goto(`${Services.Cite.UI}/admin`);
      await expect(page.getByRole('table')).toBeVisible();

      // The "Add Evaluation" mat-icon-button draws its icon in the brand accent
      // colour; both themes must keep it >= 3:1 against the surface it sits on.
      const addButton = page.getByRole('button', { name: 'Add Evaluation' });
      await expect(addButton).toBeVisible();

      // Non-text contrast bar is a flat 3:1 regardless of size.
      const s = await sample(addButton);
      expect(s.surface, 'Add Evaluation icon: no painted background found').not.toBeNull();
      const ratio = contrastRatio(s.color, s.surface!);
      expect(
        ratio,
        `${theme}: "Add Evaluation" icon contrast ${ratio.toFixed(2)}:1 ` +
          `(${s.color} on ${s.surface}) must be >= 3:1 (WCAG 1.4.11)`
      ).toBeGreaterThanOrEqual(3);
    });
  });
}
