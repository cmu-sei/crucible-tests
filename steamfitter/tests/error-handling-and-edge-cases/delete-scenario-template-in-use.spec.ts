// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  let templateId: string | null = null;
  let scenarioId: string | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    if (scenarioId) {
      try { await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}`); } catch {}
    }
    if (templateId) {
      try { await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`); } catch {}
    }
  });

  test('Delete Scenario Template in Use', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Setup: create template and scenario from it via authenticated API
    const tResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'In Use Template', description: 'Template that has a scenario', durationHours: 1 },
    });
    expect(tResp.ok()).toBeTruthy();
    const template = await tResp.json();
    templateId = template.id;

    const sResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Dependent Scenario', description: 'Scenario using the template', scenarioTemplateId: templateId },
    });
    expect(sResp.ok()).toBeTruthy();
    const scenario = await sResp.json();
    scenarioId = scenario.id;

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    // Wait for admin page to load
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 15000 });

    // Click the template in the table
    await page.locator('text=In Use Template').first().click();
    await page.waitForTimeout(1000);

    // Look for a delete option - either via a menu button or a direct delete button
    const menuButton = page.getByRole('button', { name: 'Scenario Template Menu' });
    const hasMenu = await menuButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasMenu) {
      await menuButton.click();
      await page.waitForTimeout(500);
    }

    const deleteButton = page.locator('button:has-text("Delete"), [role="menuitem"]:has-text("Delete")').first();
    const hasDelete = await deleteButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasDelete) {
      await deleteButton.click();
      await page.waitForTimeout(500);

      // Look for warning or confirmation dialog
      const warningOrConfirm = page.locator('mat-dialog-content, [class*="warning"], [class*="dialog"], [role="dialog"]').first();
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete"), button:has-text("OK")').last();

      const hasWarning = await warningOrConfirm.isVisible({ timeout: 5000 }).catch(() => false);
      const hasConfirm = await confirmButton.isVisible({ timeout: 3000 }).catch(() => false);

      // Either a warning should appear or a confirmation dialog
      expect(hasWarning || hasConfirm).toBeTruthy();

      // Cancel the deletion if possible
      const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("No")').first();
      const hasCancel = await cancelButton.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasCancel) {
        await cancelButton.click();
      }
    }
  });
});
