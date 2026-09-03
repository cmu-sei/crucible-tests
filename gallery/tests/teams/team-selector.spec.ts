// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { request as pwRequest } from '@playwright/test';
import { test, expect, Services, gotoExhibitSection } from '../../fixtures';
import { getUserToken } from '../../../keycloak-admin';

/**
 * Team Management §13.3 — Team Selector in Wall and Archive.
 *
 * Read-only: navigates between the two sections and asserts the indicator, mutating no
 * shared state, so the worker-scoped `seededExhibit` needs no restoration.
 *
 * `team-selector.component.html` renders the whole selector only when
 * `selectedTeamId && teamList` resolve, and picks between two labels:
 * "Team:&nbsp;" when the active team is the user's own team, "Observing:&nbsp;"
 * otherwise. With a single team it renders the short name as plain text; a `mat-select`
 * only appears once `teamList.length > 1`. The plan's example text is 'Team: CONTROL';
 * the seeded team's short name is generated per run, so it is read from the API and
 * asserted exactly rather than being matched loosely.
 */
test.describe('Team Management', () => {
  test('Team Selector in Wall and Archive', async ({
    galleryAuthenticatedPage: page,
    seededExhibit,
  }) => {
    // Ground truth for the expected label straight from the API.
    const token = await getUserToken('admin', 'admin', 'gallery.ui', 'openid profile gallery');
    const api = await pwRequest.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    let teamShortName: string;
    try {
      const teamResponse = await api.get(`${Services.Gallery.API}/api/teams/${seededExhibit.teamId}`);
      expect(teamResponse.status()).toBe(200);
      const team: { shortName: string } = await teamResponse.json();
      teamShortName = team.shortName;
      expect(teamShortName).toBeTruthy();
    } finally {
      await api.dispose();
    }

    // 1. Navigate to the Wall view and observe the team indicator.
    await gotoExhibitSection(page, seededExhibit.exhibitId, 'wall');
    await expect(page).toHaveTitle('Gallery Wall');

    // expect: Team name is displayed (e.g. 'Team: CONTROL').
    const wallSelector = page.locator('app-team-selector');
    await expect(wallSelector).toBeVisible();
    // The label is "Team:", not "Observing:" — the admin user is a member of the seeded
    // team, so `myTeamIsSelected()` is true.
    await expect(wallSelector.getByText('Team:')).toBeVisible();
    await expect(wallSelector.getByText('Observing:')).toHaveCount(0);
    await expect(wallSelector).toContainText(teamShortName);
    // A single team renders the short name as text; the dropdown only appears with 2+.
    await expect(wallSelector.locator('mat-select')).toHaveCount(0);

    // 2. Navigate to the Archive view and observe the team indicator.
    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(page).toHaveTitle(/^Gallery Archive( \(\d+\))?$/);

    // expect: The same team is displayed.
    const archiveSelector = page.locator('app-team-selector');
    await expect(archiveSelector).toBeVisible();
    await expect(archiveSelector.getByText('Team:')).toBeVisible();
    await expect(archiveSelector.getByText('Observing:')).toHaveCount(0);
    await expect(archiveSelector).toContainText(teamShortName);
    await expect(archiveSelector.locator('mat-select')).toHaveCount(0);

    // The Archive's own-team-only actions are enabled, which is the other observable
    // consequence of the active team still being the user's own team
    // (`archive.component.ts#myTeamIsSelected` gates the Read/Share buttons).
    const intelArticle = page
      .locator('section.cards mat-card')
      .filter({ hasText: 'Intel Article 1' });
    await expect(intelArticle).toHaveCount(1);
    await expect(intelArticle.getByRole('button', { name: 'Read' })).toBeEnabled();
    await expect(intelArticle.getByRole('button', { name: 'Share' })).toBeEnabled();

    // And going back to the Wall keeps the same team selected.
    await page.getByRole('button', { name: 'Wall' }).click();
    await expect(page).toHaveTitle('Gallery Wall');
    await expect(page.locator('app-team-selector')).toContainText(`Team: ${teamShortName}`);
  });
});
