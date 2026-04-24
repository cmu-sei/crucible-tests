// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak, Services } from '../../fixtures';

test.describe('Edge Cases and Negative Testing', () => {
  test('Navigation to Non-Existent Resources', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);

    // 1. Navigate to a non-existent exhibit ID
    await page.goto(`${Services.Gallery.UI}/?exhibit=00000000-0000-0000-0000-000000000000`);

    // expect: An error is handled gracefully
    // expect: User is shown an appropriate message or redirected
    // The application should not crash

    // 2. Navigate to an invalid route
    await page.goto(`${Services.Gallery.UI}/invalid-route`);

    // expect: Application handles the invalid route gracefully
    // Should either redirect or show an error page
  });
});
