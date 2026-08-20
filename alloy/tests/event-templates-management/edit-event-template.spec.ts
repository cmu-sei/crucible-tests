// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import { createTestEventTemplate, deleteEventTemplateByName } from '../../test-helpers';

test.describe('Event Templates Management', () => {
  // Track the template seeded for this test so it can be cleaned up.
  let seededTemplateName: string | null = null;

  test.afterEach(async ({ page }) => {
    if (seededTemplateName) {
      await deleteEventTemplateByName(page, seededTemplateName);
      seededTemplateName = null;
    }
  });

  test('Edit Event Template', async ({ page }) => {
    // 1. Navigate to admin Event Templates section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // expect: Event templates list is visible
    await expect(page.getByRole('table')).toBeVisible();

    // Seed a template so the test never depends on pre-existing data — an empty
    // list (e.g. a fresh DB or parallel cleanup) previously made the
    // `Edit: .first()` click time out.
    seededTemplateName = `Edit Test Template ${Date.now()}`;
    await createTestEventTemplate(page, seededTemplateName);

    // 2. Open the seeded template's edit dialog
    await page.getByRole('button', { name: `Edit: ${seededTemplateName}` }).click();

    // expect: The event template edit form is displayed
    const dialog = page.getByRole('dialog', { name: 'Edit Event Template' });
    await expect(dialog).toBeVisible();

    // expect: Form fields are populated with current values
    await expect(page.getByRole('textbox', { name: 'Name (required)' })).not.toHaveValue('');

    // 3. Modify the Description field
    const descField = page.getByRole('textbox', { name: 'Event Template Description' });
    await descField.click();
    await descField.fill('Updated description for testing');

    // expect: The description field accepts the new value
    await expect(descField).toHaveValue('Updated description for testing');

    // 4. Change Duration Hours to '6'
    const durationField = page.getByRole('spinbutton', { name: 'Duration Hours' });
    await durationField.click();
    await durationField.fill('6');

    // expect: The duration field accepts the updated value
    await expect(durationField).toHaveValue('6');

    // 5. Click 'Save' button
    await page.getByRole('button', { name: 'Save' }).click();

    // expect: The dialog closes after save
    await expect(dialog).not.toBeVisible();
  });
});
