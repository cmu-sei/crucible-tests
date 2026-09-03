// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

// Verifies Gameboard escapes/ignores script content submitted via a text
// input. If a script were to execute, it would trigger an alert dialog; we
// fail the test if any dialog appears.
test.describe('Error Handling', () => {
  test('XSS Protection - Script Injection in Forms', async ({ gameboardAuthenticatedPage: page }) => {
    let dialogFired = false;
    page.on('dialog', async (d) => {
      dialogFired = true;
      await d.dismiss();
    });

    await page.goto(Services.Gameboard.UI + '/user/profile', { waitUntil: 'domcontentloaded' });
    const requested = page.locator('input[name="requestedName"]');
    await expect(requested).toBeVisible();

    const payload = `<script>alert('xss')</script>`;
    await requested.fill(payload);
    await expect(requested).toHaveValue(payload);
    // Click Request to submit (status becomes pending; approval is manual).
    await page.getByRole('button', { name: /^Request$/ }).click();
    await page.waitForTimeout(2000);

    // No dialog should have fired — the payload must be treated as data, not HTML.
    expect(dialogFired).toBe(false);

    // The rendered page body should not contain an actual <script> element
    // injected from our payload.
    const injectedScripts = await page.locator('script:has-text("xss")').count();
    expect(injectedScripts).toBe(0);
  });
});
