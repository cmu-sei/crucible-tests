// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.setup.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Accessibility', () => {
  test('Keyboard Navigation - Tab Order', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to home page - already authenticated via fixture
    // Wait for the page to be fully loaded and interactive
    await page.waitForLoadState('networkidle');

    // Wait for CITE-specific content to be visible (the "My Evaluations" heading)
    await expect(page.locator('text=My Evaluations')).toBeVisible({ timeout: 10000 });

    // Wait a bit for the page to fully render and become interactive
    await page.waitForTimeout(1000);

    // 2. Press Tab key repeatedly to navigate through interactive elements
    const focusedElements: string[] = [];
    let foundInteractiveElements = 0;

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300);

      // expect: Focus moves through elements in logical order
      // expect: All interactive elements are reachable
      const focusInfo = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return { tag: 'NONE', text: '' };

        const tag = el.tagName;
        const text = (el.textContent || '').substring(0, 50).trim();
        const role = el.getAttribute('role') || '';
        const type = el.getAttribute('type') || '';

        return { tag, text, role, type };
      });

      focusedElements.push(`${focusInfo.tag}${focusInfo.role ? `[${focusInfo.role}]` : ''}${focusInfo.type ? `[${focusInfo.type}]` : ''}`);

      // Count interactive elements (not BODY or HTML)
      if (!['BODY', 'HTML'].includes(focusInfo.tag)) {
        foundInteractiveElements++;
      }
    }

    // Log the focus order for debugging
    console.log('Focus order:', focusedElements.join(' -> '));

    // Expect that we found at least 5 interactive elements during our tab navigation
    // This validates that keyboard navigation is working and elements are reachable
    expect(foundInteractiveElements).toBeGreaterThanOrEqual(5);
  });
});
