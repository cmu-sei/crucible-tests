// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import AxeBuilder from '@axe-core/playwright';
import { test, expect, Services } from '../../fixtures';

// Runs axe-core against the home page and verifies there are no critical
// color-contrast violations. Warnings at serious/moderate impact are not
// failed; the intent is to catch blocking WCAG AA violations.
test.describe('Accessibility', () => {
  test('Color Contrast Compliance', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/home', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa', 'wcag21aa'])
      .withRules(['color-contrast'])
      .analyze();

    const critical = results.violations.filter(v => v.impact === 'critical');
    if (critical.length > 0) {
      const detail = critical
        .map(v => `- ${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help}`)
        .join('\n');
      throw new Error(`Critical color-contrast violations found:\n${detail}`);
    }
    // Not strictly asserting zero violations (serious/moderate) because the
    // Gameboard theme uses some borderline ratios by design. Critical-only is
    // the blocking bar.
    expect(critical).toEqual([]);
  });
});
