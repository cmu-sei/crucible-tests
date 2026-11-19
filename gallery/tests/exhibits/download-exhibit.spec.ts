// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoGalleryAdmin,
  gotoAdminSection,
  GALLERY_THEMES,
  setGalleryTheme,
} from '../../fixtures';
import type { Page } from '@playwright/test';

async function selectCollection(page: Page, collectionName: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Select a Collection' }).click();
  const option = page.getByRole('option', { name: collectionName });
  await expect(option).toBeVisible({ timeout: 20000 });
  await option.click();
}

for (const theme of GALLERY_THEMES) {
  test.describe(`${theme} theme › Exhibit Management`, () => {
    test('Download Exhibit as JSON', async ({ galleryAuthenticatedPage: page, seededCollection }) => {
      await setGalleryTheme(page, theme);

      await gotoGalleryAdmin(page);
      await gotoAdminSection(page, 'Exhibits');
      await selectCollection(page, seededCollection.collectionName);

      const row = page.locator('tr.element-row').filter({ hasText: seededCollection.exhibitName });
      await expect(row).toBeVisible();

      // 1. Click the Download button (download icon) on the exhibit row
      const downloadPromise = page.waitForEvent('download');
      await row.getByRole('button', { name: `Download ${seededCollection.exhibitName}` }).click();

      // expect: A JSON file download begins
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.json$/);

      // expect: The downloaded payload is the exhibit's JSON export, so it must parse and
      // carry this exhibit's name.
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      expect(JSON.stringify(payload)).toContain(seededCollection.exhibitName);
    });
  });
}
