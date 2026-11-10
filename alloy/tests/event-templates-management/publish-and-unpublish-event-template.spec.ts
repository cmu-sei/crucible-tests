// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md

import { test, expect } from '../../fixtures';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import { ALLOY_THEMES, applyAlloyTheme, createTestEventTemplate, deleteEventTemplateByName, findEventTemplateEditButton } from '../../test-helpers';

for (const theme of ALLOY_THEMES) {
  test.describe(`${theme} theme › Event Templates Management`, () => {
    let templateName: string;

    test.beforeEach(async ({ page }) => {
      await authenticateWithKeycloak(page, Services.Alloy.UI);
      await applyAlloyTheme(page, theme);
      templateName = `Publish Test ${Date.now()}`;
      await createTestEventTemplate(page, templateName);
    });

    test.afterEach(async ({ page }) => {
      await deleteEventTemplateByName(page, templateName);
    });

    test('Publish and Unpublish Event Template', async ({ page }) => {
      // 1. Navigate to admin Event Templates section and select a template
      await page.goto(`${Services.Alloy.UI}/admin`);
      await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

      // Click edit on the test template
      await (await findEventTemplateEditButton(page, templateName)).click();
      await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).toBeVisible();

      // expect: Template details show Public checkbox
      // Scoped to the dialog and exact: other templates' row checkboxes are labelled
      // "Select <name>", and a concurrent test's template name can contain "Public".
      const publicCheckbox = page
        .getByRole('dialog', { name: 'Edit Event Template' })
        .getByRole('checkbox', { name: 'Public', exact: true });
      await expect(publicCheckbox).toBeVisible();

      // 2. Check 'Public' checkbox to publish
      if (!(await publicCheckbox.isChecked())) {
        await publicCheckbox.check();
      }
      await expect(publicCheckbox).toBeChecked();

      // Save; the dialog closing is the signal the save finished and the list is back
      const editDialog = page.getByRole('dialog', { name: 'Edit Event Template' });
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(editDialog).toBeHidden();

      // 3. Reopen and unpublish
      await (await findEventTemplateEditButton(page, templateName)).click();
      await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).toBeVisible();

      // Uncheck Public
      await publicCheckbox.uncheck();
      await expect(publicCheckbox).not.toBeChecked();

      // Save
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(editDialog).toBeHidden();
    });
  });
}