// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';

/**
 * When the API health check fails, the app must say so instead of rendering an empty shell.
 *
 * Rewritten. The previous version could not fail. It collected four candidate error locators,
 * slept 5s, set `errorFound`, and then asserted:
 *
 *   if (!errorFound) {
 *     await expect(page).toHaveURL(serviceUrlPattern(Services.Blueprint.UI));
 *   }
 *
 * So when the error appeared it asserted nothing, and when it did not appear it asserted only
 * that the browser was still on a Blueprint URL — true either way. Two of its locators were
 * also comma-joined `text=` selectors (`'text=/API.*unavailable/i, text=/API.*unreachable/i'`),
 * which Playwright's `text=` engine cannot combine, so they matched zero elements regardless.
 *
 * The behaviour is fully deterministic, so it can be asserted outright. `home-app.component.ts`
 * subscribes to the health check and sets `apiIsSick = true` in its error callback (line 199),
 * with `apiMessage = 'The API web service is not responding.'` (line 200).
 * `home-app.component.html:13-19` then renders, under `@if (apiIsSick)`, an `<h1>` of
 * `apiMessage` plus `<h2>Please refresh this page.</h2>` and a "contact the site administrator"
 * line — and, because the same flag gates lines 23 and 36, the normal content is suppressed.
 *
 * Both halves are asserted here: the error is shown, and the dashboard content is not. The 5s
 * sleep is gone — each assertion waits on the state it is about.
 *
 * Two measured details shaped the assertions:
 *
 *   1. An "API Error / The API could not be reached." sheet also opens, and while it is up the
 *      three headings are in the DOM but **not visible** to Playwright, so asserting them first
 *      fails with "element(s) not found" even though the app is behaving correctly. It is part
 *      of the correct behaviour, so it is asserted and then dismissed.
 *   2. It is a `mat-bottom-sheet-container` (`role="dialog"`, `aria-modal="false"`), and because
 *      several API calls fail, **more than one** is opened — `getByRole('dialog')` hits a strict
 *      mode violation resolving to 2 elements. The locators below are therefore scoped with
 *      `.first()` / counted, rather than assuming a single dialog.
 */
test.describe('Error Handling and Validation', () => {
  test('API Health Check Error', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Make every Blueprint API call fail, which is what a down API looks like to the client.
    await page.route(`${Services.Blueprint.API}/**`, (route) => route.abort('connectionrefused'));

    try {
      await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });

      // expect: an API error sheet is raised, naming the failure.
      const errorSheets = page.locator('mat-bottom-sheet-container');
      await expect(errorSheets.first()).toBeVisible({ timeout: 30000 });
      await expect(errorSheets.first().getByRole('heading', { name: 'API Error' })).toBeVisible();
      await expect(errorSheets.first()).toContainText(/could not be reached/i);

      // Dismiss every sheet: while one is up the content behind it is not visible, and several
      // are opened because several API calls fail.
      for (let i = 0; i < 10 && (await errorSheets.count()) > 0; i++) {
        await errorSheets.first().getByRole('button').first().click();
        await expect(errorSheets).toHaveCount(Math.max(0, (await errorSheets.count()) - 1), {
          timeout: 10000,
        });
      }
      await expect(errorSheets).toHaveCount(0, { timeout: 15000 });

      // expect: the page itself reports the API is unreachable, with the recovery instruction.
      await expect(
        page.getByRole('heading', { name: /The API web service is not responding/i })
      ).toBeVisible({ timeout: 30000 });
      await expect(
        page.getByRole('heading', { name: /Please refresh this page/i })
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole('heading', { name: /contact the site administrator/i })
      ).toBeVisible({ timeout: 15000 });

      // expect: the normal dashboard content is suppressed rather than rendered empty — the
      // same `apiIsSick` flag gates it (home-app.component.html:23, 36).
      await expect(page.getByRole('button', { name: /Manage an Event/i })).toHaveCount(0);
    } finally {
      // Always drop the intercept, even if an assertion above fails, so the page is not left
      // routed for anything that reuses this context.
      await page.unrouteAll();
    }
  });
});
