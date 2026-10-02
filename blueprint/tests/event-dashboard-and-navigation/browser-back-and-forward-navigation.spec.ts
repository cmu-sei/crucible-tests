// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Browser history across the dashboard, the /build list and a MSEL opened from it. Opening a
// MSEL from the list is an in-app router navigation to `/build?msel=<id>`, so this checks that
// the app restores the right *view* on back/forward — the list vs. the MSEL detail — and not
// just the URL.
//
// Rewritten: the previous version clicked "the first MSEL-looking link", which depended on
// what the database happened to hold, and fell into a URL-only fallback when there was none.
// It now seeds its own MSEL.

import { test, expect, Services, serviceUrlPattern } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  tempBlueprintName,
  findMselRowByName,
} from '../../test-helpers';

test.describe('Event Dashboard and Navigation', () => {
  let token: string;
  let mselId: string | undefined;

  test.afterEach(async () => {
    if (mselId) await deleteMsel(token, mselId);
  });

  test('Browser Back and Forward Navigation', async ({ blueprintAuthenticatedPage: page }) => {
    token = await getBlueprintToken();
    const mselName = tempBlueprintName('BackFwd');
    mselId = (await createMsel(token, { name: mselName })).id;

    // 1. Start on the dashboard.
    await expect(page).toHaveURL(serviceUrlPattern(Services.Blueprint.UI), { timeout: 30000 });
    const dashboardCard = page.getByText('Manage an Event').first();
    await expect(dashboardCard).toBeVisible({ timeout: 15000 });

    // 2. Go to the /build list and open the seeded MSEL from it.
    await page.goto(`${Services.Blueprint.UI}/build`);
    const addBlankMsel = page.getByRole('button', { name: 'Add blank MSEL' });
    await expect(addBlankMsel).toBeVisible({ timeout: 15000 });
    const row = await findMselRowByName(page, mselName);
    await row.getByRole('link', { name: mselName }).click();

    // expect: the MSEL detail view is shown for that MSEL.
    await expect(page).toHaveURL(new RegExp(`[?&]msel=${mselId}`), { timeout: 15000 });
    const infoSection = page.locator('mat-list-item').filter({ hasText: 'Info' }).first();
    const nameField = page.getByRole('textbox', { name: 'Name' });
    await expect(infoSection).toBeVisible({ timeout: 15000 });
    await expect(nameField).toHaveValue(mselName, { timeout: 15000 });

    // 3. Back: the list is shown again, not the MSEL.
    await page.goBack();
    await expect(page).not.toHaveURL(/[?&]msel=/, { timeout: 10000 });
    await expect(addBlankMsel).toBeVisible({ timeout: 15000 });
    await expect(infoSection).toBeHidden();

    // 4. Back again: the dashboard.
    await page.goBack();
    await expect(dashboardCard).toBeVisible({ timeout: 15000 });
    await expect(addBlankMsel).toBeHidden();

    // 5. Forward: the list.
    await page.goForward();
    await expect(addBlankMsel).toBeVisible({ timeout: 15000 });

    // 6. Forward again: the same MSEL's detail view.
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`[?&]msel=${mselId}`), { timeout: 10000 });
    await expect(nameField).toHaveValue(mselName, { timeout: 15000 });
  });
});
