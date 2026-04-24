// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Performance', () => {
  test('Page Load Performance - Evaluation Dashboard', async ({ citeAuthenticatedPage: page }) => {

    // Navigate to home first
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    // 1. Measure time from navigation to admin dashboard until page is interactive
    const startTime = Date.now();
    const adminButton = page.getByRole('button', { name: 'Show Administration Page' });
    await expect(adminButton).toBeVisible({ timeout: 10000 });
    await adminButton.click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    const content = page.locator('mat-toolbar-row').getByText('Evaluations');
    await expect(content).toBeVisible({ timeout: 10000 });

    const loadTime = Date.now() - startTime;

    // expect: Dashboard loads within acceptable time
    expect(loadTime).toBeLessThan(10000);
  });
});
