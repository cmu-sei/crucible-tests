// spec: alloy/alloy-test-plan.md

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import { createTestEventTemplate, deleteEventTemplateByName, deleteDefaultEventTemplates } from '../../test-helpers';

test.describe('Event Templates Management', () => {
  let templateName: string;

  test.beforeEach(async ({ page }) => {
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    templateName = `Publish Test ${Date.now()}`;
    await createTestEventTemplate(page, templateName);
  });

  test.afterEach(async ({ page }) => {
    await deleteEventTemplateByName(page, templateName);
    await deleteDefaultEventTemplates(page);
  });

  test('Publish and Unpublish Event Template', async ({ page }) => {
    // 1. Navigate to admin Event Templates section and select a template
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // Click edit on the test template
    await page.getByRole('button', { name: `Edit: ${templateName}` }).click();
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).toBeVisible();

    // expect: Template details show Public checkbox
    const publicCheckbox = page.getByRole('checkbox', { name: 'Public' });
    await expect(publicCheckbox).toBeVisible();

    // 2. Check 'Public' checkbox to publish
    if (!(await publicCheckbox.isChecked())) {
      await publicCheckbox.check();
    }
    await expect(publicCheckbox).toBeChecked();

    // Save
    await page.getByRole('button', { name: 'Save' }).click();

    // 3. Reopen and unpublish
    await page.getByRole('button', { name: `Edit: ${templateName}` }).first().click();
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).toBeVisible();

    // Uncheck Public
    await page.getByRole('checkbox', { name: 'Public' }).uncheck();
    await expect(page.getByRole('checkbox', { name: 'Public' })).not.toBeChecked();

    // Save
    await page.getByRole('button', { name: 'Save' }).click();
  });
});
