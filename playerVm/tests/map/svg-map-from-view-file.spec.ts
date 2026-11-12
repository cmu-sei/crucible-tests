// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoPlayerVm, PLAYERVM_THEMES } from '../../fixtures';
import { deleteViewMaps, seedView } from '../../vm-helpers';
import { deleteFile, uploadViewFile } from '../../../player-helpers';

const NETWORK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">' +
  '<rect width="400" height="200" fill="#e8eef4"/><rect x="40" y="60" width="120" height="80" fill="#336699"/>' +
  '<text x="100" y="105" font-family="Arial" font-size="16" fill="#fff" text-anchor="middle">DMZ</text></svg>';

/**
 * A Map can be drawn on an SVG uploaded to the view. The view's SVG file is offered under Select Image, the
 * Map saves it as an image/svg+xml data URL, and the Map page draws that data URL as it is. Player serves an
 * .svg as octet-stream, and a browser draws an untyped SVG not at all, so before vm.ui typed view images
 * the file was not offered and the Map would have been blank.
 */
for (const theme of PLAYERVM_THEMES) {
  test.describe(`${theme} theme › Map Application › SVG view image`, () => {
    let seeded: Awaited<ReturnType<typeof seedView>>;
    let fileId: string | undefined;

    test.beforeAll(async () => {
      seeded = await seedView(`E2E SVG Map ${theme}`);
      fileId = (
        await uploadViewFile(seeded.token, seeded.viewId, [seeded.teamId], {
          name: 'network.svg',
          mimeType: 'image/svg+xml',
          content: NETWORK_SVG,
        })
      ).id;
    });

    test.afterEach(async () => {
      if (seeded) await deleteViewMaps(seeded.token, seeded.viewId);
    });

    test.afterAll(async () => {
      if (seeded && fileId) await deleteFile(seeded.token, fileId);
      await seeded?.cleanup();
    });

    test('Editor can make a Map from a view SVG, and it draws', async ({
      playerVmAuthenticatedPage: page,
    }, testInfo) => {
      await gotoPlayerVm(page, `/views/${seeded.viewId}/map`, theme);

      const newMapButton = page.getByRole('button', { name: 'New Map' });
      await expect(newMapButton).toBeVisible({ timeout: 30000 });
      await newMapButton.click();
      const dialog = page.getByRole('dialog', { name: 'New Map' });
      await expect(dialog).toBeVisible();

      await dialog
        .getByRole('textbox', { name: 'Name' })
        .fill(`E2E SVG Map ${theme} w${testInfo.workerIndex} ${Date.now()}`);
      await dialog.getByRole('combobox', { name: 'Select Image' }).click();
      await page.getByRole('option', { name: 'network.svg' }).click();
      await dialog.getByRole('combobox', { name: 'Teams' }).click();
      // seedView's view has one team, the Admin team the seeding user is on
      await page.getByRole('option', { name: 'Admin' }).click();
      await page.keyboard.press('Escape');

      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(dialog).toBeHidden({ timeout: 15000 });

      const image = page.locator('svg image').first();
      await expect(image).toHaveAttribute('href', /^data:image\/svg\+xml;base64,/, { timeout: 15000 });

      // The browser decodes the saved image as an SVG of the uploaded size, which it does only for a typed one.
      const href = await image.getAttribute('href');
      const size = await page.evaluate(async (src) => {
        const img = new Image();
        img.src = src!;
        await img.decode();
        return { width: img.naturalWidth, height: img.naturalHeight };
      }, href);
      expect(size).toEqual({ width: 400, height: 200 });
    });
  });
}
