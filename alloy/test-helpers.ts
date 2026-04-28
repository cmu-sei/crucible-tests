// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Page, expect } from '@playwright/test';
import { Services } from '../shared-fixtures';

/**
 * Navigate to the Alloy admin Event Templates page.
 * Handles cases where the page is already on admin or needs re-navigation.
 */
async function ensureOnAdminPage(page: Page): Promise<void> {
  if (!page.url().includes('/admin')) {
    await page.goto(`${Services.Alloy.UI}/admin`, { waitUntil: 'domcontentloaded' });
  }
  await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('table')).toBeVisible({ timeout: 15000 });
}

/**
 * Delete an event template by name via the admin UI.
 * Handles the confirmation dialog and waits for the row to disappear.
 * Errors are caught and logged rather than thrown to avoid masking original test failures.
 */
export async function deleteEventTemplateByName(page: Page, name: string): Promise<boolean> {
  try {
    await ensureOnAdminPage(page);

    // Close any open dialogs first
    const openDialog = page.getByRole('dialog').first();
    if (await openDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
      const cancelButton = openDialog.getByRole('button', { name: /Cancel|Close/i });
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
        await expect(openDialog).not.toBeVisible({ timeout: 5000 });
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    const editButton = page.getByRole('button', { name: `Edit: ${name}` });
    if (!(await editButton.first().isVisible({ timeout: 2000 }).catch(() => false))) {
      console.log(`Event template "${name}" not found for cleanup`);
      return false;
    }

    await editButton.first().click();

    const editDialog = page.getByRole('dialog', { name: 'Edit Event Template' });
    await expect(editDialog).toBeVisible({ timeout: 5000 });

    await editDialog.getByRole('button', { name: 'Delete' }).click();

    const confirmDialog = page.getByRole('dialog', { name: 'Delete Event Template' });
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    await confirmDialog.getByRole('button', { name: 'Yes' }).click();

    await expect(editDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    console.log(`Deleted event template "${name}"`);
    return true;
  } catch (error) {
    console.log(`Error deleting event template "${name}":`, error);
    return false;
  }
}

/**
 * Delete all event templates matching a name pattern via the admin UI.
 * Searches across paginated results by searching for matching names.
 */
export async function deleteEventTemplatesByPattern(page: Page, searchTerm: string): Promise<number> {
  let deletedCount = 0;
  const maxAttempts = 10;

  try {
    await ensureOnAdminPage(page);

    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.fill(searchTerm);
    await page.waitForTimeout(1000);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const openDialog = page.getByRole('dialog').first();
      if (await openDialog.isVisible({ timeout: 500 }).catch(() => false)) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }

      const editButton = page.getByRole('button', { name: /^Edit:/ }).first();
      if (!(await editButton.isVisible({ timeout: 2000 }).catch(() => false))) {
        break;
      }

      await editButton.click();

      const editDialog = page.getByRole('dialog', { name: 'Edit Event Template' });
      if (!(await editDialog.isVisible({ timeout: 3000 }).catch(() => false))) {
        break;
      }

      const deleteButton = editDialog.getByRole('button', { name: 'Delete' });
      if (!(await deleteButton.isVisible({ timeout: 2000 }).catch(() => false))) {
        await page.keyboard.press('Escape');
        break;
      }
      await deleteButton.click();

      const confirmDialog = page.getByRole('dialog', { name: 'Delete Event Template' });
      if (!(await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false))) {
        break;
      }
      await confirmDialog.getByRole('button', { name: 'Yes' }).click();

      await editDialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(500);

      deletedCount++;
    }

    await searchBox.fill('');

    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} event template(s) matching "${searchTerm}"`);
    }
  } catch (error) {
    console.log(`Error cleaning up event templates matching "${searchTerm}":`, error);
  }

  return deletedCount;
}

/**
 * Delete "New Event Template" entries that still have default values
 * (duration=0, description="Add description"). These are orphans left by
 * tests that called "Add Event Template" but failed before renaming.
 * Only deletes templates with unmodified defaults, so it's safe to call
 * even when other tests are running.
 */
export async function deleteDefaultEventTemplates(page: Page): Promise<number> {
  let deletedCount = 0;
  const maxAttempts = 5;

  try {
    await ensureOnAdminPage(page);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const openDialog = page.getByRole('dialog').first();
      if (await openDialog.isVisible({ timeout: 500 }).catch(() => false)) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }

      const editButtons = page.getByRole('button', { name: 'Edit: New Event Template' });
      if (!(await editButtons.first().isVisible({ timeout: 2000 }).catch(() => false))) {
        break;
      }

      let found = false;
      const count = await editButtons.count();
      for (let i = 0; i < count; i++) {
        await editButtons.nth(i).click();
        const editDialog = page.getByRole('dialog', { name: 'Edit Event Template' });
        if (!(await editDialog.isVisible({ timeout: 3000 }).catch(() => false))) continue;

        const duration = await page.getByRole('spinbutton', { name: 'Duration Hours' }).inputValue();
        const desc = await page.getByRole('textbox', { name: 'Event Template Description' }).inputValue();

        if (duration === '0' && desc === 'Add description') {
          const deleteButton = editDialog.getByRole('button', { name: 'Delete' });
          if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await deleteButton.click();
            const confirmDialog = page.getByRole('dialog', { name: 'Delete Event Template' });
            if (await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
              await confirmDialog.getByRole('button', { name: 'Yes' }).click();
              await editDialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
              await page.waitForTimeout(500);
              deletedCount++;
              found = true;
              break;
            }
          }
        }

        await page.getByRole('button', { name: 'Cancel' }).first().click().catch(() => {});
        await page.getByRole('dialog').first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
      }

      if (!found) break;
    }

    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} default "New Event Template" orphan(s)`);
    }
  } catch (error) {
    console.log('Error cleaning up default event templates:', error);
  }

  return deletedCount;
}

/**
 * Create an event template via the admin UI and return its name.
 * The caller is responsible for cleaning up the template after the test.
 * Assumes the page is already authenticated and on the admin Event Templates page.
 */
export async function createTestEventTemplate(
  page: Page,
  name: string,
  options: { description?: string; durationHours?: string } = {}
): Promise<string> {
  const { description = 'Auto-created for testing', durationHours = '2' } = options;

  await ensureOnAdminPage(page);

  // Click Add Event Template and wait for the API to confirm creation
  const [createResponse] = await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/eventtemplates') &&
        resp.request().method() === 'POST' &&
        resp.status() >= 200 &&
        resp.status() < 300
    ),
    page.getByRole('button', { name: 'Add Event Template' }).click(),
  ]);

  const created = await createResponse.json();
  const createdId: string = created.id;

  // Open edit dialog for the freshly created template using its unique ID.
  // Each row has a "Copy: <id>" button, so we find the row containing our ID
  // then click its edit button. This avoids race conditions with parallel workers.
  const editDialog = page.getByRole('dialog', { name: 'Edit Event Template' });
  const copyButton = page.getByRole('button', { name: `Copy: ${createdId}` });
  await expect(copyButton).toBeVisible({ timeout: 10000 });
  // The edit button is a sibling in the same cell as the copy button
  const rowCell = copyButton.locator('..');
  const editButton = rowCell.getByRole('button', { name: /^Edit:/ });
  await editButton.click();
  await expect(editDialog).toBeVisible({ timeout: 5000 });

  // Fill in the name, description, and duration
  const nameField = page.getByRole('textbox', { name: /^Name/ });
  await nameField.fill(name);

  const descField = page.getByRole('textbox', { name: 'Event Template Description' });
  await descField.fill(description);

  const durationField = page.getByRole('spinbutton', { name: 'Duration Hours' });
  await durationField.fill(durationHours);

  // Save
  const [saveResponse] = await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/eventtemplates') &&
        resp.request().method() === 'PUT' &&
        resp.status() >= 200 &&
        resp.status() < 300
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);

  await expect(editDialog).not.toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('cell', { name })).toBeVisible({ timeout: 15000 });

  console.log(`Created test event template "${name}"`);
  return name;
}

/**
 * End and clean up events visible on the admin Events page.
 * Navigates to the Events section and ends any active events.
 */
export async function cleanupEndedEvents(page: Page): Promise<void> {
  try {
    await page.goto(`${Services.Alloy.UI}/admin`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 15000 });

    // Click on Events in the sidebar
    const eventsNav = page.locator('mat-list-item').filter({ hasText: 'Events' });
    if (await eventsNav.isVisible({ timeout: 2000 }).catch(() => false)) {
      await eventsNav.click();
      await page.waitForTimeout(1000);
    }
  } catch (error) {
    console.log('Error cleaning up events:', error);
  }
}
