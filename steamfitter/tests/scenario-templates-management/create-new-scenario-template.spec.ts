// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Scenario Templates Management', () => {
  let createdTemplateId: string | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    if (createdTemplateId) {
      try {
        await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${createdTemplateId}`);
      } catch { /* ignore cleanup errors */ }
    }
  });

  test('Create New Scenario Template', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    const scenarioTemplatesItem = sidebar.locator('text=Scenario Templates').first();
    await scenarioTemplatesItem.click();
    await page.waitForTimeout(1000);

    const addButton = page.getByRole('button', { name: /Add Scenario Template/ });
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('mat-dialog-container, [role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const nameField = dialog.locator('input[formcontrolname="name"], input[placeholder*="Name"], mat-form-field:has-text("Name") input').first();
    await nameField.fill('Test Scenario Template');

    const descField = dialog.locator('textarea[formcontrolname="description"], textarea[placeholder*="Description"], mat-form-field:has-text("Description") textarea, input[formcontrolname="description"]').first();
    const hasDescField = await descField.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasDescField) {
      await descField.fill('This is a test scenario template for automated testing');
    }

    const durationField = dialog.locator('input[formcontrolname="durationHours"], input[placeholder*="Duration"], mat-form-field:has-text("Duration") input').first();
    const hasDuration = await durationField.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasDuration) {
      await durationField.fill('3600');
    }

    const saveButton = dialog.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]').first();
    await saveButton.click();
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Test Scenario Template').first()).toBeVisible({ timeout: 10000 });

    // Capture ID for cleanup via API
    const response = await steamfitterApi.get(`${Services.Steamfitter.API}/api/scenariotemplates`);
    if (response.ok()) {
      const templates = await response.json();
      const created = templates.find((t: any) => t.name === 'Test Scenario Template');
      if (created) createdTemplateId = created.id;
    }
  });
});
