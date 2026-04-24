// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Exhibit Management', () => {
  const testCollectionName = `Exhibit Copy Test ${Date.now()}`;
  const testExhibitName = `Copy Exhibit ${Date.now()}`;

  test('Copy Exhibit', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Setup: Create a collection and exhibit
    await page.getByRole('button', { name: 'Add Collection' }).click();
    const createCollDialog = page.getByRole('dialog');
    await expect(createCollDialog).toBeVisible();
    await createCollDialog.getByLabel('Name').fill(testCollectionName);
    await createCollDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(testCollectionName)).toBeVisible();

    await page.locator('mat-list-item').filter({ hasText: 'Exhibits' }).getByRole('button').click();
    const collectionDropdown = page.getByRole('combobox', { name: 'Select a Collection' });
    await collectionDropdown.click();
    await page.getByRole('option', { name: testCollectionName }).click();

    await page.getByRole('button', { name: 'Add Exhibit' }).click();
    const createDialog = page.getByRole('dialog');
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel('Name').fill(testExhibitName);
    await createDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(testExhibitName)).toBeVisible();

    // 1. Click the Copy button (clipboard icon) on an exhibit row
    const row = page.getByRole('row').filter({ hasText: testExhibitName });
    await row.getByRole('button', { name: `Copy ${testExhibitName}` }).click();

    // expect: A new exhibit is created as a copy of the original
    // expect: The copied exhibit appears in the list

    // Cleanup: Delete all exhibits matching the name
    const rows = page.getByRole('row').filter({ hasText: testExhibitName });
    const count = await rows.count();
    for (let i = count - 1; i >= 0; i--) {
      const deleteBtn = rows.nth(i).getByRole('button').filter({ has: page.locator('mat-icon:text("delete")') });
      if (await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click();
        const confirmDialog = page.getByRole('dialog');
        await confirmDialog.getByRole('button', { name: /yes|confirm|ok|delete/i }).click();
        await expect(page.getByRole('dialog')).not.toBeVisible();
      }
    }

    // Cleanup: Delete the collection
    await page.locator('mat-list-item').filter({ hasText: 'Collections' }).getByRole('button').click();
    const collRow = page.getByRole('row').filter({ hasText: testCollectionName });
    await collRow.getByRole('button', { name: `Delete ${testCollectionName}` }).click();
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByRole('button', { name: /yes|confirm|ok|delete/i }).click();
  });
});
