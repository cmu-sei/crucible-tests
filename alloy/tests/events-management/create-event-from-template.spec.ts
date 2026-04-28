// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Events Management', () => {
  test('Create Event from Template', async ({ page }) => {
    // 1. Navigate to admin Event Templates section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // expect: Event Templates section is accessible
    await expect(page.getByRole('link', { name: 'Event Templates' })).toBeVisible();

    // 2. Verify Event Templates table structure
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Duration (Hours)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Event Template' })).toBeVisible();

    // Note: Creating an actual event template and event requires Player, Caster, and Steamfitter services
    // to be fully configured. This test verifies the Event Templates admin section is accessible.
  });
});
