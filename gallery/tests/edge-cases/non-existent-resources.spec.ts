// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

const MISSING_EXHIBIT_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Both steps here are about how the *authenticated* app reacts to a bad target, so
 * they run with the normal pre-authenticated fixture — being signed out is not what is
 * under test (that is the unauthorized-access spec's job).
 */
test.describe('Edge Cases and Negative Testing', () => {
  test('Navigation to Non-Existent Resources', async ({ galleryAuthenticatedPage: page }) => {
    // 1. Navigate to a non-existent exhibit ID.
    // exhibit-data.service.ts `loadById` handles the failed GET by routing back to '/'
    // with the query params stripped, so pair the navigation with the 404 to prove the
    // app really did ask for the missing exhibit and recovered — rather than merely
    // that a page rendered.
    const exhibitLookup = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/exhibits/${MISSING_EXHIBIT_ID}`) &&
        response.request().method() === 'GET' &&
        !response.url().includes('/my-teams')
    );
    await page.goto(`${Services.Gallery.UI}/?exhibit=${MISSING_EXHIBIT_ID}`, {
      waitUntil: 'domcontentloaded',
    });

    // expect: the API reports the exhibit does not exist
    expect((await exhibitLookup).status()).toBe(404);

    // expect: An error is handled gracefully / user is redirected — the app lands back
    // on the My Exhibits home view with the bad exhibit id dropped from the URL.
    await expect(page.getByText('My Exhibits')).toBeVisible();
    await expect(page).toHaveURL(`${Services.Gallery.UI}/`);

    // expect: the application does not crash — the Angular shell is still live and the
    // exhibits table is rendered.
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Navigate to an invalid route
    await page.goto(`${Services.Gallery.UI}/invalid-route`, { waitUntil: 'domcontentloaded' });

    // expect: Application handles the invalid route gracefully.
    // The app surfaces router failures through the shared system-message bottom sheet
    // rather than a blank page or a browser error, and the router itself falls back to
    // the root URL.
    const systemMessage = page.locator('app-system-message');
    await expect(systemMessage).toBeVisible();
    await expect(systemMessage.getByRole('heading', { name: 'Error' })).toBeVisible();
    await expect(systemMessage).toContainText(
      "NG04002: Cannot match any routes. URL Segment: 'invalid-route'"
    );
    await expect(page).toHaveURL(`${Services.Gallery.UI}/`);
  });
});
