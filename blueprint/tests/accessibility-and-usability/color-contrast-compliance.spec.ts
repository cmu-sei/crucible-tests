// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern } from '../../fixtures';

test.describe('Accessibility and Usability', () => {
  test.beforeEach(async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to Blueprint application (auth state pre-loaded from setup)
    await page.goto(Services.Blueprint.UI);
    await page.waitForLoadState('domcontentloaded');
  });

  test('Color Contrast Compliance', async ({ blueprintAuthenticatedPage: page }) => {
    // Helper function to calculate relative luminance
    const getRelativeLuminance = (rgb: number[]): number => {
      const [r, g, b] = rgb.map((val) => {
        val = val / 255;
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    // Helper function to calculate contrast ratio
    const getContrastRatio = (rgb1: number[], rgb2: number[]): number => {
      const l1 = getRelativeLuminance(rgb1);
      const l2 = getRelativeLuminance(rgb2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    };

    // Helper function to parse RGB color
    const parseRgb = (color: string): number[] => {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [0, 0, 0];
    };

    // Helper to check if a color is transparent (alpha = 0)
    const isTransparent = (color: string): boolean => {
      // rgba(r, g, b, 0) is fully transparent
      return /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)/.test(color);
    };

    // 1. Navigate through different pages and components
    await expect(page).toHaveURL(serviceUrlPattern(Services.Blueprint.UI));

    // 2. Check text color contrast against backgrounds
    // Check topbar contrast (#2d69b4 background with white text)
    const topbar = await page.locator('mat-toolbar, [role="banner"], header').first();
    if (await topbar.count() > 0) {
      const topbarBg = await topbar.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      const topbarColor = await topbar.evaluate((el) => {
        return window.getComputedStyle(el).color;
      });

      const bgRgb = parseRgb(topbarBg);
      const colorRgb = parseRgb(topbarColor);
      const contrastRatio = getContrastRatio(bgRgb, colorRgb);

      // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
      expect(contrastRatio).toBeGreaterThanOrEqual(3.0);
    }

    // Check body text contrast using the main application content container.
    // The body element itself may have a transparent background (rgba(0,0,0,0)),
    // so we look for the first element with an actual (non-transparent) background color.
    const bodyContrastRatio = await page.evaluate(() => {
      const getRelativeLuminance = (rgb: number[]): number => {
        const [r, g, b] = rgb.map((val) => {
          val = val / 255;
          return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };

      const getContrastRatio = (rgb1: number[], rgb2: number[]): number => {
        const l1 = getRelativeLuminance(rgb1);
        const l2 = getRelativeLuminance(rgb2);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      };

      const parseRgb = (color: string): number[] => {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [0, 0, 0];
      };

      const isTransparent = (color: string): boolean => {
        return /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)/.test(color);
      };

      // Walk through candidate content containers to find one with a real background
      const candidates = [
        '[class*="background"]',
        'mat-sidenav-content',
        '.main-content',
        '#main-content',
        'main',
        '[role="main"]',
        'app-root',
        'body'
      ];

      for (const sel of candidates) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const style = window.getComputedStyle(el);
        const bg = style.backgroundColor;
        const color = style.color;
        // Skip elements with transparent background
        if (isTransparent(bg)) continue;
        const bgRgb = parseRgb(bg);
        const colorRgb = parseRgb(color);
        return getContrastRatio(bgRgb, colorRgb);
      }

      // Fallback: assume white background with body text color
      const bodyStyle = window.getComputedStyle(document.body);
      const bodyColor = parseRgb(bodyStyle.color);
      const whiteBg = [255, 255, 255];
      return getContrastRatio(whiteBg, bodyColor);
    });

    // Body text should meet WCAG AA standard (4.5:1)
    expect(bodyContrastRatio).toBeGreaterThanOrEqual(4.5);

    // Check button contrast
    const buttons = await page.locator('button').all();
    for (const button of buttons.slice(0, 3)) { // Check first 3 buttons
      const isVisible = await button.isVisible().catch(() => false);
      if (!isVisible) continue;

      const btnBg = await button.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      const btnColor = await button.evaluate((el) => {
        return window.getComputedStyle(el).color;
      });

      const btnBgRgb = parseRgb(btnBg);
      const btnColorRgb = parseRgb(btnColor);

      // Skip if background is transparent
      if (btnBg.includes('rgba') && btnBg.includes('0)')) continue;

      const btnContrastRatio = getContrastRatio(btnBgRgb, btnColorRgb);

      // Buttons should meet WCAG AA standard
      expect(btnContrastRatio).toBeGreaterThanOrEqual(3.0);
    }

    // Check link contrast - only check links that contain visible text content
    const links = await page.locator('a').all();
    for (const link of links.slice(0, 5)) { // Check first 5 links
      const isVisible = await link.isVisible().catch(() => false);
      if (!isVisible) continue;

      // Skip links that have no visible text (e.g. icon-only or logo links)
      const linkText = await link.innerText().catch(() => '');
      if (!linkText.trim()) continue;

      const linkColor = await link.evaluate((el) => {
        return window.getComputedStyle(el).color;
      });

      const parentBg = await link.evaluate((el) => {
        let parent = el.parentElement;
        while (parent) {
          const bg = window.getComputedStyle(parent).backgroundColor;
          if (bg && !bg.includes('rgba(0, 0, 0, 0)')) {
            return bg;
          }
          parent = parent.parentElement;
        }
        return 'rgb(255, 255, 255)';
      });

      const linkColorRgb = parseRgb(linkColor);
      const parentBgRgb = parseRgb(parentBg);
      const linkContrastRatio = getContrastRatio(linkColorRgb, parentBgRgb);

      // Links should meet WCAG AA standard
      expect(linkContrastRatio).toBeGreaterThanOrEqual(4.5);
    }

    // Test both light and dark themes.
    //
    // This block used to be gated on
    // `button[aria-label*="theme" i], button[title*="theme" i], button:has-text("Theme")`,
    // which matches **0** elements on the dashboard (measured) -- so the dark-theme contrast
    // assertion below never ran. The real control is a `mat-slide-toggle` labelled "Dark Theme"
    // inside the topbar's user-name menu (topbar.component.html:53-57), so the menu has to be
    // opened first. The assertion itself was sound and is kept, now actually reachable.
    const userMenuTrigger = page.locator('button.menu-trigger').first();
    await expect(userMenuTrigger).toBeVisible({ timeout: 30000 });
    await userMenuTrigger.click();

    const themeToggle = page.getByRole('switch', { name: /dark theme/i });
    await expect(themeToggle).toBeVisible({ timeout: 15000 });

    const readBodyTheme = () => page.evaluate(() => document.body.className);
    const themeBefore = await readBodyTheme();
    await themeToggle.click();

    // Wait for the theme actually to change rather than sleeping for the transition.
    await expect
      .poll(readBodyTheme, {
        timeout: 15000,
        intervals: [100, 200, 500],
        message: 'the body theme class should change after toggling Dark Theme',
      })
      .not.toBe(themeBefore);

    // Close the menu so the overlay does not sit over the content being measured.
    await page.keyboard.press('Escape');

    // Re-check contrast in the new theme.
    //
    // Measured against **real text**, not against a container's own computed `color`. The
    // previous helper walked a candidate list and returned
    // `getContrastRatio(backgroundColor, color)` for the first element with a non-transparent
    // background -- on this page that is `[class*="background"]`, whose `ownText` is false and
    // whose inherited `color` is `rgb(0,0,0)` even though it renders no text. That produced a
    // spurious **1.61:1** and would have reported a WCAG failure that does not exist. Every
    // element that actually renders text passes: measured 5.54 (Event Dashboard / Admin User on
    // the toolbar), 10.04 and 11.84 (card title/subtitle). So the fix is the metric, not the app.
    //
    // Each text-bearing element is compared against its *effective* backdrop, found by walking
    // ancestors until a non-transparent background is reached.
    const worstContrast = await page.evaluate(() => {
      const luminance = (rgb: number[]): number => {
        const [r, g, b] = rgb.map((v) => {
          v = v / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const ratio = (a: number[], b: number[]): number => {
        const l1 = luminance(a);
        const l2 = luminance(b);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };
      const parseRgb = (color: string): number[] => {
        const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : [0, 0, 0];
      };
      const isTransparent = (color: string): boolean =>
        /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)/.test(color) || color === 'transparent';
      const backdropOf = (el: Element): string => {
        let cur: Element | null = el;
        while (cur) {
          const bg = window.getComputedStyle(cur).backgroundColor;
          if (!isTransparent(bg)) return bg;
          cur = cur.parentElement;
        }
        return 'rgb(255, 255, 255)';
      };

      let worst = Number.POSITIVE_INFINITY;
      let sampled = 0;
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        // Only elements with their own rendered text: a container's `color` is meaningless if
        // no text node uses it.
        const ownsText = Array.from(el.childNodes).some(
          (n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 1
        );
        if (!ownsText) continue;
        const box = el.getBoundingClientRect();
        if (box.width < 2 || box.height < 2) continue;
        const style = window.getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) {
          continue;
        }
        sampled++;
        worst = Math.min(worst, ratio(parseRgb(style.color), parseRgb(backdropOf(el))));
      }
      return { worst: sampled > 0 ? worst : null, sampled };
    });

    // expect: text was actually found, so the assertion below is not vacuous.
    expect(worstContrast.sampled, 'dark theme should render some measurable text').toBeGreaterThan(0);

    // expect: every text element meets WCAG AA 4.5:1 in dark theme.
    expect(
      worstContrast.worst,
      `worst dark-theme contrast across ${worstContrast.sampled} text element(s)`
    ).toBeGreaterThanOrEqual(4.5);
  });
});
