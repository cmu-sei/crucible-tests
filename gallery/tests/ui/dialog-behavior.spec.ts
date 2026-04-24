// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak, apiDeleteCollectionByName } from '../../fixtures';

test.describe('Responsive Design and Accessibility', () => {
  test('Dialog and Modal Behavior', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // 1. Open a dialog (e.g., Add Collection)
    await page.getByRole('button', { name: 'Add Collection' }).click();

    // expect: Dialog appears as a modal overlay
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 2. Click the 'Cancel' button in the dialog (use last() to target the text Cancel button, not the X icon)
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).last().click();

    // expect: Dialog closes without saving changes
    await expect(dialog).not.toBeVisible();

    // 4. Open a dialog, make changes, click 'Save'
    await page.getByRole('button', { name: 'Add Collection' }).click();
    const dialog2 = page.getByRole('dialog');
    await expect(dialog2).toBeVisible();

    const dialogCollectionName = `Dialog Test ${Date.now()}`;
    await dialog2.getByLabel('Name').fill(dialogCollectionName);
    await dialog2.getByRole('button', { name: 'Save' }).click();

    // expect: Dialog processes the action and closes
    await expect(dialog2).not.toBeVisible();

    // expect: Changes are persisted
    await expect(page.getByText(dialogCollectionName)).toBeVisible();

    // Cleanup: Delete the created collection via API to ensure it's reliably removed
    await apiDeleteCollectionByName(dialogCollectionName);
  });
});
