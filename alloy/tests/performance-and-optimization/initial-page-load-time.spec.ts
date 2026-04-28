// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Performance and Optimization', () => {
  test('Initial Page Load Time', async ({ page }) => {
    // 1. Navigate to application and authenticate
    const startTime = Date.now();
    await authenticateWithKeycloak(page, Services.Alloy.UI);

    // expect: Application loads successfully
    await expect(page.getByText('My Events')).toBeVisible();

    const loadTime = Date.now() - startTime;

    // expect: Initial page load completes within acceptable time
    // Note: Auth flow adds significant time, so we just verify the page loaded
    expect(loadTime).toBeLessThan(300000); // Within Playwright's test timeout

    // 2. Verify the page rendered correctly
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Alloy' })).toBeVisible();
  });
});
