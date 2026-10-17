// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Dashboard shows hypervisor capacity', async ({ topomojoAuthenticatedPage: page }) => {
    // A cold load of /admin comes back from sign-in on the home page, so go in
    // through the Admin button like a user would.
    await page.goto(Services.TopoMojo.UI);
    const adminButton = page.getByRole('button', { name: 'Admin' });
    await adminButton.waitFor({ state: 'visible', timeout: 30000 });

    const capacity = page.waitForResponse(r => r.url().endsWith('/api/admin/capacity'));
    await adminButton.click();

    const response = await capacity;
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.nodes.length, 'the hypervisor should report at least one host').toBeGreaterThan(0);

    await expect(page.getByRole('heading', { name: 'Hypervisor Capacity' })).toBeVisible();

    // Every host the API reports gets a row with memory and cpu use.
    const hosts = page.locator('table.capacity').first();
    for (const node of body.nodes) {
      const row = hosts.getByRole('row').filter({ hasText: node.name });
      await expect(row).toContainText(/\d+% · [\d.]+ of [\d.]+ GB/);
      await expect(row).toContainText(`${node.cpuCores} cores`);
      await expect(row.getByRole('progressbar', { name: `Memory on ${node.name}` })).toBeVisible();
    }

    // Storage is limited to the stores TopoMojo deploys to.
    for (const store of body.storage) {
      const row = page.locator('table.capacity').nth(1).getByRole('row').filter({ hasText: store.name });
      await expect(row).toContainText(/\d+% · [\d.]+ of [\d.]+ GB/);
    }

    // Viewer-local time with a zone abbreviation.
    await expect(page.getByText(/as of \d{1,2}:\d{2}\s?[AP]M \S+/)).toBeVisible();

    const refreshed = page.waitForResponse(r => r.url().endsWith('/api/admin/capacity'));
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    expect((await refreshed).status()).toBe(200);
  });
});
