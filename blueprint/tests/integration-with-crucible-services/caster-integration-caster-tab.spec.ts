// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: blueprint/blueprint-test-plan.md

import { randomUUID } from 'crypto';
import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  getMsel,
  navigateToMsel,
  navigateToMselSection,
  tempBlueprintName,
} from '../../test-helpers';
import {
  getCasterToken,
  createNestedCasterTemplate,
  deleteCasterTemplate,
  deleteCasterProjectOfDirectory,
  getCasterDirectory,
  getCasterDirectoryFileNames,
  downloadMselJson,
  importMselJson,
  getMselCasterCopy,
  captureMselCasterCopy,
  NestedCasterTemplate,
  ROOT_SHARED_FILE,
} from '../../caster-helpers';
import { setMselIntegrationState, clearMselIntegrationState } from '../../db-helpers';

/**
 * The Caster tab: the Caster directory a MSEL deploys, and the copy of it the MSEL carries in its
 * JSON file to another Caster. A workspace runs with its directory's files and those of every
 * directory above it, so the copy holds the chain from the project's root down.
 *
 * The file seeds one Caster project, `root` holding a shared file and `range` below it holding a
 * variables-only template. No test changes it: a copy is read from it, and an import makes a new
 * project, which that test deletes. Each test seeds its own MSELs. Nothing is pushed, so no
 * terraform runs.
 */
test.describe('Caster Integration Caster Tab', () => {
  let token: string;
  let casterToken: string;
  let template: NestedCasterTemplate;
  let mselIds: string[] = [];
  let deployedMselIds: string[] = [];
  let importedDirectoryId: string | undefined;

  test.beforeAll(async () => {
    template = await createNestedCasterTemplate(await getCasterToken());
  });

  test.afterAll(async () => {
    await deleteCasterTemplate(await getCasterToken(), template);
  });

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    casterToken = await getCasterToken();
  });

  test.afterEach(async () => {
    try {
      // a MSEL left looking deployed would queue a pull of a Player view that never existed
      for (const id of deployedMselIds) await clearMselIntegrationState(id);
      for (const id of mselIds) await deleteMsel(token, id);
      await deleteCasterProjectOfDirectory(casterToken, importedDirectoryId);
    } catch (err) {
      console.warn(`Cleanup failed: ${err}`);
    }
    mselIds = [];
    deployedMselIds = [];
    importedDirectoryId = undefined;
  });

  const directoryLabel = () => `${template.projectName} / range`;
  const fileHeader = (page, path: string) => page.locator('mat-expansion-panel-header').filter({ hasText: path });

  test('The Caster tab picks the directory, copies it with the directory above, and deletes the copy', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const msel = await createMsel(token);
    mselIds.push(msel.id);
    await updateMsel(token, msel.id, { usePlayer: true, useCaster: true });

    // 1. Open the Caster section of a MSEL using Caster with no directory
    await navigateToMselSection(page, msel.id, 'Caster');

    // expect: nothing is stored, and there is no directory to copy
    await expect(page.getByText('No copy is stored.')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Store a Copy Now' })).toBeDisabled();

    // 2. Choose the seeded directory and save
    await page.locator('.link-select mat-select').click();
    await page.getByRole('option', { name: directoryLabel(), exact: true }).click();
    await expect(page.getByText('Changes have not been saved!')).toBeVisible();
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // expect: the directory is saved, and the push will deploy it
    await expect.poll(async () => (await getMsel(token, msel.id)).casterDirectoryId).toBe(template.directoryId);
    await expect(page.getByText('The push creates a workspace in the linked directory.')).toBeVisible();

    // 3. Store a copy now
    const captured = page.waitForResponse(
      r => r.url().endsWith(`/api/msels/${msel.id}/caster/export`) && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Store a Copy Now' }).click();
    expect((await captured).ok()).toBe(true);

    // expect: the copy names its project and the chain down to the directory, and lists the root's
    // shared file before the directory's own
    const details = page.locator('.copy-details');
    await expect(details).toContainText(template.projectName);
    await expect(details).toContainText('root / range');
    await expect(details).toContainText(template.directoryId);
    await expect(fileHeader(page, `root/${ROOT_SHARED_FILE.name}`)).toContainText('shared from above');
    await expect(page.locator('mat-expansion-panel-header .file-path')).toHaveText([
      `root/${ROOT_SHARED_FILE.name}`,
      'range/terraform.tfvars',
      'range/variables.tf',
    ]);

    // 4. Open the directory's template file
    await fileHeader(page, 'range/variables.tf').click();

    // expect: its content as it is in Caster
    await expect(page.locator('.file-content')).toContainText('variable "blue_cell" { type = string }');

    // 5. Delete the copy
    await page.getByRole('button', { name: 'Delete the Copy' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Downloading the MSEL file takes a new one from the linked directory.');
    await dialog.getByRole('button', { name: 'Delete' }).click();

    // expect: the copy is gone, and the directory stays linked
    await expect(page.getByText('No copy is stored.')).toBeVisible();
    expect((await getMselCasterCopy(token, msel.id)).status).toBe(204);
    expect((await getMsel(token, msel.id)).casterDirectoryId).toBe(template.directoryId);
  });

  test('A MSEL file from another Caster carries its copy, and Import into Caster links a new directory', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const source = await createMsel(token);
    mselIds.push(source.id);
    await updateMsel(token, source.id, { usePlayer: true, useCaster: true, casterDirectoryId: template.directoryId });

    // 1. Download the MSEL's JSON file
    const file = await downloadMselJson(token, source.id);

    // expect: it carries a copy of the directory and the directory above it
    expect(file.CasterExport.ProjectName).toBe(template.projectName);
    const levels = [...file.CasterExport.Directories].sort((a, b) => a.Level - b.Level);
    expect(levels.map(d => d.Name)).toEqual(['root', 'range']);
    expect(levels[0].Files.map(f => f.Name)).toEqual([ROOT_SHARED_FILE.name]);

    // 2. Import it as a file from a Caster that does not have the directory
    file.CasterDirectoryId = randomUUID();
    file.Name = tempBlueprintName('TestBP-CasterCopy');
    const report = await importMselJson(token, file);
    const imported = report.msel;
    mselIds.push(imported.id);

    // expect: the directory is dropped and the report says the push imports the copy instead
    expect(imported.casterDirectoryId).toBeNull();
    const change = report.changes.find((c: { field: string }) => c.field === 'casterDirectoryId');
    expect(change?.message).toContain(`"${template.projectName}"`);
    expect(change?.message).toContain('as a new Caster project');

    // 3. Open the imported MSEL's Config tab
    await navigateToMsel(page, imported.id);
    const casterRow = page.locator('.integration-row').filter({
      has: page.locator('mat-checkbox').filter({ hasText: /^\s*Caster\s*$/ }),
    });

    // expect: the Caster row says the push imports the copy, and Push is not held for a directory
    await expect(casterRow).toContainText(
      `a copy of ${template.projectName} / root / range, which the push imports as a new Caster project`,
      { timeout: 15000 }
    );
    await expect(page.getByText(/Select the Caster directory to deploy/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Push Integrations' })).toBeEnabled();

    // 4. Open the Caster tab from the Caster row
    await casterRow.getByRole('button', { name: 'Open the Caster tab' }).click();

    // expect: the copy, and what the push will do with it
    await expect(page.getByText(/the push imports the copy into Caster as a new project/)).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.copy-details')).toContainText('root / range');

    // 5. Import the copy into Caster now
    await page.getByRole('button', { name: 'Import into Caster' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(`Create a new Caster project named "${template.projectName}"`);
    const importResponse = page.waitForResponse(
      r => r.url().endsWith(`/api/msels/${imported.id}/caster/export/import`) && r.request().method() === 'POST'
    );
    await dialog.getByRole('button', { name: 'Import' }).click();
    const result = await (await importResponse).json();
    importedDirectoryId = result.casterDirectoryId;

    // expect: the MSEL links a new directory, in a new project, below a copy of root and its file
    await expect.poll(async () => (await getMsel(token, imported.id)).casterDirectoryId).toBe(importedDirectoryId);
    expect(importedDirectoryId).not.toBe(template.directoryId);
    const directory = await getCasterDirectory(casterToken, importedDirectoryId!);
    expect(directory.name).toBe('range');
    expect(directory.projectId).not.toBe(template.projectId);
    expect(await getCasterDirectoryFileNames(casterToken, importedDirectoryId!)).toEqual(['terraform.tfvars', 'variables.tf']);
    expect(await getCasterDirectoryFileNames(casterToken, directory.parentId)).toEqual([ROOT_SHARED_FILE.name]);
    await expect(page.getByText('The push creates a workspace in the linked directory.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import into Caster' })).toBeDisabled();
  });

  test('The Caster tab is read only while the MSEL is deployed', async ({ blueprintAuthenticatedPage: page }) => {
    const msel = await createMsel(token);
    mselIds.push(msel.id);
    await updateMsel(token, msel.id, { usePlayer: true, useCaster: true, casterDirectoryId: template.directoryId });
    await captureMselCasterCopy(token, msel.id);
    await setMselIntegrationState(msel.id, { status: 'Deployed', playerViewId: randomUUID() });
    deployedMselIds.push(msel.id);

    // 1. Open the Caster section of the deployed MSEL
    await navigateToMselSection(page, msel.id, 'Caster');

    // expect: the copy is shown, but neither it nor the directory can change until Remove Integrations
    await expect(page.locator('.copy-details')).toContainText('root / range', { timeout: 15000 });
    await expect(page.getByText(/Both are locked while the integrations are deployed/)).toBeVisible();
    await expect(page.locator('.link-guid').first()).toHaveText(template.directoryId);
    await expect(page.locator('.link-select')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Store a Copy Now' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete the Copy' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save Changes' })).toHaveCount(0);
  });
});
