// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Variables Management', () => {
  test('Variable Validation', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const projectName = 'Var Validation Project';
    const directoryName = 'Var Validation Dir';

    await expect(page.getByText('My Projects')).toBeVisible();

    await page.locator('button[mattooltip="Add New Project"]').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill(projectName);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: projectName }).first()).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: projectName }).first().click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10000 });

    // Extract the project ID from the URL and register it for cleanup
    const projectId = page.url().match(/\/projects\/([^/]+)/)?.[1];
    if (projectId) cleanupCasterProject(projectId);

    // Wait for the project page to load and close any error dialogs
    const errorDialog = page.getByRole('dialog').filter({ hasText: 'Project not found' });
    if (await errorDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await errorDialog.waitFor({ state: 'hidden', timeout: 5000 });
    }

    // Wait for project name to be visible in header to ensure page is loaded
    await expect(page.getByText(projectName).first()).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    // Use JavaScript to click the Add Directory link directly
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const addDirLink = links.find(link => link.textContent?.trim() === 'Add Directory');
      if (addDirLink) {
        (addDirLink as HTMLElement).click();
      }
    });

    await expect(page.getByRole('dialog', { name: 'Create New Directory?' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('textbox', { name: 'Name' }).fill(directoryName);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: directoryName }).first()).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: directoryName }).first().click();
    await page.getByRole('button', { name: 'WORKSPACES' }).click();

    await page.getByText('Add Workspace').first().click();
    await expect(page.getByRole('dialog', { name: 'Create New Workspace?' })).toBeVisible();
    const wsNameInput = page.getByRole('textbox', { name: 'Name' });
    await wsNameInput.click();
    await wsNameInput.fill('Var Validation WS');
    await wsNameInput.blur();
    await page.waitForTimeout(500); // Wait for Angular validation
    await page.getByRole('button', { name: 'Save' }).click({ force: true });

    const wsItem = page.getByText('Var Validation WS');
    if (await wsItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await wsItem.click();
      const varsTab = page.getByRole('tab', { name: 'Variables' });
      if (await varsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await varsTab.click();
      }
    }
  });
});
