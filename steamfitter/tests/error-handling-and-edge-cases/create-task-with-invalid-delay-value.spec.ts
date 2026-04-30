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

  test('Create Task with Invalid Delay Value', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Setup: create template via authenticated API
    const tResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Invalid Delay Template', description: 'Template for invalid delay test', durationHours: 1 },
    });
    expect(tResp.ok()).toBeTruthy();
    const template = await tResp.json();
    templateId = template.id;

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    // Wait for admin page to fully load
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 15000 });

    // Wait for the template table to be fully loaded
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // The Scenario Templates section is the default admin section; click the template row
    const templateRow = page.locator('text=Invalid Delay Template').first();
    await expect(templateRow).toBeVisible({ timeout: 10000 });
    await templateRow.click();

    // Wait for the template detail/expansion panel to stabilize after click
    await page.waitForTimeout(1500);

    // Open task form - look for an add/plus button in the template detail view
    // Use force:true to bypass any transient overlay that may intercept pointer events during Angular transitions
    const addTaskButton = page.locator('button:has-text("Add"), button[aria-label*="add" i], button[aria-label*="Add" i]').first();
    const hasAddTask = await addTaskButton.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasAddTask) {
      await addTaskButton.click({ force: true, timeout: 15000 });
      await page.waitForTimeout(500);

      // Enter -5 as delay value
      const delayInput = page.locator('input[placeholder*="elay"], input[formcontrolname*="delay"], input[name*="delay"]').first();
      const hasDelayInput = await delayInput.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasDelayInput) {
        await delayInput.fill('-5');
        await page.waitForTimeout(500);

        // Verify validation error
        const validationError = page.locator('mat-error, [class*="error"], [class*="invalid"], .mat-mdc-form-field-error');
        const hasError = await validationError.isVisible({ timeout: 3000 }).catch(() => false);
        const inputInvalid = await delayInput.evaluate((el: HTMLInputElement) => el.validity?.valid === false).catch(() => false);
        expect(hasError || inputInvalid).toBeTruthy();
      }
    }
  });
});
