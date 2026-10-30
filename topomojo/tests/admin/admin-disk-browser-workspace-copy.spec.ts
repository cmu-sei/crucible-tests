// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md

import { test, expect } from '../../fixtures';
import { requirePrecondition } from '../../../shared-fixtures';
import {
  createStockTemplate,
  createWorkspace,
  deleteStockTemplate,
  deleteWorkspace,
  getTemplateSources,
  getTopoMojoAdminToken,
  initializeTemplate,
  linkTemplate,
  unlinkTemplate,
} from '../../../topomojo-helpers';

// Unlinking and initializing a template clones a real template VM on the hypervisor.
test.skip(({ browserName }) => browserName !== 'chromium', 'clones a real template VM; run it once, not per browser');

test.describe('Admin - Disks', () => {
  let token: string;
  let workspaceId: string | undefined;
  let stockTemplateId: string | undefined;

  test.afterEach(async () => {
    // The workspace delete also deletes its unlinked template and that template's clone.
    if (workspaceId) await deleteWorkspace(token, workspaceId);
    if (stockTemplateId) await deleteStockTemplate(token, stockTemplateId);
  });

  test('an unlinked template copy is listed under its workspace with its own date', async ({ topomojoAuthenticatedPage: page }) => {
    test.setTimeout(10 * 60_000);
    token = await getTopoMojoAdminToken();

    const before = await getTemplateSources(token);
    requirePrecondition(
      before.field === 'template',
      'the hypervisor is not Proxmox; workspace copies are template VMs only on Proxmox'
    );
    const base = before.sources.find(s => s.isGlobal);
    requirePrecondition(base, 'Proxmox has no global template VM to base a test template on');

    const suffix = `${Date.now()}`;
    const stock = await createStockTemplate(token, `disks-test-${suffix}`, {
      Template: base!.name,
      Cpu: '1x1',
      Ram: 1,
      Eth: [{ Net: 'lan' }],
      Disks: [],
    });
    stockTemplateId = stock.id;

    const workspace = await createWorkspace(token, { name: `Disks Test ${suffix}`, audience: null });
    workspaceId = workspace.id;

    const linked = await linkTemplate(token, stock.id, workspace.id);
    const copy = await unlinkTemplate(token, linked.id, workspace.id);
    const started = Date.now();
    await initializeTemplate(token, copy.id);

    // Proxmox names a template's own copy by the template id.
    await expect.poll(
      async () => (await getTemplateSources(token)).sources.find(s => s.name === copy.id),
      { timeout: 2 * 60_000, message: 'the copy appears in template-sources' }
    ).toBeTruthy();
    const row = (await getTemplateSources(token)).sources.find(s => s.name === copy.id)!;

    expect(row.isGlobal).toBe(false);
    expect(row.workspaceName).toBe(workspace.name);
    expect(row.templateName).toBe(copy.name);
    // A clone inherits its parent's config ctime; the date must be the copy's own.
    expect(new Date(row.created!).getTime()).toBeGreaterThan(started - 5 * 60_000);

    await page.getByRole('button', { name: 'Admin' }).click();
    await page.getByRole('link', { name: 'Disks' }).click();

    const copyRow = page.locator('app-disk-browser tbody tr').filter({ hasText: copy.id });
    await expect(copyRow).toHaveCount(0);

    await page.getByRole('button', { name: 'Global Only' }).click();
    await page.getByRole('searchbox', { name: 'Search' }).fill(workspace.name);
    await expect(copyRow).toHaveCount(1);
    await expect(copyRow.locator('td').nth(1)).toContainText(workspace.name);
    await expect(copyRow.locator('td').nth(1)).toContainText(`Template: ${copy.name}`);
    await expect(copyRow.locator('td').nth(2)).not.toBeEmpty();
  });
});
