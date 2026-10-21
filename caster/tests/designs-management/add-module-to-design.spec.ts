// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { Locator, Page } from '@playwright/test';
import {
  test,
  expect,
  casterApi,
  openCasterDirectory,
  requireTestModuleCatalog,
  seedCasterDesign,
  seedCasterDirectory,
  seedCasterProject,
  CASTER_THEMES,
  setCasterTheme,
} from '../../fixtures';

// The modules come from caster/module-catalog: Blank Machine has a required
// `vm_name`, a bool `enable_backup` defaulting to false and a number `cpus`
// defaulting to 4; Router / Gateway has a required `wan_network`. Both are tagged
// v1.0.0 and v1.1.0.

const NAME_ERROR = 'Must start with a letter or _, then letters, numbers, - and _ only';

/** Seed a project, directory and design, open the design's tab, and return the design ID. */
async function openNewDesign(page: Page, projectName: string, register: (id: string) => void): Promise<string> {
  const projectId = await seedCasterProject(page, projectName);
  register(projectId);
  const directoryId = await seedCasterDirectory(page, projectId, 'Designer-Dir');
  const designId = await seedCasterDesign(page, directoryId, 'Designer Design');

  await openCasterDirectory(page, projectId, 'Designer-Dir');
  await page.getByRole('button', { name: 'DESIGNS', exact: true }).click();
  await page.getByRole('region', { name: 'DESIGNS' }).getByText('Designer Design', { exact: true }).click();
  await expect(page.getByRole('tab', { name: /Designer Design/ })).toHaveAttribute('aria-selected', 'true');
  return designId;
}

/** Pick a module from the Designer's list and return its variables dialog. */
async function pickModule(page: Page, moduleName: string): Promise<Locator> {
  await page.getByRole('button', { name: 'Add Module' }).click();
  await page.locator('mat-card.module-card', { hasText: moduleName }).click();
  const dialog = page.getByRole('dialog', { name: moduleName });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** The design's module cards, by the title each shows. */
function moduleCard(page: Page, name: string): Locator {
  return page.locator('cas-design-module mat-card').filter({
    has: page.locator('mat-card-title', { hasText: new RegExp(`^\\s*${name}\\s*$`) }),
  });
}

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Designs Management`, () => {
    test('Add A Module To A Design', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
      await setCasterTheme(page, theme);
      await requireTestModuleCatalog(page);
      const designId = await openNewDesign(page, `Designer Add Project ${Date.now()}`, cleanupCasterProject);

      // 1. Pick a module: its variables open before anything is created
      const dialog = await pickModule(page, 'Blank Machine');

      // expect: the newest version is selected, and the defaults come from that version
      await expect(dialog.getByRole('combobox', { name: 'Version' })).toContainText('v1.1.0');
      await expect(dialog.getByRole('textbox', { name: 'Name of this instance' })).toHaveValue('Blank_Machine');
      await expect(dialog.getByRole('textbox', { name: 'enable_backup' })).toHaveValue('false');
      await expect(dialog.getByRole('textbox', { name: 'cpus' })).toHaveValue('4');

      // expect: nothing was created just by picking it
      expect((await casterApi(page, 'GET', `designs/${designId}/modules`)).body).toHaveLength(0);

      // expect: Add waits for the required value, so a module that can't plan is never saved
      const add = dialog.getByRole('button', { name: 'Add' });
      await expect(add).toBeDisabled();

      // 2. Fill the required value and add it
      await dialog.getByRole('textbox', { name: 'vm_name' }).fill('web01');
      await expect(add).toBeEnabled();
      await add.click();

      // expect: the dialog closes and the module is on the design
      await expect(dialog).toBeHidden();
      await expect(moduleCard(page, 'Blank_Machine')).toBeVisible();

      // expect: it was saved with its version and the value, ready to plan
      const saved = (await casterApi(page, 'GET', `designs/${designId}/modules`)).body;
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ name: 'Blank_Machine', moduleVersion: 'v1.1.0' });
      // The list leaves the values out; the single design module carries them.
      const { values } = (await casterApi(page, 'GET', `designModules/${saved[0].id}`)).body;
      expect(values).toEqual(expect.arrayContaining([{ name: 'vm_name', value: 'web01' }]));

      // 3. Edit it and clear the required value
      await moduleCard(page, 'Blank_Machine').getByRole('button', { name: 'Edit' }).click();
      const editor = page.locator('cas-design-module cas-module-variables');
      const vmName = editor.getByRole('textbox', { name: 'vm_name' });
      await expect(vmName).toHaveValue('web01');
      await vmName.clear();

      // expect: Save refuses a blank required value
      await expect(editor.getByText('Required', { exact: true }).last()).toBeVisible();
      await expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    test('Default Module Names Are Valid And Unique', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
      await setCasterTheme(page, theme);
      await requireTestModuleCatalog(page);
      const designId = await openNewDesign(page, `Designer Names Project ${Date.now()}`, cleanupCasterProject);

      // 1. Add Blank Machine
      let dialog = await pickModule(page, 'Blank Machine');
      // expect: the display name's space becomes an underscore, which Terraform accepts
      await expect(dialog.getByRole('textbox', { name: 'Name of this instance' })).toHaveValue('Blank_Machine');
      await dialog.getByRole('textbox', { name: 'vm_name' }).fill('web01');
      await dialog.getByRole('button', { name: 'Add' }).click();
      await expect(dialog).toBeHidden();
      await expect(moduleCard(page, 'Blank_Machine')).toBeVisible();

      // 2. Add Blank Machine again
      dialog = await pickModule(page, 'Blank Machine');
      // expect: the default is numbered, so the generated file has no duplicate module
      await expect(dialog.getByRole('textbox', { name: 'Name of this instance' })).toHaveValue('Blank_Machine_2');
      await dialog.getByRole('textbox', { name: 'vm_name' }).fill('web02');
      await dialog.getByRole('button', { name: 'Add' }).click();
      await expect(dialog).toBeHidden();
      await expect(moduleCard(page, 'Blank_Machine_2')).toBeVisible();

      // 3. Add Router / Gateway
      dialog = await pickModule(page, 'Router / Gateway');
      const name = dialog.getByRole('textbox', { name: 'Name of this instance' });
      const add = dialog.getByRole('button', { name: 'Add' });
      // expect: the slash and spaces collapse into one underscore
      await expect(name).toHaveValue('Router_Gateway');
      await dialog.getByRole('textbox', { name: 'wan_network' }).fill('outside');

      // 4. Give it a name Terraform would reject
      await name.fill('2 routers');
      // expect: the error shows at once, and Add is disabled
      await expect(dialog.getByText(NAME_ERROR)).toBeVisible();
      await expect(add).toBeDisabled();

      // 5. Put a valid name back and add it
      await name.fill('Router_Gateway');
      await expect(dialog.getByText(NAME_ERROR)).toBeHidden();
      await add.click();
      await expect(dialog).toBeHidden();
      await expect(moduleCard(page, 'Router_Gateway')).toBeVisible();

      // expect: three modules, each named the way it was shown
      const saved = (await casterApi(page, 'GET', `designs/${designId}/modules`)).body;
      expect(saved.map((m: any) => m.name).sort()).toEqual(['Blank_Machine', 'Blank_Machine_2', 'Router_Gateway']);
    });
  });
}
