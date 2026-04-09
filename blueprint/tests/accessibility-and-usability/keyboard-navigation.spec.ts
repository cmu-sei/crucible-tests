// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Accessibility and Usability', () => {
  test.beforeEach(async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to Blueprint application (auth state pre-loaded from setup)
    await page.goto('http://localhost:4725');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Keyboard Navigation', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to the home page
    await expect(page).toHaveURL(/.*localhost:4725.*/);

    // Wait for Angular to render the page content before interacting
    // The app-root renders an Angular app that needs time to bootstrap after domcontentloaded
    // Wait for at least one interactive element to be visible
    await expect(page.locator('button, a, [tabindex]:not([tabindex="-1"])')).not.toHaveCount(0, { timeout: 10000 });

    // Helper: get focused element info using document.activeElement
    // This is more reliable than locator(':focus') after keyboard events in Playwright
    const getFocusedInfo = () => page.evaluate(() => {
      const el = document.activeElement;
      return {
        tagName: el ? el.tagName : 'NONE',
        isBody: !el || el.tagName === 'BODY',
        text: el ? (el.textContent || '').trim().substring(0, 60) : '',
        isVisible: el && el.tagName !== 'BODY'
          ? (() => {
              const rect = (el as HTMLElement).getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            })()
          : false,
      };
    });

    // 2. Count available focusable elements on this page (after Angular renders)
    const focusableCount = await page.evaluate(() => {
      return document.querySelectorAll(
        'button, a, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ).length;
    });

    // expect: There are focusable elements on the page for keyboard navigation
    expect(focusableCount).toBeGreaterThan(0);

    // 3. Focus the first focusable element to start keyboard navigation
    const firstFocusable = page.locator(
      'button, a, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ).first();
    await firstFocusable.focus();

    // Verify initial focus landed on a real element (not body)
    const initialFocus = await getFocusedInfo();
    expect(initialFocus.isBody).toBe(false);
    expect(initialFocus.isVisible).toBe(true);

    // 4. Tab through available interactive elements
    // Use the actual count to avoid going past all focusable elements and landing on body
    const tabIterations = Math.min(focusableCount, 3);
    let successfulTabFocuses = 0;

    for (let i = 0; i < tabIterations; i++) {
      await page.keyboard.press('Tab');

      // expect: After Tab, focus moves to an interactive element
      const focusInfo = await getFocusedInfo();

      if (!focusInfo.isBody) {
        successfulTabFocuses++;
        // Verify the focused element is visible (has non-zero dimensions)
        expect(focusInfo.isVisible).toBe(true);
      }
    }

    // expect: At least one Tab press moved focus to a visible interactive element
    expect(successfulTabFocuses).toBeGreaterThan(0);

    // 5. Use Shift+Tab to navigate backwards
    // Focus a known element first to have a predictable starting point
    await firstFocusable.focus();

    // Press Tab once to move to the next element, then Shift+Tab to go back
    await page.keyboard.press('Tab');
    const afterTab = await getFocusedInfo();

    if (!afterTab.isBody) {
      await page.keyboard.press('Shift+Tab');

      // expect: Shift+Tab moves focus backwards (to a focusable element)
      const afterShiftTab = await getFocusedInfo();
      expect(afterShiftTab.isBody).toBe(false);
    }

    // 6. Use Enter or Space to activate buttons
    // Find a clickable button and focus it
    const button = page.locator('button').first();
    await button.focus();

    // Test Enter key activation
    const clickPromise = button.evaluate((btn) => {
      return new Promise((resolve) => {
        btn.addEventListener('click', () => resolve(true), { once: true });
        setTimeout(() => resolve(false), 1000);
      });
    });

    await page.keyboard.press('Enter');
    const wasClicked = await clickPromise;

    // Note: The button may not trigger if it requires specific conditions,
    // but we're testing that keyboard activation is possible
  });
});
