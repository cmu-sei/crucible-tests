// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('MSEL Info Pages Management', () => {
  test('View MSEL Config Tab', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to a MSEL and click on its name link
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    const mselLink = page.getByRole('link', { name: /Project Lagoon TTX/ }).first();
    await expect(mselLink).toBeVisible({ timeout: 10000 });
    await mselLink.click();
    await expect(page).toHaveURL(/.*\/build\?msel=.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // expect: Config tab is selected by default
    const configTab = page.getByRole('tab', { name: 'Config' });
    await expect(configTab).toBeVisible({ timeout: 5000 });

    // expect: An Overview tab is available
    const overviewTab = page.getByRole('tab', { name: 'Overview' });
    await expect(overviewTab).toBeVisible({ timeout: 5000 });

    // expect: An 'Add Page' tab is shown
    const addPageTab = page.getByRole('tab', { name: 'Add Page' });
    await expect(addPageTab).toBeVisible({ timeout: 5000 });

    // 2. Review the Config tab content
    // expect: Name field is visible
    const nameField = page.getByRole('textbox', { name: 'Name' });
    await expect(nameField).toBeVisible({ timeout: 5000 });

    // expect: Name character count is shown
    const nameCharCount = page.getByText(/\/ 70 characters/);
    await expect(nameCharCount).toBeVisible({ timeout: 5000 });

    // expect: Description field is visible
    const descField = page.getByRole('textbox', { name: 'Description' });
    await expect(descField).toBeVisible({ timeout: 5000 });

    // expect: Description character count is shown
    const descCharCount = page.getByText(/\/ 600 characters/);
    await expect(descCharCount).toBeVisible({ timeout: 5000 });

    // expect: 'Is a Template' checkbox is visible
    const templateCheckbox = page.getByRole('checkbox', { name: 'Is a Template' });
    await expect(templateCheckbox).toBeVisible({ timeout: 5000 });

    // expect: MSEL Status dropdown is visible
    const statusDropdown = page.getByRole('combobox', { name: 'MSEL Status' });
    await expect(statusDropdown).toBeVisible({ timeout: 5000 });

    // expect: Exercise View URL section is visible
    const exerciseViewUrl = page.getByText('Exercise View URL');
    await expect(exerciseViewUrl).toBeVisible({ timeout: 5000 });

    // expect: MSEL Starter URL section is visible
    const starterUrl = page.getByText('MSEL Starter URL');
    await expect(starterUrl).toBeVisible({ timeout: 5000 });
  });
});
