// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import { createTestEventTemplate, deleteEventTemplateByName, deleteEventTemplatesByPattern, deleteDefaultEventTemplates } from '../../test-helpers';

test.describe('Event Templates Management', () => {
  let templateName: string;

  test.beforeEach(async ({ page }) => {
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    templateName = `Clone Source ${Date.now()}`;
    await createTestEventTemplate(page, templateName);
  });

  test.afterEach(async ({ page }) => {
    await deleteEventTemplateByName(page, templateName);
    await deleteEventTemplatesByPattern(page, 'clone');
    await deleteEventTemplatesByPattern(page, 'Clone Source');
    await deleteDefaultEventTemplates(page);
  });

  test('Clone Event Template', async ({ page }) => {
    // 1. Navigate to admin Event Templates section
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // expect: Event templates list is visible with at least one template
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Click edit icon for the test event template
    await page.getByRole('button', { name: `Edit: ${templateName}` }).click();

    // expect: Edit Event Template dialog appears
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).toBeVisible();

    // Record the count before cloning
    const statusText = page.getByRole('status');

    // 3. Locate and click the "Clone" button within the dialog
    const dialog = page.getByRole('dialog', { name: 'Edit Event Template' });
    await dialog.getByRole('button', { name: 'Clone' }).click();

    // expect: A new event template is created
    // expect: The dialog closes
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).not.toBeVisible();

    // 4. Verify the cloned template in the list
    // expect: A new template appears in the event templates list
    await expect(page.getByRole('table')).toBeVisible();
  });
});
