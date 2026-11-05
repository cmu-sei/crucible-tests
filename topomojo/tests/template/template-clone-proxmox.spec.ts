// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md

import { test, expect } from '../../fixtures';
import { requirePrecondition } from '../../../shared-fixtures';
import {
  cloneTemplate,
  createStockTemplate,
  deleteStockTemplate,
  deleteTemplate,
  getTemplateDetail,
  getTemplateSources,
  getTopoMojoAdminToken,
  initializeTemplate,
  TemplateSource,
} from '../../../topomojo-helpers';

// Initializing the clone copies a real template VM on the hypervisor.
test.skip(({ browserName }) => browserName !== 'chromium', 'clones a real template VM; run it once, not per browser');

async function findSource(token: string, name: string): Promise<TemplateSource | undefined> {
  return (await getTemplateSources(token)).sources.find(s => s.name === name);
}

test.describe('Template Clone on Proxmox', () => {
  let token: string;
  let stockTemplateId: string | undefined;
  let cloneId: string | undefined;

  test.afterEach(async () => {
    // The clone owns its template VM, so deleting it removes that VM too.
    if (cloneId) await deleteTemplate(token, cloneId);
    // The original points at a global base, which a cleanup must never risk.
    if (stockTemplateId) await deleteStockTemplate(token, stockTemplateId);
    cloneId = stockTemplateId = undefined;
  });

  test('a cloned template gets its own template VM, copied from the original', async () => {
    test.setTimeout(10 * 60_000);
    token = await getTopoMojoAdminToken();

    const before = await getTemplateSources(token);
    requirePrecondition(
      before.field === 'template',
      'the hypervisor is not Proxmox; template VMs are a Proxmox concept'
    );
    const base = before.sources.find(s => s.isGlobal);
    requirePrecondition(base, 'Proxmox has no global template VM to base a test template on');

    const suffix = `${Date.now()}`;
    const stock = await createStockTemplate(token, `clone-test-${suffix}`, {
      Template: base!.name, Cpu: '1x1', Ram: 1, Eth: [{ Net: 'lan' }], Disks: [],
    });
    stockTemplateId = stock.id;

    const clone = await cloneTemplate(token, stock.id, `clone-test-${suffix}-copy`);
    cloneId = clone.id;

    // The clone names its own template VM and clones it from the original's.
    const { detail } = await getTemplateDetail(token, clone.id);
    expect(detail.Template).toBe(clone.id);
    expect(detail.ParentTemplate).toBe(base!.name);
    // The original is unchanged.
    expect((await getTemplateDetail(token, stock.id)).detail.Template).toBe(base!.name);

    await initializeTemplate(token, clone.id);

    await expect.poll(() => findSource(token, clone.id), { timeout: 2 * 60_000 }).toBeTruthy();
    expect((await findSource(token, clone.id))!.templateName).toBe(clone.name);

    // Deleting the clone removes its own VM and leaves the base.
    await deleteTemplate(token, clone.id);
    cloneId = undefined;
    await expect.poll(() => findSource(token, clone.id), { timeout: 2 * 60_000 }).toBeUndefined();
    expect(await findSource(token, base!.name)).toBeTruthy();
  });

  test('initializing a clone twice makes only one template VM', async () => {
    test.setTimeout(10 * 60_000);
    token = await getTopoMojoAdminToken();

    const before = await getTemplateSources(token);
    requirePrecondition(
      before.field === 'template',
      'the hypervisor is not Proxmox; template VMs are a Proxmox concept'
    );
    const base = before.sources.find(s => s.isGlobal);
    requirePrecondition(base, 'Proxmox has no global template VM to base a test template on');

    const suffix = `${Date.now()}`;
    const stock = await createStockTemplate(token, `clone-twice-${suffix}`, {
      Template: base!.name, Cpu: '1x1', Ram: 1, Eth: [{ Net: 'lan' }], Disks: [],
    });
    stockTemplateId = stock.id;
    const clone = await cloneTemplate(token, stock.id, `clone-twice-${suffix}-copy`);
    cloneId = clone.id;

    // Initialize holds the request open for the whole clone, so a second one arrives while the first
    // is still running. Proxmox does not list the clone yet, so only one of the two may go through.
    const concurrent = await Promise.allSettled([
      initializeTemplate(token, clone.id),
      initializeTemplate(token, clone.id),
    ]);
    expect(concurrent.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const refused = concurrent.find(r => r.status === 'rejected') as PromiseRejectedResult;
    expect(String(refused.reason)).toContain('(400)');

    // Right after it finishes, Proxmox still lags behind the clone, so this relies on the cache.
    await expect(initializeTemplate(token, clone.id)).rejects.toThrow('(400)');

    await expect.poll(() => findSource(token, clone.id), { timeout: 2 * 60_000 }).toBeTruthy();
    expect(await findSource(token, base!.name)).toBeTruthy();
  });
});
