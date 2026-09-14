// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md

import { APIRequestContext, expect, request as playwrightRequest, test } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import {
  createPlayerViewWithDefaultTeam,
  createPlayerViewWithoutDefaultTeam,
  deletePlayerView,
  getAlloyPlayerToken,
  SeededPlayerView,
} from '../../test-helpers';

/**
 * An Alloy event template may only point at a Player view that has a default team. Without one,
 * Alloy has to guess which team to put the launching user on - it takes the first team that does
 * not look administrative, and fails the launch outright if there is no such team.
 *
 * Two halves are covered here, because either alone would be misleading:
 *  - the dropdown refuses to offer such a view, and says why;
 *  - the API refuses to save one, so the rule cannot be bypassed by a direct call.
 */

const NAME_PREFIX = 'AlloyDefaultTeam';

interface ApiResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
  text: string;
}

async function alloyApi<T = any>(
  token: string,
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: any } = {}
): Promise<ApiResult<T>> {
  const base = Services.Alloy.API.replace(/\/$/, '');
  const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const response = await ctx.fetch(`${base}${path}`, {
      method: options.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}` },
      data: options.body,
    });
    const text = await response.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = undefined;
    }
    return { ok: response.ok(), status: response.status(), data, text };
  } finally {
    await ctx.dispose();
  }
}

function templateBody(name: string, viewId?: string) {
  return {
    name,
    description: 'Automated default-team test. Will be deleted after the test.',
    durationHours: 1,
    useDynamicHost: false,
    isPublished: false,
    viewId,
  };
}

test.describe('Event Templates Management - Player view default team', () => {
  let token: string;
  let goodView: SeededPlayerView;
  let badView: SeededPlayerView;
  const createdTemplateIds: string[] = [];

  test.beforeEach(async () => {
    token = await getAlloyPlayerToken();
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    goodView = await createPlayerViewWithDefaultTeam(token, `${NAME_PREFIX} Good ${stamp}`);
    badView = await createPlayerViewWithoutDefaultTeam(token, `${NAME_PREFIX} Bad ${stamp}`);
  });

  // Cleanup is entirely through the API: the UI case cancels out of the dialog without saving,
  // so no template is ever created from the browser, and a page-driven purge would need an
  // authenticated session the API-only case does not have.
  test.afterEach(async () => {
    for (const id of createdTemplateIds.splice(0)) {
      await alloyApi(token, `/api/eventTemplates/${id}`, { method: 'DELETE' });
    }
    await deletePlayerView(token, goodView.id);
    await deletePlayerView(token, badView.id);
  });

  test('A view with no default team cannot be selected in the Player View dropdown', async ({
    page,
  }) => {
    // 1. Open the create dialog on the admin Event Templates page.
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    const dialog = page.getByRole('dialog', { name: 'Create New Event Template' });
    await page.getByRole('button', { name: 'Add Event Template' }).click();
    await expect(dialog).toBeVisible();

    // 2. Open the Player View dropdown and narrow it to the two seeded views. Filtering by the
    //    shared prefix also keeps other tests' views out of the assertions below.
    const combobox = dialog.getByRole('combobox', { name: 'Player View Template' });
    await combobox.click();
    await combobox.fill(NAME_PREFIX);

    const badOption = page.getByRole('option', { name: new RegExp(badView.name) });
    const goodOption = page.getByRole('option', { name: new RegExp(goodView.name) });
    await expect(badOption).toBeVisible({ timeout: 15000 });
    await expect(goodOption).toBeVisible();

    // expect: the view with no default team is offered but not selectable, and says why in
    // text - not by colour alone, since the tooltip is unreachable without a mouse.
    await expect(badOption).toBeDisabled();
    await expect(badOption).toContainText('no default team');

    // expect: the view that has a default team is selectable and carries no marker.
    await expect(goodOption).toBeEnabled();
    await expect(goodOption).not.toContainText('no default team');

    // 3. Clicking the disabled option must not select it. `force` bypasses Playwright's own
    //    enabled-check so we test Material's behaviour rather than the harness's.
    await badOption.click({ force: true });
    await expect(combobox).not.toHaveValue(badView.name);

    // 4. Selecting the good view works normally.
    await goodOption.click();
    await expect(combobox).toHaveValue(goodView.name);

    await dialog.getByRole('button', { name: 'Cancel' }).first().click();
  });

  test('The API rejects an event template whose view has no default team', async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

    // 1. Create with the bad view -> rejected, with the reason in ProblemDetails.title.
    const rejected = await alloyApi(token, '/api/eventTemplates', {
      method: 'POST',
      body: templateBody(`${NAME_PREFIX} Rejected ${stamp}`, badView.id),
    });
    expect(rejected.status, rejected.text).toBe(400);
    expect(rejected.data?.title).toContain('no default team');

    // expect: nothing was created.
    const all = await alloyApi<Array<{ name: string }>>(token, '/api/eventTemplates');
    expect(all.ok).toBeTruthy();
    expect(all.data.some((t) => t.name === `${NAME_PREFIX} Rejected ${stamp}`)).toBeFalsy();

    // 2. A viewId that does not exist is rejected too - being unable to confirm a default team
    //    is not the same as there being one.
    const unknown = await alloyApi(token, '/api/eventTemplates', {
      method: 'POST',
      body: templateBody(`${NAME_PREFIX} Unknown ${stamp}`, crypto.randomUUID()),
    });
    expect(unknown.status, unknown.text).toBe(400);
    expect(unknown.data?.title).toContain('Could not verify');

    // 3. The good view is accepted, and so is a template with no view at all.
    const accepted = await alloyApi<{ id: string }>(token, '/api/eventTemplates', {
      method: 'POST',
      body: templateBody(`${NAME_PREFIX} Accepted ${stamp}`, goodView.id),
    });
    expect(accepted.status, accepted.text).toBe(201);
    createdTemplateIds.push(accepted.data.id);

    const noView = await alloyApi<{ id: string }>(token, '/api/eventTemplates', {
      method: 'POST',
      body: templateBody(`${NAME_PREFIX} NoView ${stamp}`),
    });
    expect(noView.status, noView.text).toBe(201);
    createdTemplateIds.push(noView.data.id);

    // 4. An update that would move a valid template onto the bad view is rejected, and leaves
    //    the stored template untouched.
    const rejectedUpdate = await alloyApi(token, `/api/eventTemplates/${accepted.data.id}`, {
      method: 'PUT',
      body: { ...accepted.data, viewId: badView.id, description: 'Should not be saved.' },
    });
    expect(rejectedUpdate.status, rejectedUpdate.text).toBe(400);

    const reread = await alloyApi<{ viewId: string; description: string }>(
      token,
      `/api/eventTemplates/${accepted.data.id}`
    );
    expect(reread.ok).toBeTruthy();
    expect(reread.data.viewId).toBe(goodView.id);
    expect(reread.data.description).not.toBe('Should not be saved.');
  });
});
