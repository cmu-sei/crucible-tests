// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Accessibility and Usability', () => {
  test('Responsive Layout - Tablet View', async ({ page }) => {
    // 1. Resize browser to tablet viewport (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await authenticateWithKeycloak(page, Services.Alloy.UI);

    // expect: Page layout adapts to tablet view
    await expect(page.getByText('My Events')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // 2. Navigate through the application
    await page.goto(`${Services.Alloy.UI}/admin`);

    // expect: All features remain accessible
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // expect: Sidebar and navigation work appropriately
    await expect(page.getByRole('link', { name: 'Event Templates' })).toBeVisible();
    await expect(page.locator('mat-list').getByText('Events')).toBeVisible();
  });
});
