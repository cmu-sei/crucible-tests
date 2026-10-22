// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  casterEditorContent,
  openCasterDirectory,
  requireTestModuleCatalog,
  seedCasterDirectory,
  seedCasterFile,
  seedCasterProject,
  CASTER_THEMES,
  setCasterTheme,
} from '../../fixtures';

// Blank Machine, from caster/module-catalog, has a required `vm_name`, a bool
// `enable_backup` defaulting to false and a number `cpus` defaulting to 4.

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Directories Management`, () => {
    test('Insert A Module Into A File', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
      await setCasterTheme(page, theme);
      await requireTestModuleCatalog(page);

      const projectId = await seedCasterProject(page, `Insert Module Project ${Date.now()}`);
      cleanupCasterProject(projectId);
      const directoryId = await seedCasterDirectory(page, projectId, 'Insert-Dir');
      await seedCasterFile(page, directoryId, 'main.tf', '# machines\n');

      // 1. Open the file and its module list, without editing
      await openCasterDirectory(page, projectId, 'Insert-Dir');
      await page.getByRole('button', { name: 'FILES', exact: true }).click();
      await page.getByRole('region', { name: 'FILES' }).getByText('main.tf', { exact: true }).click();
      await page.getByRole('button', { name: 'Show the module list' }).click();

      // expect: the module card says why it can't be inserted yet
      const card = page.locator('mat-card.module-card', { hasText: 'Blank Machine' });
      await card.hover();
      await expect(page.locator('mat-tooltip-component')).toHaveText('Edit this file to insert the module');

      // expect: its variables open read-only, with Insert disabled
      await card.click();
      let dialog = page.getByRole('dialog', { name: 'Blank Machine' });
      await expect(dialog.getByRole('textbox', { name: 'vm_name' })).toBeDisabled();
      await expect(dialog.getByRole('button', { name: 'Insert' })).toBeDisabled();
      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect(dialog).toBeHidden();

      // 2. Edit the file and pick the module again
      await page.getByRole('button', { name: 'Edit this file' }).click();
      await expect(page.getByRole('button', { name: 'Finish editing' })).toBeVisible();
      await card.hover();
      await expect(page.locator('mat-tooltip-component')).toBeHidden();
      await card.click();
      dialog = page.getByRole('dialog', { name: 'Blank Machine' });

      // expect: Insert is available straight away, without editing a field first
      const insert = dialog.getByRole('button', { name: 'Insert' });
      await expect(insert).toBeEnabled();

      // 3. Fill the required value and insert
      await dialog.getByRole('textbox', { name: 'vm_name' }).fill('web01');
      await insert.click();
      await expect(dialog).toBeHidden();

      // expect: a module block for the newest version, after what the file already held
      const content = await casterEditorContent(page);
      expect(content.startsWith('# machines\n')).toBe(true);
      expect(content).toContain('module "Blank_Machine" {');
      expect(content).toMatch(/source = "git::.+\/\/blank-machine\?ref=v1\.1\.0"/);
      expect(content).toContain('vm_name = "web01"');
      expect(content).toContain('cpus = 4');
      // expect: the bool default keeps Terraform's lower-case spelling, not .NET's "False"
      expect(content).toContain('enable_backup = false');

      // 4. Throw the change away and stop editing
      await page.getByRole('button', { name: 'Discard Changes' }).click();
      await expect.poll(() => casterEditorContent(page)).toBe('# machines\n');
      await page.getByRole('button', { name: 'Finish editing' }).click();
      await expect(page.getByRole('button', { name: 'Edit this file' })).toBeVisible();
    });
  });
}
