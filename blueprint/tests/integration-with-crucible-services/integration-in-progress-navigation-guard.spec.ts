// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// The /build route's IntegrationInProgressGuard (canDeactivate): while the active MSEL's
// `integrationStatus` is set and is not an ERROR, leaving the page in-app asks
// `confirm('An integration push is in progress. Are you sure you want to leave?')`.
//
// Reaching that state: the precondition is seeded by writing `integrationStatus` through the
// MSEL PUT, which the API maps from the request body. A real push is not used — its status
// only lasts while the background integration worker runs (a race against the test), and it
// leaves Player/Gallery/CITE records that need a pull to clean up. The push pipeline itself is
// Blueprint.Api.Tests' job (IntegrationServicePushTests); this spec covers what the browser
// does with the status.
//
// The guard only runs on router navigation, so each test leaves /build through the topbar's
// home link (routerLink "/"); `page.goto` or a reload would bypass it.

import { Page } from '@playwright/test';
import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  navigateToMsel,
} from '../../test-helpers';

const GUARD_MESSAGE = 'An integration push is in progress';

/** The topbar link back to the dashboard — an in-app navigation, so the guard runs. */
function homeLink(page: Page) {
  return page.locator('mat-toolbar a[href="/"]').first();
}

test.describe('Integration In Progress Navigation Guard', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    mselId = (await createMsel(token)).id;
  });

  test.afterEach(async () => {
    if (mselId) await deleteMsel(token, mselId);
  });

  test('Dismissing the confirmation keeps the user on the MSEL during a push', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    await updateMsel(token, mselId, { integrationStatus: 'Pushing Integrations' });

    // 1. Open the MSEL
    await navigateToMsel(page, mselId);

    // expect: the push in progress is shown
    await expect(page.getByText('Processing integrations ...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel Push' })).toBeVisible();

    // 2. Click the topbar home link and dismiss the confirmation
    const dialogs: { type: string; message: string }[] = [];
    page.once('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.dismiss();
    });
    await homeLink(page).click();

    // expect: a native confirm warning about the push was shown
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0].type).toBe('confirm');
    expect(dialogs[0].message).toContain(GUARD_MESSAGE);

    // expect: navigation was cancelled — still on this MSEL with the push status showing
    await expect(page).toHaveURL(new RegExp(`/build\\?msel=${mselId}`));
    await expect(page.getByText('Processing integrations ...')).toBeVisible();
  });

  test('Accepting the confirmation leaves the MSEL during a push', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    await updateMsel(token, mselId, { integrationStatus: 'Pushing Integrations' });

    // 1. Open the MSEL
    await navigateToMsel(page, mselId);
    await expect(page.getByText('Processing integrations ...')).toBeVisible();

    // 2. Click the topbar home link and accept the confirmation
    const dialogs: { type: string; message: string }[] = [];
    page.once('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });
    await homeLink(page).click();

    // expect: the confirm was shown, and accepting it navigated to the dashboard
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0].type).toBe('confirm');
    expect(dialogs[0].message).toContain(GUARD_MESSAGE);
    await expect(page).not.toHaveURL(/\/build/);
    await expect(page).toHaveURL(new RegExp(`^${Services.Blueprint.UI.replace(/\/$/, '')}/?$`));
  });

  test('A failed integration does not block leaving the MSEL', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    // An ERROR status means nothing is running any more, so the guard lets the user go.
    await updateMsel(token, mselId, { integrationStatus: 'ERROR: Player push failed' });

    // 1. Open the MSEL
    await navigateToMsel(page, mselId);

    // expect: the failure is shown, not a push in progress
    await expect(page.getByText('Integration Failed')).toBeVisible();
    await expect(page.getByText('Processing integrations ...')).toBeHidden();

    // 2. Click the topbar home link
    // An unexpected confirm would be auto-dismissed by Playwright and block the navigation;
    // recording it makes the failure say why.
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    await homeLink(page).click();

    // expect: navigation happens with no confirmation
    await expect(page).not.toHaveURL(/\/build/);
    expect(dialogs, 'no confirmation for a failed integration').toEqual([]);
  });
});
