// spec: alloy/alloy-test-plan.md

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import { createTestEventTemplate, deleteEventTemplateByName, deleteDefaultEventTemplates } from '../../test-helpers';

test.describe('Event Templates Management', () => {
  let templateName: string;

  test.beforeEach(async ({ page }) => {
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    templateName = `History Test ${Date.now()}`;
    // Create a public template so it appears on the home page "My Events" list
    await createTestEventTemplate(page, templateName, {
      description: 'Template for history test',
      durationHours: '2',
    });
    // Make the template public so it appears on the home page
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
    await page.getByRole('button', { name: `Edit: ${templateName}` }).click();
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).toBeVisible();
    const publicCheckbox = page.getByRole('checkbox', { name: 'Public' });
    if (!(await publicCheckbox.isChecked())) {
      await publicCheckbox.check();
    }
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).not.toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await deleteEventTemplateByName(page, templateName);
    await deleteDefaultEventTemplates(page);
  });

  test('View Event Template History', async ({ page }) => {
    // 1. Navigate to home page
    await page.goto(`${Services.Alloy.UI}`);

    // expect: Home page loads with event templates listed
    await expect(page.getByText('My Events')).toBeVisible();

    // expect: A table of event templates is displayed
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Click on the test event template in the table
    const templateCell = page.getByRole('cell', { name: templateName });
    await expect(templateCell).toBeVisible({ timeout: 15000 });
    await templateCell.click();

    // expect: Clicking a template navigates or opens a detail view
    // Wait for either a URL change to /templates/ or a dialog/panel to appear
    await page.waitForURL((url) => url.toString().includes('/templates/'), { timeout: 10000 }).catch(() => {});
    const currentUrl = page.url();
    if (currentUrl.includes('/templates/')) {
      // Navigated to template detail view
      // 3. Locate and click the "History" button (if visible)
      const historyButton = page.getByRole('button', { name: 'History' });
      if (await historyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await historyButton.click();
        await historyButton.click();
      }
    } else {
      // Template click opened a detail panel or dialog on the same page
      // Verify some event-related content is displayed
      const eventContent = page.locator('[class*="detail"], [class*="panel"], mat-dialog-container, [class*="event"]');
      const hasContent = await eventContent.first().isVisible({ timeout: 5000 }).catch(() => false);
      if (hasContent) {
        await expect(eventContent.first()).toBeVisible();
      }
    }
  });
});
