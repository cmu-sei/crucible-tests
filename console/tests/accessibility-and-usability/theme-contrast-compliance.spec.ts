// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: console/console-test-plan.md
// seed: seed.spec.ts

import { test, expect, Locator, Page } from '@playwright/test';
import { Services } from '../../../shared-fixtures';
import { CONSOLE_THEMES, applyConsoleTheme } from '../../test-helpers';
import { getFirstVmId } from '../../fixtures';

/**
 * Accessibility and Usability — real WCAG contrast on the Console UI surfaces, in
 * both themes.
 *
 * This spec samples the colours the app actually paints and checks each foreground /
 * background pair against WCAG 2.1 AA 1.4.3 (normal text >= 4.5:1, large text >= 3:1),
 * once per theme.
 *
 * Read-only: it navigates and reads computed styles, seeds nothing, and depends on
 * always-present elements (VM Not Found heading, options bar gear icon).
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

const INVALID_VM_ID = '00000000-0000-0000-0000-000000000000';

for (const theme of CONSOLE_THEMES) {
  test.describe(`${theme} theme › Accessibility and Usability`, () => {
    // WCAG 1.4.3 — text contrast on the VM Not Found page.
    test('Theme Contrast Compliance (WCAG 1.4.3 text)', async ({
      consoleAuthenticatedPage: page,
    }: {
      consoleAuthenticatedPage: Page;
    }) => {
      await applyConsoleTheme(page, theme);

      // Sanity: we are actually measuring the theme we asked for.
      const isDark = await page.evaluate(() => document.body.classList.contains('darkMode'));
      expect(isDark, `expected ${theme} theme to be active`).toBe(theme === 'dark');

      // Navigate to the VM Not Found page (always present for an invalid VM id).
      await page.goto(`${Services.Console.UI}/vm/${INVALID_VM_ID}/console`);
      const heading = page.getByRole('heading', { name: 'VM Not Found' });
      await expect(heading).toBeVisible({ timeout: 30000 });

      // 1. Page heading text against the page surface.
      await assertReadable(heading, `${theme}: VM Not Found heading`);

      // 2. Body text on the VM Not Found page.
      const bodyText = page.locator('p').first();
      if (await bodyText.isVisible().catch(() => false)) {
        await assertReadable(bodyText, `${theme}: VM Not Found body text`);
      }

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

    // WCAG 1.4.11 — non-text (icon) contrast for the gear icon in the options bar.
    // The gear icon is the primary control for accessing console options including
    // the theme toggle. Both themes must keep it >= 3:1 against the surface it
    // sits on.
    test('Options bar gear icon contrast (WCAG 1.4.11)', async ({
      consoleAuthenticatedPage: page,
    }: {
      consoleAuthenticatedPage: Page;
    }) => {
      await applyConsoleTheme(page, theme);

      // Discover a real VM id and navigate to a live console to access the options bar.
      const vmId = await getFirstVmId(page);
      test.skip(!vmId, 'No VMs available for the admin user to test against');

      await page.goto(`${Services.Console.UI}/vm/${vmId}/console`);

      // The options bar must render with the gear button.
      const gearButton = page
        .locator('button[mat-icon-button]')
        .filter({ has: page.locator('mat-icon[svgicon="gear"]') });
      await expect(gearButton.first()).toBeVisible({ timeout: 30000 });

      // Sample the gear icon's colour. Since it's an SVG icon, we measure the
      // mat-icon element itself rather than the button container.
      const gearIcon = gearButton.first().locator('mat-icon');
      await expect(gearIcon).toBeVisible();

      // Non-text contrast bar is a flat 3:1 regardless of size.
      const s = await sample(gearIcon);
      expect(s.surface, 'gear icon: no painted background found').not.toBeNull();
      const ratio = contrastRatio(s.color, s.surface!);
      expect(
        ratio,
        `${theme}: gear icon contrast ${ratio.toFixed(2)}:1 ` +
          `(${s.color} on ${s.surface}) must be >= 3:1 (WCAG 1.4.11)`
      ).toBeGreaterThanOrEqual(3);
    });
  });
}
