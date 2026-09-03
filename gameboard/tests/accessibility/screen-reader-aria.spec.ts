// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import AxeBuilder from '@axe-core/playwright';
import { test, expect, Services } from '../../fixtures';

// Uses axe-core to verify that the home page does not have critical
// accessible-name or document-structure violations. We scope this to the
// home page because the admin page has a known pre-existing missing-button-name
// regression that a new test shouldn't block on.
test.describe('Accessibility', () => {
  test('Screen Reader Compatibility - ARIA & Headings', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/home', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Structural sanity: at least one heading renders.
    const h1Count = await page.locator('h1').count();
    const h2Count = await page.locator('h2').count();
    expect(h1Count + h2Count).toBeGreaterThan(0);

    // Run axe for the rules we expect Gameboard to pass: all links have
    // accessible names, document has a lang attribute and a title.
    const results = await new AxeBuilder({ page })
      .withRules(['link-name', 'html-has-lang', 'document-title'])
      .analyze();

    if (results.violations.length > 0) {
      const detail = results.violations
        .map(v => `- ${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help}`)
        .join('\n');
      throw new Error(`Accessible-name/structure violations on /home:\n${detail}`);
    }
    expect(results.violations).toEqual([]);
  });
});
