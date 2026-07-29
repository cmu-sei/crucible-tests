// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import { createTestEventTemplate, deleteEventTemplateByName } from '../../test-helpers';

test.describe('Accessibility and Usability', () => {
  test('Loading States and Feedback', async ({ page }) => {
    // Use a unique template name to avoid collisions with leftover data from previous runs
    const uniqueName = `Loading Test Template ${Date.now()}`;

    // 1. Navigate to admin page and trigger an action
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // 2. Observe the UI during page load
    // expect: The table loads with data
    await expect(page.getByRole('table')).toBeVisible();

    // 3. Trigger an action (create template).
    await createTestEventTemplate(page, uniqueName, { durationHours: '1' });

    // expect: Success - the template appears in the list with the given name
    await expect(page.getByRole('cell', { name: uniqueName })).toBeVisible({ timeout: 30000 });

    // Verify the template is removed from the table
    await deleteEventTemplateByName(page, uniqueName);
    await expect(page.getByRole('cell', { name: uniqueName })).not.toBeVisible({ timeout: 15000 });
  });
});
