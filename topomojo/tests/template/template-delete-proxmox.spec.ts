// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md

import { test, expect } from '../../fixtures';
import { requirePrecondition } from '../../../shared-fixtures';
import {
  createStockTemplate,
  createWorkspace,
  deleteStockTemplate,
  deleteTemplate,
  deleteWorkspace,
  getTemplateSources,
  getTopoMojoAdminToken,
  initializeTemplate,
  linkTemplate,
  TemplateSource,
  unlinkTemplate,
} from '../../../topomojo-helpers';

// Unlinking and initializing a template clones a real template VM on the hypervisor.
test.skip(({ browserName }) => browserName !== 'chromium', 'clones a real template VM; run it once, not per browser');

async function findSource(token: string, name: string): Promise<TemplateSource | undefined> {
  return (await getTemplateSources(token)).sources.find(s => s.name === name);
}

test.describe('Template Delete on Proxmox', () => {
  let token: string;
  const baseStockTemplateIds: string[] = [];
  const otherTemplateIds: string[] = [];
  let workspaceId: string | undefined;

  test.afterEach(async () => {
    // The workspace delete also deletes its unlinked template and that template's copy.
    if (workspaceId) await deleteWorkspace(token, workspaceId);
    workspaceId = undefined;
    // Already deleted when the test got that far; 404s are ignored.
    for (const id of otherTemplateIds.splice(0)) await deleteTemplate(token, id);
    // These point at a global base, which a cleanup must never risk.
    for (const id of baseStockTemplateIds.splice(0)) await deleteStockTemplate(token, id);
  });

  // Makes a workspace copy: a Proxmox template vm TopoMojo owns, named by its template id.
  async function makeWorkspaceCopy(suffix: string) {
    const before = await getTemplateSources(token);
    requirePrecondition(
      before.field === 'template',
      'the hypervisor is not Proxmox; template VMs are a Proxmox concept'
    );
    const base = before.sources.find(s => s.isGlobal);
    requirePrecondition(base, 'Proxmox has no global template VM to base a test template on');

    const stock = await createStockTemplate(token, `delete-test-base-${suffix}`, {
      Template: base!.name, Cpu: '1x1', Ram: 1, Eth: [{ Net: 'lan' }], Disks: [],
    });
    baseStockTemplateIds.push(stock.id);

    const workspace = await createWorkspace(token, { name: `Delete Test ${suffix}`, audience: null });
    workspaceId = workspace.id;

    const linked = await linkTemplate(token, stock.id, workspace.id);
    const copy = await unlinkTemplate(token, linked.id, workspace.id);
    await initializeTemplate(token, copy.id);

    await expect.poll(() => findSource(token, copy.id), { timeout: 2 * 60_000 }).toBeTruthy();
    return { base: base!.name, copy };
  }

  test('deleting a stock template keeps the template VM it names', async () => {
    test.setTimeout(10 * 60_000);
    token = await getTopoMojoAdminToken();
    const suffix = `${Date.now()}`;

    // Point a second stock template at the workspace copy, so a wrong delete costs only
    // this test's copy rather than a shared base the deployment owns.
    const { copy } = await makeWorkspaceCopy(suffix);
    const sharing = await createStockTemplate(token, `delete-test-sharing-${suffix}`, {
      Template: copy.id, Cpu: '1x1', Ram: 1, Eth: [{ Net: 'lan' }], Disks: [],
    });
    otherTemplateIds.push(sharing.id);

    await deleteTemplate(token, sharing.id);

    // The delete has returned by now, so the vm would already be gone.
    expect(await findSource(token, copy.id)).toBeTruthy();
  });

  test('deleting an unlinked template removes its own copy', async () => {
    test.setTimeout(10 * 60_000);
    token = await getTopoMojoAdminToken();

    const { base, copy } = await makeWorkspaceCopy(`${Date.now()}`);

    await deleteTemplate(token, copy.id);

    await expect.poll(() => findSource(token, copy.id), { timeout: 2 * 60_000 }).toBeUndefined();
    expect(await findSource(token, base)).toBeTruthy();
  });
});
