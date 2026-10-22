// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import fs from 'fs';
import path from 'path';
import { Page, Request } from '@playwright/test';
import {
  test,
  expect,
  openCasterDirectory,
  seedCasterDirectory,
  seedCasterProject,
  seedCasterWorkspace,
} from '../../fixtures';

// The topology Caster reads from a plan of the Proxmox network, router and
// machine modules: 9 VMs on 4 vnets.
const proxmoxTopology = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'topology-proxmox.json'), 'utf8')
);

const router = 'module.fw_edge.proxmox_virtual_environment_vm.vm';

type NodeLayout = { x?: number | null; y?: number | null; role?: string | null };

/**
 * Serve the sample topology in place of the API's, with the layout the real API
 * saved. A workspace with no runs draws no nodes, and the API only returns the
 * layout of nodes it draws, so the saved layout is taken from what the save
 * answered: every node the workspace has a layout for.
 */
async function routeTopologyWithSavedLayout(page: Page) {
  let saved: Record<string, NodeLayout> = {};
  page.on('response', async (response) => {
    if (response.request().method() === 'PATCH' && response.url().endsWith('/topology/layout') && response.ok()) {
      saved = await response.json();
    }
  });
  await page.route('**/api/workspaces/*/topology', (route) =>
    route.fulfill({ json: { ...proxmoxTopology, layout: saved } })
  );
}

/** A new workspace, through the API, opened on its Topology view. */
async function openTopology(page: Page, cleanupCasterProject: (id: string) => void): Promise<string> {
  const projectId = await seedCasterProject(page, 'Topology Layout Project');
  cleanupCasterProject(projectId);
  const directoryId = await seedCasterDirectory(page, projectId, 'Topology_Layout_Dir');
  const workspaceId = await seedCasterWorkspace(page, directoryId, 'Topology_Layout_Workspace');

  await openCasterDirectory(page, projectId, 'Topology_Layout_Dir');
  await showTopology(page);
  return workspaceId;
}

async function showTopology(page: Page) {
  await page.getByRole('button', { name: 'WORKSPACES', exact: true }).click();
  await page.getByText('Topology_Layout_Workspace', { exact: true }).click();
  await page.getByRole('radio', { name: 'topology' }).click();
  await expect
    .poll(() => graph(page).evaluate((c: any) => c._cyreg?.cy?.nodes().length ?? 0), { timeout: 10000 })
    .toBeGreaterThan(0);
}

function graph(page: Page) {
  return page.locator('cas-workspace-topology .graph');
}

/** Where a node is drawn, in page coordinates. */
async function nodeOnPage(page: Page, id: string): Promise<{ x: number; y: number }> {
  return graph(page).evaluate((container: any, nodeId) => {
    const p = container._cyreg.cy.getElementById(nodeId).renderedPosition();
    const box = container.getBoundingClientRect();
    return { x: box.left + p.x, y: box.top + p.y };
  }, id);
}

/** Where a node sits in the graph itself, which is what is saved. */
async function nodePosition(page: Page, id: string): Promise<{ x: number; y: number }> {
  return graph(page).evaluate((container: any, nodeId) => {
    const p = container._cyreg.cy.getElementById(nodeId).position();
    return { x: p.x, y: p.y };
  }, id);
}

function layoutSave(page: Page): Promise<Request> {
  return page.waitForRequest((r) => r.method() === 'PATCH' && r.url().endsWith('/topology/layout'));
}

async function drag(page: Page, id: string, dx: number, dy: number) {
  const { x, y } = await nodeOnPage(page, id);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 });
  await page.mouse.up();
}

test.describe('Workspaces Management', () => {
  // Pending upstream: the Topology view these tests drive is not on caster.ui or
  // caster.api main yet. It is in the draft PRs on feature/workspace-topology
  // (caster.ui #678, "Add a Topology view of a workspace's machines and networks",
  // and caster.api #118, "Draw a workspace's machines and networks from its latest
  // plan"). Until both merge, the workspace view has no "topology" toggle and every
  // test here times out looking for it. Remove this skip once they are on main.
  test.skip(true, 'Pending upstream: the workspace Topology view (caster.ui #678, caster.api #118) is not merged');

  test('Arrange Workspace Topology', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    await routeTopologyWithSavedLayout(page);
    await openTopology(page, cleanupCasterProject);

    // 1. Drag the router somewhere else
    const save = layoutSave(page);
    await drag(page, router, 120, 60);

    // expect: just the router is saved, where it now is, with no role
    const body = (await save).postDataJSON();
    const moved = await nodePosition(page, router);
    expect(Object.keys(body.nodes)).toEqual([router]);
    expect(body.nodes[router]).toEqual({ x: Math.round(moved.x), y: Math.round(moved.y) });
    expect((await (await save).response())?.status()).toBe(200);

    // 2. Open the workspace again
    await page.reload();
    await showTopology(page);

    // expect: the router is where it was left
    expect(await nodePosition(page, router)).toEqual({ x: Math.round(moved.x), y: Math.round(moved.y) });
  });

  test('Give a Topology Machine a Role', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    await routeTopologyWithSavedLayout(page);
    await openTopology(page, cleanupCasterProject);

    // 1. Click the router and pick its role
    const { x, y } = await nodeOnPage(page, router);
    await page.mouse.click(x, y);
    const details = page.locator('cas-workspace-topology .details');
    await details.getByRole('combobox', { name: 'Role' }).click();
    const save = layoutSave(page);
    await page.getByRole('option', { name: 'Firewall' }).click();

    // expect: the role is saved without pinning the router in place, and the graph shows it
    expect((await save).postDataJSON().nodes[router]).toEqual({ role: 'Firewall' });
    expect((await (await save).response())?.status()).toBe(200);
    expect(await graph(page).evaluate((c: any, id) => c._cyreg.cy.getElementById(id).data('role'), router)).toBe(
      'Firewall'
    );

    // 2. Open the workspace again and click the router
    await page.reload();
    await showTopology(page);
    const again = await nodeOnPage(page, router);
    await page.mouse.click(again.x, again.y);

    // expect: it is still a firewall
    await expect(details.getByRole('combobox', { name: 'Role' })).toHaveText('Firewall');
  });

  test('Reset Workspace Topology Layout', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    await routeTopologyWithSavedLayout(page);
    await openTopology(page, cleanupCasterProject);
    const view = page.locator('cas-workspace-topology');
    const reset = view.getByRole('button', { name: 'Reset layout' });

    // expect: nothing to reset until a node is moved
    await expect(reset).toBeDisabled();

    // 1. Give the router a role, then drag it
    const { x, y } = await nodeOnPage(page, router);
    await page.mouse.click(x, y);
    await view.locator('.details').getByRole('combobox', { name: 'Role' }).click();
    const roleSave = layoutSave(page);
    await page.getByRole('option', { name: 'Router' }).click();
    await roleSave;
    const dragSave = layoutSave(page);
    await drag(page, router, 150, 0);
    await dragSave;
    await expect(reset).toBeEnabled();

    // 2. Reset the layout
    await reset.click();
    const dialog = page.getByRole('dialog', { name: 'Reset Layout' });
    await expect(dialog).toContainText('for everyone who views this workspace');
    const resetSave = layoutSave(page);
    await dialog.getByRole('button', { name: 'Reset' }).click();

    // expect: the position is forgotten for everyone and the role kept
    expect((await resetSave).postDataJSON().nodes[router]).toEqual({ role: 'Router' });
    expect((await (await resetSave).response())?.status()).toBe(200);
    await expect(reset).toBeDisabled();
  });
});
