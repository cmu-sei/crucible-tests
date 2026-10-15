// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
//
// MSEL "Player Apps" section: the Player Applications list (player-application-list) and its
// edit dialog (player-application-edit-dialog). Team assignment is in
// player-application-teams.spec.ts; the Team Application Order drag panel is covered elsewhere.
//
// Every test seeds its own MSEL with `usePlayer` on. Player applications cascade-delete with
// the MSEL, so the MSEL delete in afterEach is the only cleanup they need.

import { test, expect } from '../../fixtures';
import type { Locator, Page } from '@playwright/test';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  createPlayerApplication,
  listPlayerApplications,
  navigateToMsel,
  navigateToMselSection,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * Open the MSEL's Player Apps section and expand its "Player Applications" panel. The panel
 * starts collapsed, and the add button lives in the table header inside it.
 */
async function openPlayerApplicationsPanel(page: Page, mselId: string): Promise<Locator> {
  await navigateToMselSection(page, mselId, 'Player Apps');
  const panel = page
    .locator('mat-expansion-panel')
    .filter({ has: page.locator('h4', { hasText: /^Player Applications$/ }) });
  const header = panel.locator('mat-expansion-panel-header');
  await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  await expect(panel.getByRole('button', { name: 'Add Player Application' })).toBeVisible();
  return panel;
}

/** The list row for one application, found by its (unique) Edit button. */
function appRow(panel: Locator, name: string): Locator {
  return panel.getByRole('row').filter({ has: panel.page().getByRole('button', { name: `Edit ${name}` }) });
}

test.describe('Player Applications', () => {
  let token: string;
  let mselId: string | undefined;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, { name: tempBlueprintName('TestBP-PlayerApps') });
    mselId = msel.id;
    await updateMsel(token, mselId, { usePlayer: true });
  });

  test.afterEach(async () => {
    if (mselId) await deleteMsel(token, mselId);
    mselId = undefined;
  });

  test('Player Apps section is offered only when the MSEL uses Player', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    await updateMsel(token, mselId!, { usePlayer: false });
    await navigateToMsel(page, mselId!);

    // navigateToMsel waited for the section list; the always-present sections prove it rendered.
    await expect(page.locator('mat-list-item').filter({ hasText: 'Teams' }).first()).toBeVisible();
    // expect: no Player Apps section while the MSEL does not use Player
    await expect(page.locator('mat-list-item').filter({ hasText: 'Player Apps' })).toHaveCount(0);

    await updateMsel(token, mselId!, { usePlayer: true });
    await navigateToMsel(page, mselId!);

    // expect: the section appears once the MSEL uses Player
    await expect(page.locator('mat-list-item').filter({ hasText: 'Player Apps' })).toBeVisible();
  });

  test('Create a player application, with URL variable validation', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const name = tempBlueprintName('TestBP-PlayerApp');
    const panel = await openPlayerApplicationsPanel(page, mselId!);

    await panel.getByRole('button', { name: 'Add Player Application' }).click();
    await page.getByRole('menuitem', { name: 'New Player Application' }).click();

    const dialog = page.getByRole('dialog').filter({ hasText: 'Add a Player Application' });
    await expect(dialog).toBeVisible();
    // expect: a new application defaults to embeddable, not loaded in the background
    await expect(dialog.getByRole('checkbox', { name: 'Embeddable' })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Load in Background' })).not.toBeChecked();

    const urlField = dialog.getByRole('textbox', { name: 'URL', exact: true });
    const save = dialog.getByRole('button', { name: 'Save' });
    await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill(name);

    // expect: a variable outside the allowed list is rejected, and the dialog stays open
    await urlField.fill('https://example.test/{notAVariable}');
    await save.click();
    await expect(dialog.getByText('Unknown variable(s): {notAVariable}')).toBeVisible();
    await expect(dialog).toBeVisible();

    // expect: an unterminated variable is rejected too
    await urlField.fill('https://example.test/view/{playerViewId');
    await save.click();
    await expect(dialog.getByText('URL contains unpaired or invalid braces')).toBeVisible();
    await expect(dialog).toBeVisible();

    // expect: the Icon URL is validated the same way
    const validUrl = 'https://example.test/msel/{blueprintMselId}/view/{playerViewId}';
    await urlField.fill(validUrl);
    await dialog.getByRole('textbox', { name: 'Icon URL' }).fill('{galleryUrl}/icon}.png');
    await save.click();
    await expect(dialog.getByText('URL contains unpaired or invalid braces')).toBeVisible();
    await expect(dialog).toBeVisible();

    await dialog.getByRole('textbox', { name: 'Icon URL' }).fill('{galleryUrl}/assets/icon.png');
    await dialog.getByRole('checkbox', { name: 'Load in Background' }).check();
    await save.click();

    // expect: the dialog closes and the list shows the new row with its unsubstituted URL
    await expect(dialog).toBeHidden();
    const row = appRow(panel, name);
    await expect(row).toBeVisible();
    await expect(row).toContainText(validUrl);

    // Secondary: it persisted with the dialog's values.
    const apps = await listPlayerApplications(token, mselId!);
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({
      name,
      url: validUrl,
      icon: '{galleryUrl}/assets/icon.png',
      embeddable: true,
      loadInBackground: true,
    });
  });

  test('Edit and delete a player application', async ({ blueprintAuthenticatedPage: page }) => {
    const app = await createPlayerApplication(token, mselId!, {
      name: tempBlueprintName('TestBP-PlayerApp'),
      url: 'https://example.test/original',
      embeddable: true,
    });
    const renamed = tempBlueprintName('TestBP-PlayerAppRenamed');
    const panel = await openPlayerApplicationsPanel(page, mselId!);
    await expect(appRow(panel, app.name)).toContainText('https://example.test/original');

    // Edit
    await panel.getByRole('button', { name: `Edit ${app.name}` }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Edit Player Application' });
    await expect(dialog).toBeVisible();
    // expect: the dialog opens on the application's current values
    const nameField = dialog.getByRole('textbox', { name: 'Name', exact: true });
    await expect(nameField).toHaveValue(app.name);
    await expect(dialog.getByRole('textbox', { name: 'URL', exact: true })).toHaveValue(
      'https://example.test/original'
    );
    await expect(dialog.getByRole('checkbox', { name: 'Embeddable' })).toBeChecked();

    await nameField.fill(renamed);
    await dialog.getByRole('textbox', { name: 'URL', exact: true }).fill('https://example.test/{playerViewId}');
    await dialog.getByRole('checkbox', { name: 'Embeddable' }).uncheck();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();

    // expect: the row now carries the new name and URL, and the old name is gone
    await expect(appRow(panel, renamed)).toContainText('https://example.test/{playerViewId}');
    await expect(panel.getByRole('button', { name: `Edit ${app.name}` })).toHaveCount(0);

    const [edited] = await listPlayerApplications(token, mselId!);
    expect(edited).toMatchObject({ id: app.id, name: renamed, embeddable: false });

    // Delete
    await panel.getByRole('button', { name: `Delete ${renamed}` }).click();
    const confirm = page.getByRole('dialog').filter({ hasText: 'Delete PlayerApplication' });
    await expect(confirm).toContainText(`Are you sure that you want to delete ${renamed}?`);
    await confirm.getByRole('button', { name: /YES/i }).click();

    // expect: the row disappears
    await expect(confirm).toBeHidden();
    await expect(panel.getByRole('button', { name: `Edit ${renamed}` })).toHaveCount(0);
    expect(await listPlayerApplications(token, mselId!)).toHaveLength(0);
  });

  test('Cancelling a delete keeps the player application', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const app = await createPlayerApplication(token, mselId!);
    const panel = await openPlayerApplicationsPanel(page, mselId!);

    await panel.getByRole('button', { name: `Delete ${app.name}` }).click();
    const confirm = page.getByRole('dialog').filter({ hasText: 'Delete PlayerApplication' });
    await confirm.getByRole('button', { name: 'No', exact: true }).click();

    await expect(confirm).toBeHidden();
    await expect(appRow(panel, app.name)).toBeVisible();
    expect(await listPlayerApplications(token, mselId!)).toHaveLength(1);
  });

  test('Sort player applications by name and by URL', async ({ blueprintAuthenticatedPage: page }) => {
    // Names and URLs sort in opposite orders, so the two sorts are distinguishable.
    const first = await createPlayerApplication(token, mselId!, {
      name: tempBlueprintName('TestBP-PlayerApp-A'),
      url: 'https://z.example.test/',
    });
    const second = await createPlayerApplication(token, mselId!, {
      name: tempBlueprintName('TestBP-PlayerApp-B'),
      url: 'https://a.example.test/',
    });
    const panel = await openPlayerApplicationsPanel(page, mselId!);
    const nameCells = panel.locator('td.column-name');

    // expect: listed by name by default
    await expect(nameCells).toHaveText([first.name, second.name]);

    await panel.getByRole('button', { name: 'Name' }).click();
    await panel.getByRole('button', { name: 'Name' }).click();
    // expect: a second click on Name reverses the order
    await expect(nameCells).toHaveText([second.name, first.name]);

    const urlHeader = panel.getByRole('columnheader', { name: 'URL' });
    await panel.getByRole('button', { name: 'URL' }).click();
    await expect(urlHeader).toHaveAttribute('aria-sort', 'ascending');
    // Pending upstream: getSortedPlayerApplications has no 'url' case, so its default branch
    // sorts by name in the header's direction. URL-ascending therefore lists by name ascending
    // (z.example.test first). When it sorts by URL, expect [second, first] here and
    // [first, second] after the second click.
    await expect(nameCells).toHaveText([first.name, second.name]);
    await panel.getByRole('button', { name: 'URL' }).click();
    await expect(urlHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(nameCells).toHaveText([second.name, first.name]);
  });
});
