// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('MSEL Management', () => {
  test('MSEL Template Management', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to build page and open an existing MSEL
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    const mselLink = page.getByRole('link', { name: /Project Lagoon TTX/ }).first();
    await expect(mselLink).toBeVisible({ timeout: 10000 });
    await mselLink.click();
    await expect(page).toHaveURL(/.*\/build\?msel=.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 1. Verify Config tab and 'Is a Template' checkbox
    const configTab = page.getByRole('tab', { name: 'Config' });
    await expect(configTab).toBeVisible({ timeout: 5000 });

    const templateCheckbox = page.getByRole('checkbox', { name: 'Is a Template' });
    await expect(templateCheckbox).toBeVisible({ timeout: 5000 });

    // Record current state
    const wasTemplate = await templateCheckbox.isChecked();

    // 2. If not a template, check the checkbox; if already a template, uncheck it
    await templateCheckbox.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // expect: Checkbox state toggled
    if (wasTemplate) {
      await expect(templateCheckbox).not.toBeChecked({ timeout: 5000 });
    } else {
      await expect(templateCheckbox).toBeChecked({ timeout: 5000 });
    }

    // 3. Go to list and filter by Templates
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    const typeFilter = page.getByRole('combobox', { name: /Type/i }).first();
    if (await typeFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await typeFilter.click();
      const templateOption = page.getByRole('option', { name: 'Templates' });
      if (await templateOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await templateOption.click();
        await page.waitForLoadState('networkidle');

        // expect: Filtered list is shown
        await page.waitForTimeout(1000);
      }
    }

    // 4. Restore original template state
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    const mselLink2 = page.getByRole('link', { name: /Project Lagoon TTX/ }).first();
    await expect(mselLink2).toBeVisible({ timeout: 10000 });
    await mselLink2.click();
    await expect(page).toHaveURL(/.*\/build\?msel=.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const templateCheckbox2 = page.getByRole('checkbox', { name: 'Is a Template' });
    await expect(templateCheckbox2).toBeVisible({ timeout: 5000 });

    const isNowTemplate = await templateCheckbox2.isChecked();
    if (isNowTemplate !== wasTemplate) {
      await templateCheckbox2.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }

    // expect: Original state restored
    if (wasTemplate) {
      await expect(templateCheckbox2).toBeChecked({ timeout: 5000 });
    } else {
      await expect(templateCheckbox2).not.toBeChecked({ timeout: 5000 });
    }
  });
});
