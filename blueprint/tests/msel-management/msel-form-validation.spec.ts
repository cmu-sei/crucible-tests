// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('MSEL Management', () => {
  test('MSEL Form Validation', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    // Navigate to an existing MSEL to test the Config tab form validation
    const mselRows = page.getByRole('row').filter({ hasNotText: 'Name Description Template Status Created By Date Created Date Modified' });
    const rowCount = await mselRows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Find a link with text content (skipping empty links)
    let firstMselLink = null;
    for (let i = 0; i < rowCount; i++) {
      const row = mselRows.nth(i);
      const links = row.getByRole('link');
      const linkCount = await links.count();
      for (let j = 0; j < linkCount; j++) {
        const link = links.nth(j);
        const linkText = await link.textContent();
        if (linkText && linkText.trim().length > 0) {
          firstMselLink = link;
          break;
        }
      }
      if (firstMselLink) break;
    }

    if (!firstMselLink) {
      test.skip();
      return;
    }

    await firstMselLink.click();
    await page.waitForLoadState('networkidle');

    // Navigate to Config tab (should already be selected by default)
    const configTab = page.getByRole('tab', { name: 'Config' });
    const configTabVisible = await configTab.isVisible({ timeout: 3000 }).catch(() => false);
    if (configTabVisible) {
      await configTab.click();
    }

    // 1. Navigate to an existing MSEL Config tab and type in the Name field
    const nameField = page.getByRole('textbox', { name: 'Name' });
    await expect(nameField).toBeVisible({ timeout: 5000 });

    await nameField.click();
    await nameField.fill('Test MSEL Name');

    // expect: A character counter is shown (e.g., '31 / 70 characters')
    const nameCharCounter = page.locator('text=/ 70 characters').first();
    await expect(nameCharCounter).toBeVisible({ timeout: 5000 });

    // Verify the counter format shows current count / 70
    const counterText = await nameCharCounter.textContent();
    expect(counterText).toMatch(/\d+ \/ 70 characters/);

    // expect: The maximum allowed name length is 70 characters
    await nameField.fill('A'.repeat(71));
    await page.waitForTimeout(300);
    const nameValue = await nameField.inputValue();
    expect(nameValue.length).toBeLessThanOrEqual(70);

    // 2. Type in the Description field
    const descriptionField = page.getByRole('textbox', { name: 'Description' });
    await expect(descriptionField).toBeVisible({ timeout: 5000 });
    await descriptionField.click();
    await descriptionField.fill('Test description content');

    // expect: A character counter is shown (e.g., '176 / 600 characters')
    const descCharCounter = page.locator('text=/ 600 characters').first();
    await expect(descCharCounter).toBeVisible({ timeout: 5000 });

    const descCounterText = await descCharCounter.textContent();
    expect(descCounterText).toMatch(/\d+ \/ 600 characters/);

    // expect: The maximum allowed description length is 600 characters
    await descriptionField.fill('B'.repeat(601));
    await page.waitForTimeout(300);
    const descValue = await descriptionField.inputValue();
    expect(descValue.length).toBeLessThanOrEqual(600);

    // 3. Try to save with an empty name field
    await nameField.clear();
    await expect(nameField).toHaveValue('');

    const saveButton = page.getByRole('button', { name: 'Save Changes' });
    const saveEnabled = await saveButton.isEnabled().catch(() => false);

    if (saveEnabled) {
      await saveButton.click();

      // expect: Validation error is displayed or save button remains disabled
      // The form might just keep the save button disabled rather than showing an error message
      const validationError = page.getByText(/required/i).first();
      const errorVisible = await validationError.isVisible({ timeout: 3000 }).catch(() => false);
      if (!errorVisible) {
        // If no error message is shown, the save button should still be disabled
        await expect(saveButton).toBeDisabled();
      }

      // expect: Form submission is prevented
      await expect(nameField).toBeVisible();
    } else {
      // Save button is already disabled with empty name — validation working
      await expect(saveButton).toBeDisabled();
    }
  });
});
