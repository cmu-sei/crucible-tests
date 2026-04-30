// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import * as fs from 'fs';
import * as path from 'path';
import { test, expect, Services } from '../../fixtures';
import {
  getAdminToken,
  createSponsor,
  createSubSponsor,
  deleteSponsor,
  uploadSponsorAvatar,
  CreatedSponsor,
} from '../../api-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Exercises the "parent sponsor → sub-sponsor" hierarchy described in the
// Gameboard docs (e.g., Department of Homeland Security → CISA). The same
// logo image is uploaded to both entries, mirroring the real-world case
// where a sub-sponsor inherits the parent's branding until they customize it.
test.describe('Admin - Sponsors', () => {
  let token: string;
  let parent: CreatedSponsor | null = null;
  let child: CreatedSponsor | null = null;

  test.beforeEach(async () => {
    token = await getAdminToken();
  });

  test.afterEach(async () => {
    if (child) await deleteSponsor(token, child.id);
    if (parent) await deleteSponsor(token, parent.id);
  });

  test('Create sponsor with sub-sponsor and upload shared logo', async ({ gameboardAuthenticatedPage: page }) => {
    const logoBytes = fs.readFileSync(
      path.resolve(__dirname, '../../assets/gameboard-logo.svg')
    );

    parent = await createSponsor(token, `ParentSponsor-${Date.now()}`);
    await uploadSponsorAvatar(token, parent.id, logoBytes, 'gameboard-logo.svg');

    child = await createSubSponsor(token, parent.id, `ChildSponsor-${Date.now()}`);
    await uploadSponsorAvatar(token, child.id, logoBytes, 'gameboard-logo.svg');

    // Verify both have a non-empty logo and that child references the parent.
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const parentRes = await ctx.fetch(`http://localhost:5002/api/sponsor/${parent.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const parentData = await parentRes.json();
      expect(parentData.logo, 'parent sponsor logo should be set').toBeTruthy();

      const childRes = await ctx.fetch(`http://localhost:5002/api/sponsor/${child.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const childData = await childRes.json();
      expect(childData.logo, 'child sponsor logo should be set').toBeTruthy();
      // The API returns `parentSponsor` as an object when the sponsor is a sub-sponsor.
      expect(
        childData.parentSponsor?.id ?? childData.parentSponsorId,
        'child should reference the parent'
      ).toBe(parent.id);
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/registrar/sponsors', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
