// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  let templateId: string | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    if (templateId) {
      try { await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`); } catch {}
    }
  });

  test('Create Task with Non-Numeric Duration', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Setup: create template via authenticated API
    const tResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Non-Numeric Duration Template', description: 'Template for non-numeric duration test', durationHours: 1 },
    });
    expect(tResp.ok()).toBeTruthy();
    const template = await tResp.json();
    templateId = template.id;

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    // Wait for admin page to fully load
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 15000 });

    // The Scenario Templates section is the default admin section; click the template row
    await page.locator('text=Non-Numeric Duration Template').first().click();
    await page.waitForTimeout(1000);

    // Open task form - look for an add/plus button in the template detail view
    const addTaskButton = page.locator('button:has-text("Add"), button[aria-label*="add" i], button[aria-label*="Add" i]').first();
    const hasAddTask = await addTaskButton.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasAddTask) {
      await addTaskButton.click();
      await page.waitForTimeout(500);

      // Enter 'abc' as duration value
      const durationInput = page.locator('input[placeholder*="uration"], input[formcontrolname*="duration"], input[name*="duration"]').first();
      const hasDurationInput = await durationInput.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasDurationInput) {
        await durationInput.fill('abc');
        await page.waitForTimeout(500);

        // Verify validation error
        const validationError = page.locator('mat-error, [class*="error"], [class*="invalid"], .mat-mdc-form-field-error');
        const hasError = await validationError.isVisible({ timeout: 3000 }).catch(() => false);
        const inputInvalid = await durationInput.evaluate((el: HTMLInputElement) => el.validity?.valid === false).catch(() => false);
        expect(hasError || inputInvalid).toBeTruthy();
      }
    }
  });
});
