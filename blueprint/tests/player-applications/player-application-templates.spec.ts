// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
//
// Adding a player application from a Player application template. The Add menu lists the
// templates live from the Player API, so each test seeds its own template there and deletes it
// in teardown (purgeAllBlueprintTestData also sweeps leftover TestBP- templates).

import { test, expect } from '../../fixtures';
import type { Locator, Page } from '@playwright/test';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  createPlayerApplicationTemplate,
  deletePlayerApplicationTemplate,
  listPlayerApplications,
  navigateToMselSection,
  tempBlueprintName,
} from '../../test-helpers';

async function openPlayerApplicationsPanel(page: Page, mselId: string): Promise<Locator> {
  await navigateToMselSection(page, mselId, 'Player Apps');
  const panel = page
    .locator('mat-expansion-panel')
    .filter({ has: page.locator('h4', { hasText: /^Player Applications$/ }) });
  await panel.locator('mat-expansion-panel-header').click();
  await expect(panel.getByRole('button', { name: 'Add Player Application' })).toBeVisible();
  return panel;
}

test.describe('Player Application Templates', () => {
  let token: string;
  let mselId: string | undefined;
  let templateId: string | undefined;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, { name: tempBlueprintName('TestBP-PlayerAppTemplates') });
    mselId = msel.id;
    await updateMsel(token, mselId, { usePlayer: true });
  });

  test.afterEach(async () => {
    if (templateId) await deletePlayerApplicationTemplate(token, templateId);
    templateId = undefined;
    if (mselId) await deleteMsel(token, mselId);
    mselId = undefined;
  });

  test('Add a player application from a Player template', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const template = await createPlayerApplicationTemplate(token, {
      name: tempBlueprintName('TestBP-PlayerTemplate'),
      url: 'https://example.test/gallery/{galleryExhibitId}',
      icon: 'https://example.test/icon.png',
      embeddable: false,
      loadInBackground: true,
    });
    templateId = template.id;

    const panel = await openPlayerApplicationsPanel(page, mselId!);
    await panel.getByRole('button', { name: 'Add Player Application' }).click();

    // expect: the template is offered in the Add menu, titled with its URL
    const item = page.getByRole('menuitem', { name: template.name });
    await expect(item).toHaveAttribute('title', template.url);
    await item.click();

    // expect: the dialog opens prefilled from the template
    const dialog = page.getByRole('dialog').filter({ hasText: 'Add a Player Application' });
    await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(template.name);
    await expect(dialog.getByRole('textbox', { name: 'URL', exact: true })).toHaveValue(template.url);
    await expect(dialog.getByRole('textbox', { name: 'Icon URL' })).toHaveValue(
      'https://example.test/icon.png'
    );
    await expect(dialog.getByRole('checkbox', { name: 'Embeddable' })).not.toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Load in Background' })).toBeChecked();

    await dialog.getByRole('button', { name: 'Save' }).click();

    // expect: a MSEL application is created from it (a copy, not the template itself)
    await expect(dialog).toBeHidden();
    await expect(panel.getByRole('button', { name: `Edit ${template.name}` })).toBeVisible();
    const apps = await listPlayerApplications(token, mselId!);
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({
      name: template.name,
      url: template.url,
      embeddable: false,
      loadInBackground: true,
    });
    expect(apps[0].id).not.toBe(template.id);
  });

  test('A template using Player-only URL variables must be edited before it can be saved', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    // Player's own templates use {viewId}; Blueprint's dialog only accepts its own variable list.
    const template = await createPlayerApplicationTemplate(token, {
      name: tempBlueprintName('TestBP-PlayerTemplate'),
      url: 'https://example.test/view/{viewId}',
      embeddable: true,
    });
    templateId = template.id;

    const panel = await openPlayerApplicationsPanel(page, mselId!);
    await panel.getByRole('button', { name: 'Add Player Application' }).click();
    await page.getByRole('menuitem', { name: template.name }).click();

    const dialog = page.getByRole('dialog').filter({ hasText: 'Add a Player Application' });
    await dialog.getByRole('button', { name: 'Save' }).click();

    // Pending upstream: Player documents {viewId} as a template variable, but Blueprint's URL
    // validator rejects it, so a stock Player template cannot be added unedited. Once Blueprint
    // accepts (or translates) Player's variables, this first Save should succeed.
    await expect(dialog.getByText('Unknown variable(s): {viewId}')).toBeVisible();
    await expect(dialog).toBeVisible();

    await dialog.getByRole('textbox', { name: 'URL', exact: true }).fill('https://example.test/view/{playerViewId}');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(dialog).toBeHidden();
    await expect(panel.getByRole('button', { name: `Edit ${template.name}` })).toBeVisible();
    const [app] = await listPlayerApplications(token, mselId!);
    expect(app.url).toBe('https://example.test/view/{playerViewId}');
  });
});
