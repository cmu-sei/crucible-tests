// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import fs from 'fs';
import path from 'path';
import { Page } from '@playwright/test';
import { test, expect, expectCasterProjectOpen, CASTER_THEMES, setCasterTheme } from '../../fixtures';

// The topology Caster reads from a plan of the Proxmox network, router and
// machine modules: 9 VMs on 4 vnets. Served in place of the API's answer so
// the view can be checked without running Terraform.
const proxmoxTopology = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'topology-proxmox.json'), 'utf8')
);

const emptyTopology = {
  workspaceId: proxmoxTopology.workspaceId,
  runId: null,
  createdAt: null,
  isDestroy: false,
  nodes: [],
  edges: [],
};

async function openNewWorkspace(page: Page, projectName: string, workspaceName: string) {
  await expect(page.getByText('My Projects')).toBeVisible();

  await page.locator('[mattooltip="Add New Project"]').click();
  const projectDialog = page.getByRole('dialog', { name: 'Create New Project?' });
  await expect(projectDialog).toBeVisible();
  await projectDialog.getByRole('textbox', { name: 'Name' }).fill(projectName);
  await projectDialog.getByRole('button', { name: 'Save' }).click();
  await expectCasterProjectOpen(page, projectName);

  await page.getByTitle('Add New Directory').click();
  const dirDialog = page.getByRole('dialog', { name: 'Create New Directory?' });
  await expect(dirDialog).toBeVisible();
  await dirDialog.getByRole('textbox', { name: 'Name' }).fill('Topology_Dir');
  await dirDialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Topology_Dir' })).toBeVisible({ timeout: 10000 });

  await page.getByRole('button', { name: 'Topology_Dir' }).click();
  await page.getByRole('button', { name: 'WORKSPACES' }).click();

  await page.getByText('Add Workspace').click();
  const wsDialog = page.getByRole('dialog', { name: 'Create New Workspace?' });
  await expect(wsDialog).toBeVisible();
  await wsDialog.getByRole('textbox', { name: 'Name' }).fill(workspaceName);
  await wsDialog.getByRole('button', { name: 'Save' }).click();

  await page.getByText(workspaceName, { exact: true }).click();
}

/** Where a node is drawn, in page coordinates, read from the cytoscape instance on the container. */
async function nodePosition(page: Page, id: string): Promise<{ x: number; y: number }> {
  return page.locator('cas-workspace-topology .graph').evaluate((container: any, nodeId) => {
    const cy = container._cyreg.cy;
    const p = cy.getElementById(nodeId).renderedPosition();
    const box = container.getBoundingClientRect();
    return { x: box.left + p.x, y: box.top + p.y };
  }, id);
}

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Workspaces Management`, () => {
    test('View Workspace Topology', async ({ casterAuthenticatedPage: page, cleanupCasterProjectByName }) => {
      await setCasterTheme(page, theme);

      const projectName = 'Topology WS Project';
      await cleanupCasterProjectByName(projectName);

      await page.route('**/api/workspaces/*/topology', (route) => route.fulfill({ json: proxmoxTopology }));

      await openNewWorkspace(page, projectName, 'Topology_Workspace');

      // 1. Switch to the Topology View
      await page.getByRole('radio', { name: 'topology' }).click();
      const view = page.locator('cas-workspace-topology');

      // expect: the plan the topology came from, a legend, and a drawn graph
      await expect(view.getByText('Plan from 2026-10-13')).toBeVisible({ timeout: 10000 });
      await expect(view.locator('.legend')).toContainText('create');
      await expect(view.locator('.graph canvas').first()).toBeVisible();

      // expect: the legend explains itself
      await view.locator('.legend-item', { hasText: 'replace' }).hover();
      await expect(page.locator('mat-tooltip-component')).toHaveText('Applying this plan destroys it and builds it again');

      // 2. Click the router
      const router = 'module.fw_edge.proxmox_virtual_environment_vm.vm';
      await expect
        .poll(() => view.locator('.graph').evaluate((c: any) => c._cyreg?.cy?.nodes().length ?? 0))
        .toBeGreaterThan(0);
      const { x, y } = await nodePosition(page, router);
      await page.mouse.click(x, y);

      // expect: its address, size and one row per NIC, in order
      const details = view.locator('.details');
      await expect(details.locator('.details-title')).toHaveText('fw-edge-demo');
      await expect(details.locator('.details-address')).toHaveText(router);
      await expect(details).toContainText('memory_mb');
      await expect(details.locator('tr', { hasText: 'nic0' })).toContainText('demo-outside');
      await expect(details.locator('tr', { hasText: 'nic3' })).toContainText('demo-mgmt');
    });

    test('View Workspace Topology After Apply', async ({ casterAuthenticatedPage: page, cleanupCasterProjectByName }) => {
      await setCasterTheme(page, theme);

      const projectName = 'Applied Topology WS Project';
      await cleanupCasterProjectByName(projectName);

      // The plan's run, already applied: its "create" outlines no longer describe anything.
      await page.route('**/api/workspaces/*/runs*', (route) => {
        const workspaceId = new URL(route.request().url()).pathname.split('/')[3];
        return route.fulfill({
          json: [
            {
              id: proxmoxTopology.runId,
              workspaceId,
              isDestroy: false,
              status: 'Applied',
              createdAt: proxmoxTopology.createdAt,
            },
          ],
        });
      });
      await page.route('**/api/workspaces/*/topology', (route) => route.fulfill({ json: proxmoxTopology }));

      await openNewWorkspace(page, projectName, 'Applied_Topology_Workspace');
      await page.getByRole('radio', { name: 'topology' }).click();
      const view = page.locator('cas-workspace-topology');

      // expect: the plan's outcome in place of its changes
      await expect(view.getByText('Plan from 2026-10-13 17:00 · Applied')).toBeVisible({ timeout: 10000 });
      await expect(view.locator('.legend')).toHaveText('external');
      await expect
        .poll(() =>
          view.locator('.graph').evaluate((c: any) => c._cyreg?.cy?.nodes('[action != ""][kind]').length ?? -1)
        )
        .toBe(0);
    });

    test('Export Workspace Topology', async ({ casterAuthenticatedPage: page, cleanupCasterProjectByName }, testInfo) => {
      await setCasterTheme(page, theme);

      const projectName = 'Export Topology WS Project';
      await cleanupCasterProjectByName(projectName);

      await page.route('**/api/workspaces/*/topology', (route) => route.fulfill({ json: proxmoxTopology }));

      await openNewWorkspace(page, projectName, 'Export_Topology_Workspace');
      await page.getByRole('radio', { name: 'topology' }).click();
      const view = page.locator('cas-workspace-topology');
      await expect(view.locator('.graph canvas').first()).toBeVisible({ timeout: 10000 });

      // 1. Download the image
      const downloadPromise = page.waitForEvent('download');
      await view.getByRole('button', { name: 'Download image' }).click();
      const download = await downloadPromise;

      // expect: a PNG named for the workspace
      expect(download.suggestedFilename()).toBe('Export_Topology_Workspace-topology.png');
      const png = fs.readFileSync(await download.path());
      expect(png.subarray(1, 4).toString()).toBe('PNG');

      // 2. Copy the image
      if (testInfo.project.name === 'chromium') {
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      }
      await view.getByRole('button', { name: 'Copy image' }).click();

      // expect: confirmation, and a PNG on the clipboard
      await expect(page.getByText('Copied to clipboard')).toBeVisible();
      if (testInfo.project.name === 'chromium') {
        const types = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap((i) => i.types));
        expect(types).toContain('image/png');
      }

      // 3. Print
      // Stub print so no dialog opens, and record what was on the page for it.
      await page.evaluate(() => {
        window.print = () => {
          (window as any).printed = {
            src: document.querySelector<HTMLImageElement>('body > img.cas-topology-print')?.src,
            title: document.title,
          };
          window.dispatchEvent(new Event('afterprint'));
        };
      });
      await view.getByRole('button', { name: 'Print' }).click();

      // expect: the graph, as an image named for the workspace, sent to print
      await expect.poll(() => page.evaluate(() => (window as any).printed?.src?.slice(0, 22))).toBe(
        'data:image/png;base64,'
      );
      expect(await page.evaluate(() => (window as any).printed.title)).toBe('Export_Topology_Workspace-topology');

      // expect: the page put back afterwards
      await expect(page.locator('img.cas-topology-print')).toHaveCount(0);
      await expect(page).not.toHaveTitle('Export_Topology_Workspace-topology');
    });

    test('View Workspace Topology Before Any Plan', async ({
      casterAuthenticatedPage: page,
      cleanupCasterProjectByName,
    }) => {
      await setCasterTheme(page, theme);

      const projectName = 'Empty Topology WS Project';
      await cleanupCasterProjectByName(projectName);

      await page.route('**/api/workspaces/*/topology', (route) => route.fulfill({ json: emptyTopology }));

      await openNewWorkspace(page, projectName, 'Empty_Topology_Workspace');

      await page.getByRole('radio', { name: 'topology' }).click();

      await expect(page.getByText('Run a plan to see the topology.')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('cas-workspace-topology .legend')).toHaveCount(0);
    });
  });
}
