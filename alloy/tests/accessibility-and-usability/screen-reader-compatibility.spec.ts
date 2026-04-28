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
    await expect(page.getByRole('link', { name: 'Alloy' })).toBeVisible();
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

    // 3. Verify dialog accessibility - create a template first, then edit it
    await page.getByRole('button', { name: 'Add Event Template' }).click();
    await expect(page.getByRole('cell', { name: 'New Event Template' }).first()).toBeVisible();

    // Open the edit dialog
    await page.getByRole('button', { name: 'Edit: New Event Template' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).toBeVisible();

    // expect: Form labels are properly associated
    await expect(page.getByRole('textbox', { name: 'Name (required)' })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: 'Duration Hours' })).toBeVisible();

    // Close dialog and clean up: delete the created template
    await page.getByRole('button', { name: 'Cancel' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).not.toBeVisible();

    // Delete the template we created
    await page.getByRole('button', { name: 'Edit: New Event Template' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('dialog', { name: 'Delete Event Template' })).toBeVisible();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('cell', { name: 'New Event Template' })).not.toBeVisible();
  });
});
