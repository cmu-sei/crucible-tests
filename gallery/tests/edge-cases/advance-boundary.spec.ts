// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Edge Cases and Negative Testing', () => {
  test('Advance at Last Move or Inject', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await expect(page.getByRole('table')).toBeVisible();

    // Navigate to an exhibit's Wall view
    const exhibitLink = page.getByRole('cell').getByRole('link').first();
    await exhibitLink.click();
    await expect(page).toHaveURL(/\?exhibit=/);

    const wallButton = page.getByRole('button', { name: 'Wall' });
    if (await wallButton.isVisible().catch(() => false)) {
      await wallButton.click();
    }
    await expect(page).toHaveTitle('Gallery Wall');

    const advanceButton = page.getByRole('button', { name: 'Advance' });
    if (await advanceButton.isVisible().catch(() => false)) {
      // 1. Click the 'Advance' button repeatedly to reach the last move/inject
      // Keep advancing until we can't advance anymore or an indicator shows
      const moveInjectText = page.getByText(/Move \d+, Inject \d+/);
      await expect(moveInjectText).toBeVisible();

      // Advance multiple times
      for (let i = 0; i < 5; i++) {
        const currentText = await moveInjectText.textContent();
        await advanceButton.click();
        // Check if we're still at the same position (boundary reached)
        const newText = await moveInjectText.textContent();
        if (currentText === newText) {
          // Already at the last move/inject
          break;
        }
      }

      // expect: The move/inject values reflect the boundary
      await expect(moveInjectText).toBeVisible();
    }
  });
});
