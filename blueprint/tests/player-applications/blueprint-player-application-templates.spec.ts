// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
//
// Blueprint's own Player application templates: managed on the admin page's Player Application
// Templates section, and offered first in a MSEL's Player Applications Add menu, ahead of
// Player's templates (player-application-templates.spec.ts covers those). PlayerApplicationEndpointTests
// owns the API rules; what only the browser shows is that the admin list and the MSEL menu are
// wired to the same templates, and that picking one copies its values rather than moving it.
//
// A template has no MSEL, so the MSEL delete cascade does not reach it: each test deletes its own
// templates in a finally block (purgeAllBlueprintTestData also sweeps leftover tempBlueprintName()
// templates).

import { test, expect, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import type { Locator, Page } from '@playwright/test';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  createBlueprintPlayerApplicationTemplate,
  deleteBlueprintRecord,
  gotoBlueprintAdminSection,
  listPlayerApplications,
  listTemplates,
  navigateToMselSection,
  tempBlueprintName,
} from '../../test-helpers';

const SECTION = 'Player Apps';

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

/** A row of the admin template list, found by its (unique) Edit button. */
function templateRow(page: Page, name: string): Locator {
  return page.getByRole('row').filter({ has: page.getByRole('button', { name: `Edit ${name}` }) });
}

async function deleteTemplatesNamed(token: string, ...names: string[]): Promise<void> {
  for (const t of await listTemplates(token, 'playerApplications')) {
    if (names.includes(t.name)) {
      await deleteBlueprintRecord(token, 'playerApplications', t.id);
    }
  }
}

for (const theme of BLUEPRINT_THEMES) {
  test.describe(`${theme} theme › Blueprint Player Application Templates`, () => {
    test('Create a template in admin and add a copy of it to a MSEL', async ({
      blueprintAuthenticatedPage: page,
    }) => {
      await applyBlueprintTheme(page, theme);
      const token = await getBlueprintToken();
      const name = tempBlueprintName('TestBP-BlueprintAppTemplate');
      const url = '{vmUrl}/views/{playerViewId}?{theme}';
      const icon = '{vmUrl}/assets/img/SP_Icon_Virtual.png';
      const msel = await createMsel(token, { name: tempBlueprintName('TestBP-BlueprintAppTemplates') });

      try {
        await updateMsel(token, msel.id, { usePlayer: true });

        // 1. Create the template on the admin page.
        await gotoBlueprintAdminSection(page, SECTION);
        await page.getByRole('button', { name: 'Add a template Player Application' }).click();
        const createDialog = page.getByRole('dialog').filter({ hasText: 'Add a Player Application Template' });
        await expect(createDialog).toBeVisible();
        await createDialog.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
        await createDialog.getByRole('textbox', { name: 'URL', exact: true }).fill(url);
        await createDialog.getByRole('textbox', { name: 'Icon URL' }).fill(icon);
        await createDialog.getByRole('checkbox', { name: 'Embeddable' }).uncheck();
        await createDialog.getByRole('checkbox', { name: 'Load in Background' }).check();
        await createDialog.getByRole('button', { name: 'Save' }).click();
        await expect(createDialog).toBeHidden();

        // expect: the template is listed, and stored with no MSEL
        await expect(templateRow(page, name)).toContainText(url);
        const [template] = (await listTemplates(token, 'playerApplications')).filter((t) => t.name === name);
        expect(template).toMatchObject({ mselId: null, isTemplate: true, url, icon, embeddable: false, loadInBackground: true });

        // 2. In the MSEL, the Add menu offers it among Blueprint's own templates, not under From Player.
        const panel = await openPlayerApplicationsPanel(page, msel.id);
        await panel.getByRole('button', { name: 'Add Player Application' }).click();
        const item = page.getByRole('menuitem', { name });
        await expect(item).toHaveAttribute('title', url);
        await expect(page.getByRole('group', { name: 'From Player' }).getByRole('menuitem', { name })).toHaveCount(0);
        await item.click();

        // expect: the dialog opens prefilled with the template's values
        const addDialog = page.getByRole('dialog').filter({ hasText: 'Add a Player Application' });
        await expect(addDialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(name);
        await expect(addDialog.getByRole('textbox', { name: 'URL', exact: true })).toHaveValue(url);
        await expect(addDialog.getByRole('textbox', { name: 'Icon URL' })).toHaveValue(icon);
        await expect(addDialog.getByRole('checkbox', { name: 'Embeddable' })).not.toBeChecked();
        await expect(addDialog.getByRole('checkbox', { name: 'Load in Background' })).toBeChecked();
        await addDialog.getByRole('button', { name: 'Save' }).click();
        await expect(addDialog).toBeHidden();

        // expect: the MSEL has a copy with its own id; the template is still a template
        await expect(panel.getByRole('button', { name: `Edit ${name}` })).toBeVisible();
        const apps = await listPlayerApplications(token, msel.id);
        expect(apps).toHaveLength(1);
        expect(apps[0]).toMatchObject({
          mselId: msel.id,
          isTemplate: false,
          name,
          url,
          icon,
          embeddable: false,
          loadInBackground: true,
        });
        expect(apps[0].id).not.toBe(template.id);
        const stillThere = (await listTemplates(token, 'playerApplications')).filter((t) => t.id === template.id);
        expect(stillThere).toHaveLength(1);
        expect(stillThere[0].mselId).toBeNull();
      } finally {
        await deleteTemplatesNamed(token, name);
        // Cascades to the MSEL's copy of the application.
        await deleteMsel(token, msel.id);
      }
    });

    test('Edit and delete a template in admin', async ({ blueprintAuthenticatedPage: page }) => {
      await applyBlueprintTheme(page, theme);
      const token = await getBlueprintToken();
      const name = tempBlueprintName('TestBP-BlueprintAppTemplate');
      const renamed = tempBlueprintName('TestBP-BlueprintAppTemplateEdited');

      try {
        await createBlueprintPlayerApplicationTemplate(token, { name, url: '{galleryUrl}?{theme}' });
        await gotoBlueprintAdminSection(page, SECTION);

        // 1. Edit: the dialog is prefilled, and the change is stored.
        await page.getByRole('button', { name: `Edit ${name}` }).click();
        const editDialog = page.getByRole('dialog').filter({ hasText: 'Edit Player Application Template' });
        await expect(editDialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(name);
        await editDialog.getByRole('textbox', { name: 'Name', exact: true }).fill(renamed);
        await editDialog.getByRole('button', { name: 'Save' }).click();
        await expect(editDialog).toBeHidden();
        await expect(templateRow(page, renamed)).toHaveCount(1);
        await expect(templateRow(page, name)).toHaveCount(0);
        const names = (await listTemplates(token, 'playerApplications')).map((t) => t.name);
        expect(names).toContain(renamed);
        expect(names).not.toContain(name);

        // 2. Delete, through the template-specific confirmation.
        await page.getByRole('button', { name: `Delete ${renamed}` }).click();
        const confirm = page.getByRole('dialog').filter({ hasText: 'Delete Player Application Template' });
        await expect(confirm).toContainText(`Are you sure that you want to delete ${renamed}?`);
        await confirm.getByRole('button', { name: 'Yes' }).click();
        await expect(templateRow(page, renamed)).toHaveCount(0);
        expect((await listTemplates(token, 'playerApplications')).map((t) => t.name)).not.toContain(renamed);
      } finally {
        await deleteTemplatesNamed(token, name, renamed);
      }
    });
  });
}
