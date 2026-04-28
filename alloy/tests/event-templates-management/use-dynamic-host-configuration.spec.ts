// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import { createTestEventTemplate, deleteEventTemplateByName, deleteDefaultEventTemplates } from '../../test-helpers';

test.describe('Event Templates Management', () => {
  let templateName: string;

  test.beforeEach(async ({ page }) => {
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    templateName = `Dynamic Host Test ${Date.now()}`;
    await createTestEventTemplate(page, templateName);
  });

  test.afterEach(async ({ page }) => {
    await deleteEventTemplateByName(page, templateName);
    await deleteDefaultEventTemplates(page);
  });

  test('Use Dynamic Host Configuration', async ({ page }) => {
    // 1. Navigate to admin Event Templates section
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // 2. Click edit icon for the test event template
    await page.getByRole('button', { name: `Edit: ${templateName}` }).click();

    // expect: Edit Event Template dialog appears
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).toBeVisible();

    // 3. Locate the "Use Dynamic Host" checkbox
    const dynamicHostCheckbox = page.getByRole('checkbox', { name: 'Use Dynamic Host' });

    // expect: Checkbox is visible with label "Use Dynamic Host"
    await expect(dynamicHostCheckbox).toBeVisible();

    // Remember original state for restore
    const wasChecked = await dynamicHostCheckbox.isChecked();

    // 4. Check the "Use Dynamic Host" checkbox
    if (!wasChecked) {
      await dynamicHostCheckbox.check();
    }

    // expect: Checkbox becomes checked
    await expect(dynamicHostCheckbox).toBeChecked();

    // 5. Click "Save" button
    await page.getByRole('button', { name: 'Save' }).click();

    // expect: Template is updated successfully

    // Restore: uncheck the Use Dynamic Host checkbox
    await page.getByRole('button', { name: `Edit: ${templateName}` }).first().click();
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).toBeVisible();
    if (!wasChecked) {
      await page.getByRole('checkbox', { name: 'Use Dynamic Host' }).uncheck();
    }
    await page.getByRole('button', { name: 'Save' }).click();
  });
});
