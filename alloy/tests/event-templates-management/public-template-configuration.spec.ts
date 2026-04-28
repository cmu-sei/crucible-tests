// spec: alloy/alloy-test-plan.md

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import { createTestEventTemplate, deleteEventTemplateByName, deleteDefaultEventTemplates } from '../../test-helpers';

test.describe('Event Templates Management', () => {
  let templateName: string;

  test.beforeEach(async ({ page }) => {
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    templateName = `Public Config Test ${Date.now()}`;
    await createTestEventTemplate(page, templateName);
  });

  test.afterEach(async ({ page }) => {
    await deleteEventTemplateByName(page, templateName);
    await deleteDefaultEventTemplates(page);
  });

  test('Public Template Configuration', async ({ page }) => {
    // 1. Navigate to admin Event Templates section
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // 2. Click edit icon for the test event template
    const editButton = page.getByRole('button', { name: `Edit: ${templateName}` });
    await editButton.click();

    // expect: Edit Event Template dialog appears
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).toBeVisible();

    // 3. Locate the "Public" checkbox
    const publicCheckbox = page.getByRole('checkbox', { name: 'Public' });

    // expect: Checkbox is visible with label "Public"
    await expect(publicCheckbox).toBeVisible();

    // 4. Check the "Public" checkbox (if not already checked)
    if (!(await publicCheckbox.isChecked())) {
      await publicCheckbox.check();
    }

    // expect: Checkbox becomes checked
    await expect(publicCheckbox).toBeChecked();

    // 5. Click "Save" button
    await page.getByRole('button', { name: 'Save' }).click();

    // expect: Template is updated successfully - dialog closes
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).not.toBeVisible();
  });
});
