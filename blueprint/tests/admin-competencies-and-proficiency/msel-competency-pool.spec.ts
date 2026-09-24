// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// A MSEL's Competencies tab: the framework browser (work roles, and each work role's
// children found by parentId/relatedIdNumbers) and the MSEL's competency pool built from it.
// The work-role/child split, the type labels, the Select All tri-state and the remove
// confirmations are all computed in the component. Blueprint.Api.Tests owns the
// mselcompetencies endpoints; this spec asserts only what the tab shows.

import { test, expect, Page } from '../../fixtures';
import {
  getBlueprintToken,
  tempBlueprintName,
  createMsel,
  deleteMsel,
  createCompetencyFramework,
  deleteCompetencyFramework,
  navigateToMselSection,
} from '../../test-helpers';

function poolRow(page: Page, idNumber: string) {
  return page.locator('mat-row.pool-row').filter({
    has: page.locator('mat-cell.pool-col-id', { hasText: new RegExp(`^\\s*${idNumber}\\s*$`) }),
  });
}

function poolHeader(page: Page) {
  return page.getByRole('button', { name: /^MSEL Competencies \(/ });
}

test.describe('MSEL Competencies', () => {
  let mselId: string | undefined;
  let frameworkId: string | undefined;

  test.afterEach(async () => {
    const token = await getBlueprintToken();
    // The pool pins the framework, so the MSEL goes first.
    if (mselId) await deleteMsel(token, mselId);
    if (frameworkId) await deleteCompetencyFramework(token, frameworkId);
    mselId = undefined;
    frameworkId = undefined;
  });

  test('Build and trim a MSEL competency pool from a framework', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const msel = await createMsel(token, { name: tempBlueprintName('PoolMsel') });
    mselId = msel.id;
    const framework = await createCompetencyFramework(token, {
      name: tempBlueprintName('PoolFw'),
      competencies: [
        { idNumber: 'SPEC-WRL-701', shortName: 'Pool work role' },
        { idNumber: 'T0701', shortName: 'Pool task', parentIdNumber: 'SPEC-WRL-701' },
        { idNumber: 'K0701', shortName: 'Pool knowledge', parentIdNumber: 'SPEC-WRL-701' },
        { idNumber: 'SPEC-WRL-702', shortName: 'Childless work role' },
      ],
    });
    frameworkId = framework.id;

    await navigateToMselSection(page, msel.id, 'Competencies');

    // 1. An empty pool opens the Add Competencies panel and asks for a framework.
    await expect(page.getByText('No competencies associated with this MSEL.')).toBeVisible();
    await expect(poolHeader(page)).toContainText('MSEL Competencies (0)');
    await expect(page.getByText('Select a framework to browse work roles and competencies')).toBeVisible();

    // 2. Choosing the framework lists only its work roles.
    await page.getByRole('combobox', { name: 'Competency Framework' }).click();
    await page.getByRole('option', { name: `${framework.name} (${framework.version})`, exact: true }).click();
    const browserRows = page.locator('mat-row.browser-row');
    await expect(browserRows).toHaveCount(2);
    await expect(browserRows.nth(0)).toContainText('SPEC-WRL-701');
    await expect(browserRows.nth(1)).toContainText('SPEC-WRL-702');

    // 3. Expanding a work role lists its children, typed from their ID numbers.
    const workRole = browserRows.filter({ hasText: 'SPEC-WRL-701' });
    await workRole.locator('mat-cell.wr-col-id').click();
    const children = page.locator('.browser-child-row');
    await expect(children).toHaveCount(2);
    const task = children.filter({ hasText: 'T0701' });
    const knowledge = children.filter({ hasText: 'K0701' });
    await expect(task.locator('.browser-child-type')).toHaveText('Task');
    await expect(knowledge.locator('.browser-child-type')).toHaveText('Knowledge');

    // 4. Checking one child adds it to the pool; Select All goes indeterminate.
    const selectAll = page.locator('.browser-children-toolbar mat-checkbox').getByRole('checkbox');
    await task.getByRole('checkbox').check();
    await expect(poolHeader(page)).toContainText('MSEL Competencies (1)');
    const taskRow = poolRow(page, 'T0701');
    await expect(taskRow.locator('mat-cell.pool-col-type')).toHaveText('Task');
    await expect(taskRow.locator('mat-cell.pool-col-framework')).toHaveText(`${framework.name} (${framework.version})`);
    await expect(taskRow.locator('mat-cell.pool-col-name')).toHaveText('Pool task');
    await expect(taskRow.locator('mat-cell.pool-col-teams')).toHaveText('—');
    await expect(taskRow.locator('mat-cell.pool-col-events')).toHaveText('0');
    await expect(selectAll).toHaveAttribute('aria-checked', 'mixed');

    // 5. Select All adds the rest of the children, and the work role can be added too.
    await page.locator('.browser-children-toolbar').getByText('Select All').click();
    await expect(poolHeader(page)).toContainText('MSEL Competencies (2)');
    await expect(selectAll).toBeChecked();
    await workRole.getByRole('checkbox').check();
    await expect(poolHeader(page)).toContainText('MSEL Competencies (3)');
    await expect(poolRow(page, 'SPEC-WRL-701').locator('mat-cell.pool-col-type')).toHaveText('Work Role');

    // 6. A work role with no children says so.
    await browserRows.filter({ hasText: 'SPEC-WRL-702' }).locator('mat-cell.wr-col-id').click();
    await expect(page.getByText('No related competencies in framework')).toBeVisible();
    await workRole.locator('mat-cell.wr-col-id').click();
    await expect(children).toHaveCount(2);

    // 7. Unchecking a pooled child asks first; No keeps it, Yes removes it.
    const confirm = page.getByRole('dialog').filter({ hasText: 'Remove Competency' });
    await knowledge.getByRole('checkbox').uncheck();
    await expect(confirm).toContainText('Remove the following competency from this MSEL?');
    await expect(confirm).toContainText('K0701 — Pool knowledge');
    await confirm.getByRole('button', { name: 'No' }).click();
    await expect(confirm).toBeHidden();
    await expect(poolHeader(page)).toContainText('MSEL Competencies (3)');
    await expect(poolRow(page, 'K0701')).toHaveCount(1);
    // Pending upstream: answering No leaves the browser checkbox unticked although the
    // competency is still in the pool. The checkbox's [checked] binding never changes, so
    // Angular never resets the tick the click cleared. Expect toBeChecked() once fixed.
    await expect(knowledge.getByRole('checkbox')).not.toBeChecked();
    // Collapsing and re-expanding the work role re-renders its children with the real state.
    await workRole.locator('mat-cell.wr-col-id').click();
    await expect(children).toHaveCount(0);
    await workRole.locator('mat-cell.wr-col-id').click();
    await expect(knowledge.getByRole('checkbox')).toBeChecked();

    await knowledge.getByRole('checkbox').uncheck();
    await confirm.getByRole('button', { name: 'Yes' }).click();
    await expect(poolHeader(page)).toContainText('MSEL Competencies (2)');
    await expect(poolRow(page, 'K0701')).toHaveCount(0);
    await expect(knowledge.getByRole('checkbox')).not.toBeChecked();

    // 8. The pool row's own trash button goes through the same confirmation.
    await taskRow.getByTitle('Remove from MSEL').click();
    await expect(confirm).toContainText('T0701 — Pool task');
    await confirm.getByRole('button', { name: 'Yes' }).click();
    await expect(poolHeader(page)).toContainText('MSEL Competencies (1)');
    await expect(task.getByRole('checkbox')).not.toBeChecked();

    // 9. Bulk removal: select the last row, then "Remove 1".
    await poolRow(page, 'SPEC-WRL-701').getByRole('checkbox').check();
    await page.getByTitle('Remove selected').click();
    const bulkConfirm = page.getByRole('dialog').filter({ hasText: 'Remove Selected' });
    await expect(bulkConfirm).toContainText('Remove 1 competency from this MSEL?');
    await bulkConfirm.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByText('No competencies associated with this MSEL.')).toBeVisible();
    await expect(poolHeader(page)).toContainText('MSEL Competencies (0)');
  });
});
