// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Accessibility and Usability', () => {
  test('Screen Reader Compatibility', async ({ page }) => {
    // 1. Navigate through the application
    await authenticateWithKeycloak(page, Services.Alloy.UI);

    // expect: Page has proper structure for screen readers
    // Verify semantic HTML elements are present
    await expect(page.getByText('Alloy')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // 2. Navigate to admin section
    await page.goto(`${Services.Alloy.UI}/admin`);

    // expect: Headings are properly structured
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // expect: Tables have proper headers
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();

    // expect: Buttons have accessible names
    await expect(page.getByRole('button', { name: 'Add Event Template' })).toBeVisible();

    // 3. Verify dialog accessibility - "Add Event Template" opens the
    //    "Create New Event Template" dialog directly (Alloy.ui PR #711).
    const createDialog = page.getByRole('dialog', { name: 'Create New Event Template' });
    await page.getByRole('button', { name: 'Add Event Template' }).click();
    await expect(createDialog).toBeVisible();

    // expect: Form labels are properly associated
    await expect(createDialog.getByRole('textbox', { name: 'Name (required)' })).toBeVisible();
    await expect(createDialog.getByRole('spinbutton', { name: 'Duration Hours' })).toBeVisible();

    // Close the dialog without creating anything (no row is added until Save).
    await createDialog.getByRole('button', { name: 'Cancel' }).first().click();
    await expect(createDialog).not.toBeVisible();
  });
});
