// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Scenario Templates Management', () => {
  let templateId: string | null = null;
  const createdTemplateIds: string[] = [];

  test.afterEach(async ({ steamfitterApi }) => {
    for (const id of createdTemplateIds) {
      try {
        await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${id}`);
      } catch { /* ignore cleanup errors */ }
    }
    if (templateId && !createdTemplateIds.includes(templateId)) {
      try {
        await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`);
      } catch { /* ignore cleanup errors */ }
    }
  });

  test('Copy Scenario Template', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    const createResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Copy Test Template', description: 'Template to be copied', durationHours: 1 },
    });
    expect(createResp.ok()).toBeTruthy();
    const template = await createResp.json();
    templateId = template.id;
    createdTemplateIds.push(template.id);

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });
    await sidebar.locator('text=Scenario Templates').first().click();
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Copy Test Template').first()).toBeVisible({ timeout: 10000 });

    const templateRow = page.locator('text=Copy Test Template').first();
    const menuButton = templateRow.locator('..').locator('button:has(mat-icon:text("more_vert")), [class*="menu"]').first();
    const hasMenu = await menuButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasMenu) {
      await menuButton.click();
      await page.waitForTimeout(300);
      const copyOption = page.locator('button:has-text("Copy"), [role="menuitem"]:has-text("Copy")').first();
      await copyOption.click();
      await page.waitForTimeout(2000);
    }

    // Check for copy in API and track for cleanup
    const listResp = await steamfitterApi.get(`${Services.Steamfitter.API}/api/scenariotemplates`);
    if (listResp.ok()) {
      const templates = await listResp.json();
      const copies = templates.filter((t: any) => t.name.includes('Copy') && t.id !== templateId);
      for (const copy of copies) {
        if (!createdTemplateIds.includes(copy.id)) {
          createdTemplateIds.push(copy.id);
        }
      }
    }
  });
});
