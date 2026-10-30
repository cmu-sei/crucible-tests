// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md

import { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { requirePrecondition } from '../../../shared-fixtures';
import { getTopoMojoAdminToken, getTemplateSources, TemplateSourceReport } from '../../../topomojo-helpers';

async function openDisksTab(page: Page): Promise<void> {
  // A deep link to /admin lands on the home page, so go through the Admin button.
  await page.getByRole('button', { name: 'Admin' }).click();
  await page.getByRole('link', { name: 'Disks' }).click();
  await expect(page).toHaveURL(/\/admin\/disks/);
}

function rows(page: Page) {
  return page.locator('app-disk-browser tbody tr');
}

// The disks or template vms a hypervisor holds belong to the deployment, not to a test,
// so these need at least one global entry to exist.
async function requireGlobalSources(): Promise<TemplateSourceReport> {
  const report = await getTemplateSources(await getTopoMojoAdminToken());
  requirePrecondition(
    report.sources.some(s => s.isGlobal),
    'the hypervisor has no global disks (vSphere) or template VMs (Proxmox) for the Disks page to list'
  );
  return report;
}

test.describe('Admin - Disks', () => {
  test('lists global template sources with the help for this hypervisor', async ({ topomojoAuthenticatedPage: page }) => {
    const report = await requireGlobalSources();
    const globals = report.sources.filter(s => s.isGlobal);

    await openDisksTab(page);

    // vSphere lists VMDK paths for Disks[].Path; Proxmox lists template VMs for Template.
    const disks = report.field === 'disks';
    await expect(page.getByRole('heading', { name: disks ? 'Disks' : 'Template VMs', exact: true })).toBeVisible();
    await expect(page.locator('app-disk-browser code').first()).toHaveText(disks ? 'Disks[].Path' : 'Template');

    // Global Only is on by default, like the Files page.
    await expect(page.getByRole('button', { name: 'Global Only' })).toHaveAttribute('aria-pressed', 'true');

    await expect(page.getByRole('button', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Workspace' })).toBeVisible();
    await expect(page.getByRole('button', { name: disks ? 'Modified' : 'Created' })).toBeVisible();

    await expect(rows(page)).toHaveCount(globals.length);
    for (const row of await rows(page).all()) {
      await expect(row.locator('td').nth(1)).toHaveText('Global');
    }
    await expect(page.getByText(`${globals.length} of ${report.sources.length}`)).toBeVisible();
  });

  test('Global Only off lists every source, and search narrows the list', async ({ topomojoAuthenticatedPage: page }) => {
    const report = await requireGlobalSources();
    const target = report.sources.find(s => s.isGlobal)!.name;

    await openDisksTab(page);

    await page.getByRole('button', { name: 'Global Only' }).click();
    await expect(page.getByRole('button', { name: 'Global Only' })).toHaveAttribute('aria-pressed', 'false');
    await expect(rows(page)).toHaveCount(report.sources.length);

    const expected = report.sources.filter(s =>
      [s.name, s.workspaceName, s.templateName].some(v => (v ?? '').toLowerCase().includes(target.toLowerCase()))
    );
    await page.getByRole('searchbox', { name: 'Search' }).fill(target);
    await expect(rows(page)).toHaveCount(expected.length);
    await expect(rows(page).filter({ hasText: target }).first()).toBeVisible();
  });

  test('sorting by Name reverses the order', async ({ topomojoAuthenticatedPage: page }) => {
    await requireGlobalSources();

    await openDisksTab(page);
    await page.getByRole('button', { name: 'Global Only' }).click();

    const names = () => rows(page).locator('td:first-child').allInnerTexts();
    await expect(rows(page).first()).toBeVisible();

    // Name ascending is the default sort.
    const ascending = (await names()).map(n => n.trim());
    expect(ascending).toEqual([...ascending].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));

    await page.getByRole('button', { name: 'Name' }).click();
    await expect.poll(async () => (await names()).map(n => n.trim())).toEqual([...ascending].reverse());
  });
});
